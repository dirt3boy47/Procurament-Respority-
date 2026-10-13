"use client";

import Link from "next/link";
import { Download, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ProgressDots } from "@/components/lots/progress";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { LOT_STATUSES, SURVEY_STATUSES } from "@/lib/constants";
import type { LotOverview } from "@/lib/data";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";

export type LotFilters = { q: string; status: string; engineer: string; pre: string; post: string; sort: string };

const compareLot = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

function matches(lot: LotOverview, f: LotFilters) {
  if (f.q) {
    const hay = [lot.lot_number, lot.address, lot.landholder_name, lot.chainage, lot.assigned_engineer].join(" ").toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every((word) => hay.includes(word))) return false;
  }
  if (f.status === "open") {
    if (lot.status === "closed") return false;
  } else if (f.status === "ready") {
    if (!lot.ready_to_close || lot.status === "closed") return false;
  } else if (f.status && lot.status !== f.status) {
    return false;
  }
  if (f.engineer && (lot.assigned_engineer ?? "") !== f.engineer) return false;
  if (f.pre === "incomplete" && lot.pre_survey_status === "complete") return false;
  if (f.post === "incomplete" && lot.post_survey_status === "complete") return false;
  return true;
}

export function LotRegister({ lots, initial }: { lots: LotOverview[]; initial: LotFilters }) {
  const [f, setF] = useState<LotFilters>(initial);
  const set = (patch: Partial<LotFilters>) => {
    const next = { ...f, ...patch };
    setF(next);
    // Keep filters in the URL so the view can be shared or bookmarked.
    const params = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    window.history.replaceState(null, "", params.size ? `?${params}` : window.location.pathname);
  };

  const engineers = useMemo(
    () => [...new Set(lots.map((l) => l.assigned_engineer).filter((e): e is string => Boolean(e)))].sort(),
    [lots],
  );

  const rows = useMemo(() => {
    const filtered = lots.filter((l) => matches(l, f));
    return f.sort === "chainage"
      ? filtered.sort((a, b) => (a.chainage_m ?? Infinity) - (b.chainage_m ?? Infinity) || compareLot(a.lot_number, b.lot_number))
      : filtered.sort((a, b) => compareLot(a.lot_number, b.lot_number));
  }, [lots, f]);

  const filtered = Object.entries(f).some(([k, v]) => k !== "sort" && v);

  function exportCsv() {
    downloadCsv(
      "lot-register.csv",
      ["Lot Number", "Property Address", "Landholder", "Landholder Phone", "Landholder Email", "Chainage", "Status", "Assigned Engineer", "Pre-Con Survey", "Pre-Con Date", "Post-Con Survey", "Post-Con Date", "Landholder Acceptance", "Notes"],
      rows.map((l) => [
        l.lot_number,
        l.address,
        l.landholder_name,
        l.landholder_phone,
        l.landholder_email,
        l.chainage,
        LOT_STATUSES.find((s) => s.value === l.status)?.label,
        l.assigned_engineer,
        SURVEY_STATUSES.find((s) => s.value === l.pre_survey_status)?.label,
        l.pre_survey_date,
        SURVEY_STATUSES.find((s) => s.value === l.post_survey_status)?.label,
        l.post_survey_date,
        l.landholder_signoff_date,
        l.notes,
      ]),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-fg" aria-hidden />
          <Input
            type="search"
            placeholder="Search lot, address, landholder, chainage…"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            className="pl-9"
            aria-label="Search lots"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <Select value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            <option value="open">Not closed</option>
            <option value="ready">Ready to close</option>
            {LOT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={f.engineer} onChange={(e) => set({ engineer: e.target.value })} aria-label="Engineer">
            <option value="">All engineers</option>
            {engineers.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <Select
            value={f.pre === "incomplete" ? "pre" : f.post === "incomplete" ? "post" : ""}
            onChange={(e) => set({ pre: e.target.value === "pre" ? "incomplete" : "", post: e.target.value === "post" ? "incomplete" : "" })}
            aria-label="Surveys"
          >
            <option value="">Any survey state</option>
            <option value="pre">Pre-con outstanding</option>
            <option value="post">Post-con outstanding</option>
          </Select>
          <Select value={f.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
            <option value="">Sort: lot number</option>
            <option value="chainage">Sort: chainage</option>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm text-muted-fg">
        <span>
          {rows.length} of {lots.length} lots
          {filtered && (
            <button
              type="button"
              className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
              onClick={() => set({ q: "", status: "", engineer: "", pre: "", post: "" })}
            >
              <X className="size-3.5" /> Clear filters
            </button>
          )}
        </span>
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download /> Export CSV
        </Button>
      </div>

      {/* Phones: cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((l) => (
          <li key={l.id}>
            <Link href={`/lots/${l.id}`} className="block rounded-xl border border-border bg-card p-3 shadow-sm active:bg-muted">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">Lot {l.lot_number}</p>
                  <p className="truncate text-sm text-muted-fg">{l.address ?? "No address"}</p>
                </div>
                <StatusBadge options={LOT_STATUSES} value={l.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-fg">
                {l.landholder_name && <span>{l.landholder_name}</span>}
                {l.chainage && <span>CH {l.chainage}</span>}
                <ProgressDots lot={l} />
                {l.landholder_signoff_date && <Badge tone="green">Accepted</Badge>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablets and up: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-fg uppercase">
            <tr>
              <th className="px-3 py-2.5">Lot</th>
              <th className="px-3 py-2.5">Address / Landholder</th>
              <th className="px-3 py-2.5">Chainage</th>
              <th className="px-3 py-2.5">Engineer</th>
              <th className="px-3 py-2.5">Pre-con</th>
              <th className="px-3 py-2.5">Post-con</th>
              <th className="px-3 py-2.5">Accepted</th>
              <th className="px-3 py-2.5">Close-out</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-muted/60">
                <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                  <Link href={`/lots/${l.id}`} className="text-primary hover:underline">
                    {l.lot_number}
                  </Link>
                </td>
                <td className="max-w-72 px-3 py-2.5">
                  <p className="truncate">{l.address ?? "—"}</p>
                  <p className="truncate text-xs text-muted-fg">{l.landholder_name ?? ""}</p>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{l.chainage ?? "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{l.assigned_engineer ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge options={SURVEY_STATUSES} value={l.pre_survey_status} />
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge options={SURVEY_STATUSES} value={l.post_survey_status} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {l.landholder_signoff_date ? formatDate(l.landholder_signoff_date) : <span className="text-muted-fg">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <ProgressDots lot={l} />
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge options={LOT_STATUSES} value={l.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-fg">No lots match these filters.</p>}
    </div>
  );
}
