"use client";

import Link from "next/link";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DEFECT_PRIORITIES, DEFECT_STATUSES, labelFor, REINSTATEMENT_STATUSES } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import type { Tables } from "@/lib/database.types";
import { defectRef, formatDate, isOverdue, reinstatementRef } from "@/lib/format";

type LotInfo = { lot_number: string; address: string | null };
type Lots = Record<string, LotInfo>;

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-fg" aria-hidden />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label="Search" />
    </div>
  );
}

const includesAll = (hay: (string | null | undefined)[], q: string) => {
  const text = hay.join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => text.includes(w));
};

export function DefectRegister({ defects, lots }: { defects: Tables<"defects">[]; lots: Lots }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("not_closed");
  const [priority, setPriority] = useState("");
  const [assigned, setAssigned] = useState("");
  const assignees = useMemo(() => [...new Set(defects.map((d) => d.assigned_to).filter(Boolean) as string[])].sort(), [defects]);

  const rows = useMemo(
    () =>
      defects
        .filter((d) => {
          if (status === "not_closed" ? d.status === "closed" : status === "overdue" ? !isOverdue(d.due_date, d.status === "closed") : status && d.status !== status)
            return false;
          if (priority && d.priority !== priority) return false;
          if (assigned && d.assigned_to !== assigned) return false;
          return !q || includesAll([defectRef(d.ref), d.description, d.assigned_to, d.notes, lots[d.lot_id]?.lot_number, lots[d.lot_id]?.address], q);
        })
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
    [defects, lots, q, status, priority, assigned],
  );

  function exportCsv() {
    downloadCsv(
      "defects-register.csv",
      ["Ref", "Lot", "Description", "Priority", "Status", "Assigned To", "Due Date", "Raised", "Closed", "Notes"],
      rows.map((d) => [
        defectRef(d.ref),
        lots[d.lot_id]?.lot_number,
        d.description,
        labelFor(DEFECT_PRIORITIES, d.priority),
        labelFor(DEFECT_STATUSES, d.status),
        d.assigned_to,
        d.due_date,
        d.created_at.slice(0, 10),
        d.closed_at?.slice(0, 10),
        d.notes,
      ]),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row">
        <SearchBox value={q} onChange={setQ} placeholder="Search description, lot, ref…" />
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="not_closed">Not closed</option>
            <option value="overdue">Overdue</option>
            <option value="">All statuses</option>
            {DEFECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
            <option value="">All priorities</option>
            {DEFECT_PRIORITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={assigned} onChange={(e) => setAssigned(e.target.value)} aria-label="Assigned to">
            <option value="">Anyone</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-fg">
        <span>
          {rows.length} of {defects.length} defects
        </span>
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download /> Export CSV
        </Button>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {rows.map((d) => {
          const overdue = isOverdue(d.due_date, d.status === "closed");
          return (
            <li key={d.id}>
              <Link href={`/lots/${d.lot_id}/defects#${d.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-muted sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.description}</p>
                  <p className="text-xs text-muted-fg">
                    {defectRef(d.ref)} · Lot {lots[d.lot_id]?.lot_number ?? "?"}
                    {lots[d.lot_id]?.address && ` · ${lots[d.lot_id].address}`}
                    {d.assigned_to && ` · ${d.assigned_to}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.due_date && (
                    <span className={overdue ? "text-xs font-medium text-red-600 dark:text-red-400" : "text-xs text-muted-fg"}>
                      Due {formatDate(d.due_date)}
                    </span>
                  )}
                  <StatusBadge options={DEFECT_PRIORITIES} value={d.priority} />
                  <StatusBadge options={DEFECT_STATUSES} value={d.status} />
                </div>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-fg">No defects match.</li>}
      </ul>
    </div>
  );
}

export function ReinstatementRegister({ items, lots }: { items: Tables<"reinstatement_items">[]; lots: Lots }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("not_complete");
  const [acceptance, setAcceptance] = useState("");

  const rows = useMemo(
    () =>
      items.filter((r) => {
        if (status === "not_complete" ? r.status === "complete" : status && r.status !== status) return false;
        if (acceptance === "accepted" && !r.landholder_accepted) return false;
        if (acceptance === "awaiting" && r.landholder_accepted) return false;
        return !q || includesAll([reinstatementRef(r.ref), r.required_works, r.notes, lots[r.lot_id]?.lot_number, lots[r.lot_id]?.address], q);
      }),
    [items, lots, q, status, acceptance],
  );

  function exportCsv() {
    downloadCsv(
      "reinstatement-register.csv",
      ["Ref", "Lot", "Required Works", "Status", "Completion Date", "Landholder Accepted", "Accepted Date", "Notes"],
      rows.map((r) => [
        reinstatementRef(r.ref),
        lots[r.lot_id]?.lot_number,
        r.required_works,
        labelFor(REINSTATEMENT_STATUSES, r.status),
        r.completion_date,
        r.landholder_accepted ? "Yes" : "No",
        r.landholder_accepted_date,
        r.notes,
      ]),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row">
        <SearchBox value={q} onChange={setQ} placeholder="Search works, lot, ref…" />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="not_complete">Not complete</option>
            <option value="">All statuses</option>
            {REINSTATEMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={acceptance} onChange={(e) => setAcceptance(e.target.value)} aria-label="Landholder acceptance">
            <option value="">Any acceptance</option>
            <option value="accepted">Landholder accepted</option>
            <option value="awaiting">Awaiting acceptance</option>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-fg">
        <span>
          {rows.length} of {items.length} items
        </span>
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download /> Export CSV
        </Button>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/lots/${r.lot_id}/reinstatement#${r.id}`}
              className="flex flex-col gap-2 px-4 py-3 hover:bg-muted sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.required_works}</p>
                <p className="text-xs text-muted-fg">
                  {reinstatementRef(r.ref)} · Lot {lots[r.lot_id]?.lot_number ?? "?"}
                  {r.completion_date && ` · Completed ${formatDate(r.completion_date)}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r.landholder_accepted ? <Badge tone="green">Accepted</Badge> : <Badge tone="gray">Awaiting acceptance</Badge>}
                <StatusBadge options={REINSTATEMENT_STATUSES} value={r.status} />
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-fg">No items match.</li>}
      </ul>
    </div>
  );
}
