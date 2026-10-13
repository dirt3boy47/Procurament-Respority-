"use client";

import Link from "next/link";
import { ChevronDown, History, LogOut, UserRound, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/actions/auth";
import { labelFor, ROLES } from "@/lib/constants";
import type { Capabilities, Role } from "@/lib/permissions";
import { ThemeToggle } from "./theme-toggle";

export function UserMenu({ name, email, role, can }: { name: string; email: string; role: Role; can: Capabilities }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-muted"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-40 truncate text-sm font-medium leading-tight">{name}</span>
          <span className="block text-xs leading-tight text-muted-fg">{labelFor(ROLES, role)}</span>
        </span>
        <ChevronDown className="size-4 text-muted-fg" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-lg"
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-fg">{email}</p>
          </div>
          <div className="my-1 border-t border-border" />
          <Link role="menuitem" href="/account" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
            <UserRound className="size-4" /> My account
          </Link>
          {can.manage && (
            <Link role="menuitem" href="/audit" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted lg:hidden">
              <History className="size-4" /> Audit log
            </Link>
          )}
          {can.admin && (
            <Link role="menuitem" href="/admin/users" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted lg:hidden">
              <Users className="size-4" /> Users
            </Link>
          )}
          <div className="flex items-center justify-between px-2 py-2 text-sm">
            <span>Theme</span>
            <ThemeToggle />
          </div>
          <div className="my-1 border-t border-border" />
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-muted dark:text-red-400"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
