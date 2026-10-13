import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  accent = "text-primary",
  progress,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: LucideIcon;
  href?: string;
  accent?: string;
  /** 0–100, shows a thin bar */
  progress?: number;
}) {
  const body = (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-fg">{label}</span>
        <Icon className={cn("size-5", accent)} aria-hidden />
      </div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      {progress !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {detail && <div className="text-xs text-muted-fg">{detail}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block focus-visible:outline-2 focus-visible:outline-ring rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}
