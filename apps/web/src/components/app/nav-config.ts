import {
  ClipboardCheck,
  CreditCard,
  FolderKanban,
  GitPullRequest,
  Inbox,
  LayoutDashboard,
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

/** Primary sidebar navigation for the authenticated app shell. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban, matchPrefix: true },
  {
    label: "Feature Requests",
    href: "/feature-requests",
    icon: Inbox,
    matchPrefix: true,
  },
  { label: "Reviews", href: "/reviews", icon: GitPullRequest, matchPrefix: true },
  { label: "Approvals", href: "/approvals", icon: ClipboardCheck, matchPrefix: true },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings, matchPrefix: true },
];
