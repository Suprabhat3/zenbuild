/**
 * Email rendering primitives.
 *
 * Transactional emails render to table-based HTML with fully inlined styles —
 * the only layout language email clients (Gmail, Outlook, Apple Mail) render
 * reliably. No external CSS, fonts, images, or JS: everything is self-contained
 * so it survives aggressive client sanitizers. The palette mirrors the ZenBuild
 * landing brand (warm cream paper, ink text, rose accent).
 */

export const brand = {
  bg: "#f2ebdd",
  paper: "#fffdf8",
  ink: "#25201a",
  inkSoft: "#4e463b",
  muted: "#847a6a",
  line: "#e6dcc8",
  accent: "#e11d48",
  accentDeep: "#b81239",
  accentSoft: "#fce9ed",
  sage: "#6e7f5e",
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

/** Escape interpolated user-supplied strings before embedding in HTML. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface LayoutOptions {
  /** Preview text shown in the inbox list (hidden in the body). */
  preview: string;
  /** Inner HTML for the main content card. */
  body: string;
}

/**
 * Wraps content in the shared ZenBuild email shell: centered card on a warm
 * canvas, wordmark header, and a calm footer. Width is capped at 560px — the
 * safe maximum for mobile clients.
 */
export function layout({ preview, body }: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light" />
    <title>ZenBuild</title>
  </head>
  <body style="margin:0;padding:0;background:${brand.bg};font-family:${brand.sans};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
      ${esc(preview)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bg};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;">
            <tr>
              <td style="padding:4px 8px 20px;">
                <span style="font-family:${brand.serif};font-size:22px;font-weight:400;letter-spacing:-0.01em;color:${brand.ink};">
                  Zen<span style="color:${brand.accent};">Build</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="background:${brand.paper};border:1px solid ${brand.line};border-radius:18px;padding:40px;box-shadow:0 12px 32px -12px rgba(60,45,20,0.18);">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 8px 8px;color:${brand.muted};font-size:12px;line-height:1.6;">
                ZenBuild — ship features calmly, from request to release.<br />
                You received this email because an account was created with this address.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** A primary rose call-to-action button (bulletproof-ish via padded anchor). */
export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td align="center" style="border-radius:12px;background:${brand.accent};">
      <a href="${esc(href)}" target="_blank"
        style="display:inline-block;padding:13px 28px;font-family:${brand.sans};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
        ${esc(label)}
      </a>
    </td>
  </tr></table>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${brand.serif};font-weight:400;font-size:26px;line-height:1.15;color:${brand.ink};letter-spacing:-0.01em;">${esc(text)}</h1>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${brand.inkSoft};">${html}</p>`;
}
