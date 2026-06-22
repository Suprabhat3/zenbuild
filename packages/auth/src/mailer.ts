/**
 * Pluggable transactional mailer.
 *
 * No email provider is wired up yet (none is configured in this environment), so
 * the default transport logs the message — and, crucially, any action link — to
 * the server console. This keeps invite/verification flows fully demoable in
 * development while leaving a single seam (`setMailer`) to drop in a real
 * provider (Resend, SES, Postmark, …) without touching call sites.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. */
  text: string;
  /** Optional HTML body. */
  html?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

const consoleMailer: Mailer = {
  async send(message) {
    // eslint-disable-next-line no-console
    console.info(
      [
        "",
        "📧 [dev mailer] outgoing email (no provider configured)",
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

let activeMailer: Mailer = consoleMailer;

/** Swap the transport (e.g. in `instrumentation.ts` once a provider is configured). */
export function setMailer(mailer: Mailer): void {
  activeMailer = mailer;
}

export function getMailer(): Mailer {
  return activeMailer;
}
