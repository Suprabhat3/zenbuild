import {
  CreditCard,
  FolderKanban,
  Home,
  Inbox,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match nested routes (e.g. /projects/123) as active too. */
  matchPrefix?: boolean;
}

/**
 * Primary sidebar navigation, grouped into sections rendered with a divider
 * between them. Deliberately five items (docs/frontend-redesign-plan.md §4.1):
 * Approvals lives in Home's "Needs your decision" queue and Reviews inside
 * each request's workspace — neither is a top-level destination.
 */
export const NAV_SECTIONS: NavItem[][] = [
  [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Requests", href: "/requests", icon: Inbox, matchPrefix: true },
    {
      label: "Projects",
      href: "/projects",
      icon: FolderKanban,
      matchPrefix: true,
    },
  ],
  [
    { label: "Billing", href: "/billing", icon: CreditCard },
    { label: "Settings", href: "/settings", icon: Settings, matchPrefix: true },
  ],
];
