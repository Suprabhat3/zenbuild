"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { label: "General", href: "/settings" },
  { label: "Members", href: "/settings/members" },
  { label: "Integrations", href: "/settings/integrations" },
  { label: "Intake", href: "/settings/intake" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="app-tabs">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="app-tab"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
