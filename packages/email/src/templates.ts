/**
 * Transactional email templates. Each returns a fully-rendered message
 * ({ subject, html, text }) so call sites stay declarative and the visual
 * design lives in one place.
 */

import {
  brand,
  button,
  esc,
  heading,
  layout,
  paragraph,
} from "./render";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Email-verification one-time code. The code is the hero of the message; a short
 * expiry note and a "didn't request this" line keep it trustworthy.
 */
export function verifyOtpEmail(opts: {
  code: string;
  /** Expiry window in minutes, for the copy. */
  expiresInMinutes: number;
  name?: string | null;
}): RenderedEmail {
  const greeting = opts.name?.trim() ? `Hi ${esc(opts.name.trim())},` : "Hi there,";
  const digits = opts.code
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;min-width:38px;padding:14px 0;margin:0 4px;font-family:${brand.serif};font-size:30px;font-weight:400;letter-spacing:0.04em;color:${brand.ink};background:${brand.accentSoft};border:1px solid ${brand.line};border-radius:12px;text-align:center;">${esc(d)}</span>`,
    )
    .join("");

  const body = `
    ${heading("Verify your email")}
    ${paragraph(`${greeting} use the code below to confirm your email and finish setting up your ZenBuild account.`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td align="center">${digits}</td></tr></table>
    ${paragraph(`This code expires in <strong style="color:${brand.ink};">${opts.expiresInMinutes} minutes</strong>. For your security, don't share it with anyone.`)}
    ${paragraph(`<span style="color:${brand.muted};font-size:13px;">If you didn't try to sign in or create an account, you can safely ignore this email.</span>`)}
  `;

  return {
    subject: `Your ZenBuild verification code: ${opts.code}`,
    html: layout({ preview: `Your verification code is ${opts.code}`, body }),
    text: [
      greeting.replace(/<[^>]+>/g, ""),
      "",
      "Use this code to verify your email and finish setting up your ZenBuild account:",
      "",
      `    ${opts.code}`,
      "",
      `This code expires in ${opts.expiresInMinutes} minutes. Don't share it with anyone.`,
      "If you didn't request this, you can safely ignore this email.",
    ].join("\n"),
  };
}

/**
 * Post-onboarding welcome. Orients the user around the core loop and points them
 * back into the app. Copy adapts slightly to individual vs. organization.
 */
export function welcomeEmail(opts: {
  name?: string | null;
  workspaceName: string;
  accountType: "INDIVIDUAL" | "ORGANIZATION";
  dashboardUrl: string;
}): RenderedEmail {
  const greeting = opts.name?.trim() ? `Welcome, ${esc(opts.name.trim())}!` : "Welcome to ZenBuild!";
  const intro =
    opts.accountType === "ORGANIZATION"
      ? `Your organization <strong style="color:${brand.ink};">${esc(opts.workspaceName)}</strong> is ready. Invite your team and ship features together — calmly.`
      : `Your workspace <strong style="color:${brand.ink};">${esc(opts.workspaceName)}</strong> is ready. Here's the calm path every feature takes in ZenBuild.`;

  const steps: Array<[string, string]> = [
    ["Capture a request", "Drop in a feature request from a form, email, ticket, or call."],
    ["Draft the PRD", "AI clarifies the requirement and writes a structured PRD for you to review."],
    ["Plan the work", "The PRD becomes engineering tasks on a Kanban board you approve."],
    ["Code & AI review", "Connect a GitHub repo; AI implements tasks and reviews every PR against your requirements."],
    ["You approve & ship", "A human always makes the final call before anything ships."],
  ];

  const stepRows = steps
    .map(
      ([title, desc], i) => `
      <tr>
        <td valign="top" style="padding:10px 14px 10px 0;width:34px;">
          <span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;border-radius:50%;background:${brand.accentSoft};color:${brand.accentDeep};font-weight:700;font-size:14px;">${i + 1}</span>
        </td>
        <td valign="top" style="padding:10px 0;">
          <div style="font-size:15px;font-weight:600;color:${brand.ink};">${esc(title)}</div>
          <div style="font-size:14px;line-height:1.55;color:${brand.inkSoft};">${esc(desc)}</div>
        </td>
      </tr>`,
    )
    .join("");

  const inviteLine =
    opts.accountType === "ORGANIZATION"
      ? paragraph(
          `<span style="color:${brand.muted};font-size:13px;">Tip: head to Settings → Members to invite your teammates.</span>`,
        )
      : "";

  const body = `
    ${heading(greeting)}
    ${paragraph(intro)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">${stepRows}</table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td>${button("Open your dashboard", opts.dashboardUrl)}</td></tr></table>
    ${inviteLine}
  `;

  return {
    subject: `Welcome to ZenBuild — ${opts.workspaceName} is ready`,
    html: layout({ preview: "Here's how to ship your first feature, calmly.", body }),
    text: [
      greeting.replace(/<[^>]+>/g, ""),
      "",
      intro.replace(/<[^>]+>/g, ""),
      "",
      ...steps.map(([t, d], i) => `${i + 1}. ${t} — ${d}`),
      "",
      `Open your dashboard: ${opts.dashboardUrl}`,
    ].join("\n"),
  };
}

/** Organization invitation. */
export function inviteEmail(opts: {
  inviterName: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
}): RenderedEmail {
  const body = `
    ${heading(`You're invited to ${opts.organizationName}`)}
    ${paragraph(`<strong style="color:${brand.ink};">${esc(opts.inviterName)}</strong> invited you to join <strong style="color:${brand.ink};">${esc(opts.organizationName)}</strong> on ZenBuild as <strong style="color:${brand.ink};">${esc(opts.role)}</strong>.`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;"><tr><td>${button("Accept invitation", opts.acceptUrl)}</td></tr></table>
    ${paragraph(`<span style="color:${brand.muted};font-size:13px;">If you weren't expecting this, you can safely ignore this email.</span>`)}
  `;

  return {
    subject: `You're invited to ${opts.organizationName} on ZenBuild`,
    html: layout({ preview: `Join ${opts.organizationName} on ZenBuild`, body }),
    text: [
      `${opts.inviterName} invited you to join "${opts.organizationName}" on ZenBuild as ${opts.role}.`,
      "",
      "Accept the invitation:",
      opts.acceptUrl,
      "",
      "If you weren't expecting this, you can ignore this email.",
    ].join("\n"),
  };
}
