/**
 * Thin client-side wrapper around Razorpay Checkout.js. The script is loaded on
 * demand (so it never blocks first paint) and the subscription checkout is
 * opened with the subscription id minted server-side. The success handler
 * yields the fields we hand back to `billing.verifyPayment` for signature
 * verification.
 */

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (response: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Inject Checkout.js once; resolves when `window.Razorpay` is available. */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout is browser-only."));
  }
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay Checkout.")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay Checkout."));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Open the Razorpay subscription checkout. Resolves with the success payload, or
 * rejects if the user dismisses the modal / payment fails.
 */
export async function openRazorpayCheckout(args: {
  keyId: string;
  subscriptionId: string;
  planLabel: string;
  prefill?: { name?: string; email?: string };
}): Promise<RazorpaySuccess> {
  await loadRazorpayCheckout();
  const Ctor = window.Razorpay;
  if (!Ctor) throw new Error("Razorpay Checkout is unavailable.");

  return new Promise<RazorpaySuccess>((resolve, reject) => {
    const rzp = new Ctor({
      key: args.keyId,
      subscription_id: args.subscriptionId,
      name: "ZenBuild",
      description: `${args.planLabel} subscription`,
      prefill: args.prefill,
      theme: { color: "#b45309" },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error("Checkout cancelled.")),
      },
    });
    rzp.on("payment.failed", () =>
      reject(new Error("Payment failed. Please try again.")),
    );
    rzp.open();
  });
}
