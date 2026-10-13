import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  Hammer,
  Hourglass,
  MapPinned,
  Upload,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireSession } from "@/lib/auth";
import { DEFECT_PRIORITIES, LOT_STATUSES } from "@/lib/constants";
import { listLots } from "@/lib/data";
import { defectRef, formatDate, formatDateTime, isOverdue } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { describeChange } from "@/lib/audit";

export const metadata: Metadata = { title: "Dashboard" };

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

const STATUS_BAR: Record<string, string> = {
  not_started: "bg-slate-400 dark:bg-slate-500",
  in_progress: "bg-blue-500",
  on_hold: "bg-amber-500",
  closed: "bg-emerald-500",
};

export default async function DashboardPage() {
  const { can } = await requireSession();
  const supabase = await createClient();
  const [lots, defectsRes, activityRes] = await Promise.all([
    listLots(),
    supabase
      .from("defects")
      .select("id, ref, lot_id, description, priority, status, due_date, assigned_to")
      .neq("status", "closed"),
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(8),
  ]);
  const openDefects = defectsRes.data ?? [];
  const activity = activityRes.data ?? [];
  const lotById = new Map(lots.map((l) => [l.id, l]));

  const total = lots.length;
  const preDone = lots.filter((l) => l.pre_survey_status === "complete").length;
  const postDone = lots.filter((l) => l.post_survey_status === "complete").length;
  const openDefectCount = lots.reduce((s, l) => s + l.open_defects, 0);
  const openReinstatement = lots.reduce((s, l) => s + l.open_reinstatement, 0);
  const closed = lots.filter((l) => l.status === "closed").length;
  const ready = lots.filter((l) => l.ready_to_close && l.status !== "closed");
  const overdue = openDefects.filter((d) => isOverdue(d.due_date, false));
  const urgent = openDefects
    .filter((d) => d.priority === "critical" || d.priority === "high" || isOverdue(d.due_date, false))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 8);

  if (total === 0) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <EmptyState
            icon={MapPinned}
            title="No lots yet"
            action={
              can.manage && (
                <div className="flex gap-2">
                  <ButtonLink href="/lots/import">
                    <Upload /> Import lots
                  </ButtonLink>
                  <ButtonLink href="/lots/new" variant="secondary">
                    Add a lot
                  </ButtonLink>
                </div>
              )
            }
          >
            {can.manage
              ? "Import your lot register from Excel or CSV to get started."
              : "Lots will appear here once a project manager adds them."}
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Dilapidation survey and close-out progress across the project." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total lots" value={total} icon={MapPinned} href="/lots" />
        <StatCard
          label="Pre-con surveys"
          value={preDone}
          detail={`${pct(preDone, total)}% of lots complete`}
          progress={pct(preDone, total)}
          icon={ClipboardCheck}
          href="/lots?pre=incomplete"
        />
        <StatCard
          label="Post-con surveys"
          value={postDone}
          detail={`${pct(postDone, total)}% of lots complete`}
          progress={pct(postDone, total)}
          icon={ClipboardCheck}
          href="/lots?post=incomplete"
        />
        <StatCard
          label="Open defects"
          value={openDefectCount}
          detail={overdue.length ? `${overdue.length} overdue` : "None overdue"}
          icon={ClipboardList}
          accent={openDefectCount ? "text-red-600 dark:text-red-400" : "text-emerald-600"}
          href="/defects"
        />
        <StatCard
          label="Open reinstatement"
          value={openReinstatement}
          detail="Items not yet complete"
          icon={Hammer}
          accent="text-amber-600 dark:text-amber-400"
          href="/reinstatement"
        />
        <StatCard
          label="Lots closed"
          value={closed}
          detail={`${pct(closed, total)}% of lots`}
          progress={pct(closed, total)}
          icon={CheckCircle2}
          accent="text-emerald-600"
          href="/lots?status=closed"
        />
        <StatCard
          label="Lots outstanding"
          value={total - closed}
          detail={ready.length ? `${ready.length} ready to close` : "Not yet closed"}
          icon={Hourglass}
          accent="text-muted-fg"
          href="/lots?status=open"
        />
      </div>

      <Card className="mt-5">
        <CardHeader title="Lots by status" />
        <CardContent>
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Lots by status">
            {LOT_STATUSES.map((s) => {
              const n = lots.filter((l) => l.status === s.value).length;
              return n ? (
                <div
                  key={s.value}
                  className={STATUS_BAR[s.value]}
                  style={{ width: `${(n / total) * 100}%` }}
                  title={`${s.label}: ${n}`}
                />
              ) : null;
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {LOT_STATUSES.map((s) => {
              const n = lots.filter((l) => l.status === s.value).length;
              return (
                <li key={s.value}>
                  <Link href={`/lots?status=${s.value}`} className="inline-flex items-center gap-2 hover:underline">
                    <span className={`size-2.5 rounded-full ${STATUS_BAR[s.value]}`} aria-hidden />
                    {s.label} <span className="font-semibold tabular-nums">{n}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Defects needing attention"
            description="High or critical priority, or past their due date."
            actions={
              <ButtonLink href="/defects" variant="ghost" size="sm">
                All defects
              </ButtonLink>
            }
          />
          {urgent.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing urgent" />
          ) : (
            <ul className="divide-y divide-border">
              {urgent.map((d) => {
                const lot = lotById.get(d.lot_id);
                return (
                  <li key={d.id}>
                    <Link href={`/lots/${d.lot_id}/defects#${d.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-muted sm:px-5">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.description}</p>
                        <p className="text-xs text-muted-fg">
                          {defectRef(d.ref)} · Lot {lot?.lot_number ?? "?"}
                          {d.assigned_to && ` · ${d.assigned_to}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge options={DEFECT_PRIORITIES} value={d.priority} />
                        {d.due_date && (
                          <span
                            className={
                              isOverdue(d.due_date, false) ? "text-xs font-medium text-red-600 dark:text-red-400" : "text-xs text-muted-fg"
                            }
                          >
                            Due {formatDate(d.due_date)}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          {ready.length > 0 && (
            <Card>
              <CardHeader title="Ready to close" description="All close-out conditions are met." />
              <ul className="flex flex-wrap gap-2 px-4 py-3 sm:px-5">
                {ready.map((l) => (
                  <li key={l.id}>
                    <Link href={`/lots/${l.id}/closeout`}>
                      <Badge tone="green">Lot {l.lot_number}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Recent activity" />
            {activity.length === 0 ? (
              <EmptyState icon={FolderOpen} title="No activity yet" />
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((a) => {
                  const lot = a.lot_id ? lotById.get(a.lot_id) : undefined;
                  return (
                    <li key={a.id} className="px-4 py-2.5 text-sm sm:px-5">
                      <p>
                        <span className="font-medium">{a.actor_name ?? "System"}</span> {describeChange(a)}
                        {lot && (
                          <>
                            {" "}
                            on{" "}
                            <Link href={`/lots/${lot.id}`} className="text-primary hover:underline">
                              Lot {lot.lot_number}
                            </Link>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-fg">{formatDateTime(a.created_at)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
