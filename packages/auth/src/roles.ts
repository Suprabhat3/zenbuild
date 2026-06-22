/**
 * Organization roles. These mirror BetterAuth's organization-plugin defaults so
 * the strings line up with what the plugin writes to `member.role`.
 *
 * This module is framework-agnostic (no server imports) so it can be shared by
 * both the server auth instance and the browser auth client.
 */
export const ORG_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type OrgRole = (typeof ORG_ROLES)[keyof typeof ORG_ROLES];

export const ORG_ROLE_VALUES: OrgRole[] = [
  ORG_ROLES.OWNER,
  ORG_ROLES.ADMIN,
  ORG_ROLES.MEMBER,
];

/** Roles permitted to manage members / invitations / workspace settings. */
export const ORG_ADMIN_ROLES: OrgRole[] = [ORG_ROLES.OWNER, ORG_ROLES.ADMIN];

/** Human-readable labels for UI. */
export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};
