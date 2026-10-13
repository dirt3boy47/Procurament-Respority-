"use client";

import Link from "next/link";
import { Download, Mail, Phone, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv } from "@/lib/csv";
import type { Tables } from "@/lib/database.types";

const compareLot = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

export function LandholderList({
  landholders,
  lotsByLandholder,
}: {
  landholders: Tables<"landholders">[];
  lotsByLandholder: Record<string, string[]>;
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return landholders.filter((h) => {
      const hay = [h.name, h.phone, h.email, h.postal_address, ...(lotsByLandholder[h.id] ?? [])].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [landholders, lotsByLandholder, q]);

  const lotsOf = (id: string) => [...(lotsByLandholder[id] ?? [])].sort(compareLot);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-fg" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, email or lot…"
          className="pl-9"
          aria-label="Search landholders"
        />
      </div>
      <div className="flex items-center justify-between text-sm text-muted-fg">
        <span>
          {rows.length} of {landholders.length} landholders
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            downloadCsv(
              "landholder-register.csv",
              ["Name", "Phone", "Email", "Postal Address", "Lots", "Notes"],
              rows.map((h) => [h.name, h.phone, h.email, h.postal_address, lotsOf(h.id).join(", "), h.notes]),
            )
          }
        >
          <Download /> Export CSV
        </Button>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {rows.map((h) => {
          const lots = lotsOf(h.id);
          return (
            <li key={h.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link href={`/landholders/${h.id}`} className="font-medium text-primary hover:underline">
                  {h.name}
                </Link>
                <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-fg">
                  {h.phone && (
                    <a href={`tel:${h.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:underline">
                      <Phone className="size-3" /> {h.phone}
                    </a>
                  )}
                  {h.email && (
                    <a href={`mailto:${h.email}`} className="inline-flex items-center gap-1 hover:underline">
                      <Mail className="size-3" /> {h.email}
                    </a>
                  )}
                  {h.postal_address && <span>{h.postal_address}</span>}
                </div>
              </div>
              <div className="text-sm text-muted-fg sm:text-right">
                {lots.length === 0 ? "No lots" : `${lots.length} lot${lots.length === 1 ? "" : "s"}: ${lots.slice(0, 4).join(", ")}${lots.length > 4 ? "…" : ""}`}
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-fg">No landholders match.</li>}
      </ul>
    </div>
  );
}
