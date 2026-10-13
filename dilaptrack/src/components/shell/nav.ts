import { Contact, FileBarChart, History, LayoutDashboard, MapPinned, Users, type LucideIcon } from "lucide-react";
import type { Capabilities } from "@/lib/permissions";

export type NavItem = { href: string; label: string; short: string; icon: LucideIcon; mobile?: boolean };

export function navItems(can: Capabilities): NavItem[] {
  const items: NavItem[] = [
    { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, mobile: true },
    { href: "/lots", label: "Lots", short: "Lots", icon: MapPinned, mobile: true },
    { href: "/landholders", label: "Landholders", short: "Owners", icon: Contact, mobile: true },
    { href: "/reports", label: "Reports", short: "Reports", icon: FileBarChart, mobile: true },
  ];
  if (can.manage) items.push({ href: "/audit", label: "Audit Log", short: "Audit", icon: History });
  if (can.admin) items.push({ href: "/admin/users", label: "Users", short: "Users", icon: Users });
  return items;
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
