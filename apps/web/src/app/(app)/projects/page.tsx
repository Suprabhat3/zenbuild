import type { Metadata } from "next";

import { ProjectsManager } from "@/components/app/projects-manager";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Projects · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, org] = await Promise.all([
    api.project.list(),
    api.viewer.activeOrganization(),
  ]);
  const canManage = org.role === "owner" || org.role === "admin";

  return <ProjectsManager projects={projects} canManage={canManage} />;
}
