"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Capabilities } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { isActive, navItems } from "./nav";

/** Sidebar links (desktop). */
export function SidebarNav({ can }: { can: Capabilities }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {navItems(can).map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary/10 text-primary" : "text-muted-fg hover:bg-muted hover:text-fg",
            )}
          >
            <Icon className="size-4.5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar (phones). */
export function MobileTabBar({ can }: { can: Capabilities }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {navItems(can)
          .filter((i) => i.mobile)
          .map(({ href, short, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-fg",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {short}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
