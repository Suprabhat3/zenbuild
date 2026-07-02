"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  GitPullRequest,
  Rocket,
  SquareKanban,
} from "lucide-react";

/**
 * Tab navigation for the feature-request workspace. Rendered by the shared
 * `[id]/layout.tsx` so the four surfaces (overview, task board, reviews,
 * release) always feel like one place.
 */
export function FeatureRequestTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/feature-requests/${id}`;

  const tabs = [
    { label: "Overview", href: base, icon: FileText, exact: true },
    { label: "Tasks", href: `${base}/board`, icon: SquareKanban, exact: false },
    {
      label: "Reviews",
      href: `${base}/reviews`,
      icon: GitPullRequest,
      exact: false,
    },
    { label: "Ship", href: `${base}/release`, icon: Rocket, exact: false },
  ];

  return (
    <nav className="app-subnav" aria-label="Feature request sections">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="app-tab"
          >
            <Icon className="size-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
