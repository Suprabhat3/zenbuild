import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, organization } from "better-auth/plugins";

import { db } from "@zenbuild/db";
import { getMailer, inviteEmail, verifyOtpEmail } from "@zenbuild/email";
import { serverEnv } from "@zenbuild/env";

import { ensureSubscription } from "./provisioning";
import { ORG_ROLES } from "./roles";

/** OTP lifetime, shared between the plugin config and the email copy. */
const OTP_EXPIRES_IN_SECONDS = 60 * 10; // 10 minutes

const githubEnabled = Boolean(
  serverEnv.GITHUB_CLIENT_ID && serverEnv.GITHUB_CLIENT_SECRET,
);

const googleEnabled = Boolean(
  serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET,
);

const appUrl =
  serverEnv.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

/**
 * The single BetterAuth instance for ZenBuild.
 *
 * - Email/password with mandatory email verification via a 6-digit OTP (the
 *   emailOTP plugin overrides the default link-based verification). Auto sign-in
 *   is off at signup; the user is signed in only after the code is verified.
 * - Optional GitHub + Google OAuth (auto-disabled until creds set).
 * - Organization plugin provides multi-tenant workspaces, members, invitations.
 * - Workspaces are NOT auto-provisioned: a verified user picks Individual vs.
 *   Organization in onboarding, which creates the workspace. On session create we
 *   default the active organization to the user's first membership (if any).
 * - `nextCookies()` is intentionally LAST so it can flush auth cookies on
 *   server-action responses.
 */
export const auth = betterAuth({
  appName: "ZenBuild",
  baseURL: appUrl,
  secret: serverEnv.BETTER_AUTH_SECRET,

  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // No auto sign-in: users must verify their email (OTP) before a session is
    // issued. They're signed in automatically once the code checks out.
    autoSignIn: false,
    requireEmailVerification: true,
  },

  emailVerification: {
    autoSignInAfterVerification: true,
  },

  socialProviders: {
    ...(githubEnabled
      ? {
          github: {
            clientId: serverEnv.GITHUB_CLIENT_ID!,
            clientSecret: serverEnv.GITHUB_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(googleEnabled
      ? {
          google: {
            clientId: serverEnv.GOOGLE_CLIENT_ID!,
            clientSecret: serverEnv.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Default the active workspace to the user's first membership so the
          // app shell always has an org context immediately after login.
          const membership = await db.member.findFirst({
            where: { userId: session.userId },
            orderBy: { createdAt: "asc" },
          });
          return {
            data: {
              ...session,
              activeOrganizationId: membership?.organizationId ?? null,
            },
          };
        },
      },
    },
  },

  plugins: [
    // Email verification (and sign-in for unverified users) via a 6-digit OTP.
    // `overrideDefaultEmailVerification` routes BetterAuth's built-in
    // verification through this plugin so `requireEmailVerification` sends a code
    // instead of a magic link.
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_EXPIRES_IN_SECONDS,
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        // We only use the email-verification flow here; other types are no-ops.
        if (type !== "email-verification") return;
        const message = verifyOtpEmail({
          code: otp,
          expiresInMinutes: Math.round(OTP_EXPIRES_IN_SECONDS / 60),
        });
        await getMailer().send({
          to: email,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      },
    }),
    organization({
      creatorRole: ORG_ROLES.OWNER,
      // Members are accepted into the org they were invited to; the invite link
      // carries the invitation id.
      invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
      sendInvitationEmail: async (data) => {
        const acceptUrl = `${appUrl}/accept-invite/${data.id}`;
        const message = inviteEmail({
          inviterName: data.inviter.user.name || data.inviter.user.email,
          organizationName: data.organization.name,
          role: data.role,
          acceptUrl,
        });
        await getMailer().send({
          to: data.email,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      },
      organizationCreation: {
        afterCreate: async (data: { organization: { id: string } }) => {
          // Workspaces created from the UI also need a billing row.
          await ensureSubscription(data.organization.id);
        },
      },
    }),
    // Must be the last plugin.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;

export { ORG_ROLES, type OrgRole } from "./roles";
export { ensureSubscription, generateUniqueOrgSlug } from "./provisioning";
