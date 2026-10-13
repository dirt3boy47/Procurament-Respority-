"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { cn } from "@/lib/utils";

export function LotTabs({ lotId, openDefects, openReinstatement }: { lotId: string; openDefects: number; openReinstatement: number }) {
  const segments = useSelectedLayoutSegments();
  const current = segments.join("/");
  const tabs = [
    { href: "", label: "Overview" },
    { href: "surveys/pre-construction", label: "Pre-Con Survey" },
    { href: "surveys/post-construction", label: "Post-Con Survey" },
    { href: "defects", label: "Defects", count: openDefects },
    { href: "reinstatement", label: "Reinstatement", count: openReinstatement },
    { href: "files", label: "Files" },
    { href: "closeout", label: "Close-out" },
    { href: "history", label: "History" },
  ];
  return (
    <nav aria-label="Lot sections" className="no-print -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = current === t.href;
          return (
            <li key={t.href}>
              <Link
                href={`/lots/${lotId}${t.href ? `/${t.href}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-fg hover:text-fg",
                )}
              >
                {t.label}
                {t.count ? (
                  <span className="rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                    {t.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
