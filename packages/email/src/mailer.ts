/**
 * Pluggable transactional mailer.
 *
 * Transport is auto-selected at module load:
 *  - If `RESEND_API_KEY` is set, send for real via Resend (from `EMAIL_FROM`).
 *  - Otherwise fall back to a console transport that logs the message — including
 *    any verification code or action link — so auth flows stay fully demoable in
 *    local dev without a provider configured.
 *
 * `setMailer` leaves a single seam to swap the transport in tests.
 */

import { serverEnv } from "@zenbuild/env";

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body (always provided as a fallback). */
  text: string;
  /** HTML body. */
  html?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

const DEFAULT_FROM = "ZenBuild <onboarding@resend.dev>";

const consoleMailer: Mailer = {
  async send(message) {
    // eslint-disable-next-line no-console
    console.info(
      [
        "",
        "📧 [dev mailer] outgoing email (no RESEND_API_KEY configured)",
        `   to:      ${message.to}`,
        `   subject: ${message.subject}`,
        "   ----------------------------------------",
        message.text
          .split("\n")
          .map((line) => `   ${line}`)
          .join("\n"),
        "   ----------------------------------------",
        "",
      ].join("\n"),
    );
  },
};

/**
 * Resend-backed transport. Lazily imports the SDK so the package has no hard
 * runtime dependency on `resend` when it isn't configured.
 */
function createResendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(message) {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html ?? message.text,
        text: message.text,
      });
      if (error) {
        throw new Error(`Resend failed to send email: ${error.message}`);
      }
    },
  };
}

function selectDefaultMailer(): Mailer {
  const apiKey = serverEnv.RESEND_API_KEY;
  if (apiKey) {
    return createResendMailer(apiKey, serverEnv.EMAIL_FROM ?? DEFAULT_FROM);
  }
  return consoleMailer;
}

let activeMailer: Mailer = selectDefaultMailer();

/** Override the transport (e.g. in tests). */
export function setMailer(mailer: Mailer): void {
  activeMailer = mailer;
}

export function getMailer(): Mailer {
  return activeMailer;
}
