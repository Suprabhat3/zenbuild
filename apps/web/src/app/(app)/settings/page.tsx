import type { Metadata } from "next";

import { GeneralSettingsForm } from "@/components/app/general-settings-form";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "General settings · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage() {
  const org = await api.viewer.activeOrganization();
  const canEdit = org.role === "owner" || org.role === "admin";

  return (
    <GeneralSettingsForm
      organizationId={org.id}
      initialName={org.name}
      slug={org.slug}
      canEdit={canEdit}
    />
  );
}
