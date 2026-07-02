"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_SECTIONS } from "@/components/app/nav-config";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-1">
      {NAV_SECTIONS.map((section, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {i > 0 && <hr className="app-nav-divider" />}
          {section.map((item) => {
            const active = item.matchPrefix
              ? pathname === item.href || pathname.startsWith(`${item.href}/`)
              : pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="app-nav-link"
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
