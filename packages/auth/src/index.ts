import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { db } from "@zenbuild/db";
import { serverEnv } from "@zenbuild/env";

import { getMailer } from "./mailer";
import {
  ensureSubscription,
  provisionDefaultOrganization,
} from "./provisioning";
import { ORG_ROLES } from "./roles";

const githubEnabled = Boolean(
  serverEnv.GITHUB_CLIENT_ID && serverEnv.GITHUB_CLIENT_SECRET,
);

const appUrl =
  serverEnv.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

/**
 * The single BetterAuth instance for ZenBuild.
 *
 * - Email/password (auto sign-in after signup) + optional GitHub OAuth.
 * - Organization plugin provides multi-tenant workspaces, members, invitations.
 * - On signup we provision a default workspace; on session create we default the
 *   active organization to the user's first membership.
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
    autoSignIn: true,
  },

  socialProviders: githubEnabled
    ? {
        github: {
          clientId: serverEnv.GITHUB_CLIENT_ID!,
          clientSecret: serverEnv.GITHUB_CLIENT_SECRET!,
        },
      }
    : {},

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Give every new user a workspace to land in.
          await provisionDefaultOrganization({
            id: user.id,
            name: user.name,
            email: user.email,
          });
        },
      },
    },
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
    organization({
      creatorRole: ORG_ROLES.OWNER,
      // Members are accepted into the org they were invited to; the invite link
      // carries the invitation id.
      invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
      sendInvitationEmail: async (data) => {
        const acceptUrl = `${appUrl}/accept-invite/${data.id}`;
        await getMailer().send({
          to: data.email,
          subject: `You're invited to ${data.organization.name} on ZenBuild`,
          text: [
            `${data.inviter.user.name || data.inviter.user.email} invited you to join`,
            `"${data.organization.name}" on ZenBuild as ${data.role}.`,
            "",
            "Accept the invitation:",
            acceptUrl,
            "",
            "If you weren't expecting this, you can ignore this email.",
          ].join("\n"),
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
export { getMailer, setMailer, type Mailer, type EmailMessage } from "./mailer";
export {
  ensureSubscription,
  provisionDefaultOrganization,
  generateUniqueOrgSlug,
} from "./provisioning";
