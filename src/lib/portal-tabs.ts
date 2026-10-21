import { isMenuTab } from "@/lib/creator-home";
import type { Viewer } from "@/lib/types";

export const PORTAL_TABS = [
  { id: "deals", href: "/", label: "Brand deals" },
  { id: "inbox", href: "/inbox", label: "Deal inbox" },
  { id: "earnings", href: "/earnings", label: "Earnings & payouts" },
  { id: "report", href: "/report", label: "Report" },
  { id: "analytics", href: "/analytics", label: "Analytics" },
  { id: "connect", href: "/connect", label: "Connect accounts" },
  { id: "calendar", href: "/calendar", label: "Calendar" },
  { id: "kit", href: "/media-kit", label: "Media kit" },
  { id: "approvals", href: "/approvals", label: "Approvals" },
  { id: "directory", href: "/directory", label: "Members" },
  { id: "profile", href: "/profile", label: "My profile" },
  { id: "brands", href: "/brands", label: "Brands" },
  { id: "rules", href: "/rules", label: "Deal rules" },
  { id: "campaigns", href: "/campaigns", label: "Campaigns" },
  { id: "offers", href: "/offers", label: "Offers" },
  { id: "gifts", href: "/gifts", label: "Free products" },
  { id: "review", href: "/review", label: "Review" },
  { id: "access", href: "/access", label: "Access" },
  { id: "prospects", href: "/prospects", label: "Prospects" },
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "pipeline", href: "/pipeline", label: "Deal pipeline" },
  { id: "ranking", href: "/ranking", label: "Ranking" },
  { id: "reports", href: "/reports", label: "Reports" },
  { id: "pods", href: "/pods", label: "Pods" },
  { id: "bench", href: "/bench", label: "Bench" },
  { id: "rights", href: "/rights", label: "Usage rights" },
  { id: "safety", href: "/safety", label: "Safety" },
  { id: "referrals", href: "/referrals", label: "Referrals" },
  { id: "support", href: "/support", label: "Support" },
  { id: "settings", href: "/settings", label: "Settings" },
  { id: "billing", href: "/billing", label: "Billing and usage" },
  { id: "invoices", href: "/invoices", label: "Invoices" },
  { id: "payouts", href: "/payouts", label: "Payout ledger" },
  { id: "team", href: "/team", label: "Team" },
] as const;

export type PortalTab = (typeof PORTAL_TABS)[number]["id"];

/** Tabs in the top bar. Account-menu pages stay in the avatar menu. */
export function visiblePortalTabs(viewer: Viewer) {
  return PORTAL_TABS.filter((item) => {
    if (isMenuTab(item.id)) return false;
    if (item.id === "team") return viewer.role === "admin";
    if (item.id === "invoices") return viewer.role === "admin";
    if (item.id === "safety") return viewer.role === "admin" || viewer.role === "manager";
    if (item.id === "earnings") return viewer.role !== "manager";
    if (item.id === "payouts") return viewer.role === "admin" || viewer.role === "creator";
    if (item.id === "report") return viewer.role !== "manager";
    if (item.id === "approvals") return viewer.role === "admin" || Boolean(viewer.permissions?.approveEmail);
    if (item.id === "brands") return viewer.role === "admin" || viewer.role === "manager";
    if (item.id === "rules") return viewer.role === "admin" || viewer.role === "manager";
    if (item.id === "campaigns") return viewer.role === "admin" || viewer.role === "manager";
    if (item.id === "offers") return viewer.role === "admin" || viewer.role === "creator";
    if (item.id === "gifts") return viewer.role === "admin" || viewer.role === "creator";
    if (item.id === "review") return viewer.role === "admin";
    if (item.id === "access") return viewer.role === "admin" || viewer.role === "manager";
    if (item.id === "prospects" || item.id === "dashboard" || item.id === "ranking" || item.id === "reports" || item.id === "bench") return viewer.role === "admin";
    if (item.id === "pipeline") return viewer.role === "admin";
    if (item.id === "kit") return viewer.role === "creator";
    return true;
  });
}
