import { randomBytes } from "node:crypto";

import { db } from "@zenbuild/db";

/** Free plan starts with 25 AI review credits (mirrors the seed). */
const FREE_PLAN_REVIEW_CREDITS = 25;

/**
 * Turn an arbitrary name into a URL-safe slug fragment. Empty/garbage input
 * collapses to "workspace" so we always have a base to work from.
 */
function slugifyBase(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "workspace";
}

/**
 * Produce an organization slug that is unique across the table. Tries the bare
 * base first, then appends short random suffixes until a free one is found.
 */
export async function generateUniqueOrgSlug(name: string): Promise<string> {
  const base = slugifyBase(name);
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
    const existing = await db.organization.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  // Astronomically unlikely fallback.
  return `${base}-${randomBytes(8).toString("hex")}`;
}

/**
 * Ensure an organization has a billing Subscription row. Idempotent — safe to
 * call from multiple creation paths (signup default org, UI-created org).
 */
export async function ensureSubscription(organizationId: string): Promise<void> {
  await db.subscription.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      plan: "FREE",
      status: "ACTIVE",
      reviewCreditsTotal: FREE_PLAN_REVIEW_CREDITS,
      reviewCreditsUsed: 0,
    },
  });
}

/**
 * Create a brand-new user's default workspace: organization + owner membership +
 * Free subscription, in a single transaction. Returns the new organization id so
 * callers can mark it active. Idempotent per user — if the user somehow already
 * owns a membership we reuse it instead of creating a duplicate.
 */
export async function provisionDefaultOrganization(user: {
  id: string;
  name: string;
  email: string;
}): Promise<string> {
  const existing = await db.member.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.organizationId;

  const displayName = user.name?.trim() || user.email.split("@")[0] || "My";
  const orgName = `${displayName}'s Workspace`;
  const slug = await generateUniqueOrgSlug(displayName);

  const organizationId = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: orgName, slug },
    });
    await tx.member.create({
      data: { organizationId: org.id, userId: user.id, role: "owner" },
    });
    await tx.subscription.create({
      data: {
        organizationId: org.id,
        plan: "FREE",
        status: "ACTIVE",
        reviewCreditsTotal: FREE_PLAN_REVIEW_CREDITS,
        reviewCreditsUsed: 0,
      },
    });
    return org.id;
  });

  return organizationId;
}
