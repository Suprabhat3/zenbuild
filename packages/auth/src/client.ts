/**
 * Client-safe exports: framework-agnostic constants and types that are safe to
 * bundle into the browser. Never re-export the server `auth` instance (it pulls
 * in the database) from here.
 *
 * The actual browser auth client (`createAuthClient` from `better-auth/react`)
 * is constructed in the web app, where React is a dependency.
 */
export {
  ORG_ROLES,
  ORG_ROLE_VALUES,
  ORG_ADMIN_ROLES,
  ORG_ROLE_LABELS,
  type OrgRole,
} from "./roles";
