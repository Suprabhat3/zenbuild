"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { NAV_ITEMS } from "@/components/app/nav-config";

/**
 * Mobile navigation: hamburger in the topbar opening a slide-over drawer with
 * the full primary nav. The desktop sidebar is hidden below 768px, so without
 * this the app has no navigation at all on phones.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on any navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="app-menu-btn"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-4" />
      </button>

      {open && (
        <>
          <div
            className="app-drawer-overlay md:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="app-drawer md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="app-drawer-head">
              <span className="app-wordmark">ZenBuild</span>
              <button
                type="button"
                className="app-menu-btn"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 px-1">
              {NAV_ITEMS.map((item) => {
                const active = item.matchPrefix
                  ? pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)
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
            </nav>
          </div>
        </>
      )}
    </>
  );
}
