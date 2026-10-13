"use client";

import Link from "next/link";
import Papa from "papaparse";
import { AlertCircle, CheckCircle2, FileSpreadsheet, MinusCircle, Upload } from "lucide-react";
import { useMemo, useState, useTransition, type DragEvent } from "react";
import { toast } from "sonner";
import { importLots } from "@/actions/lots";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { downloadCsv } from "@/lib/csv";
import {
  autoMapColumns,
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  rowsToImport,
  splitHeader,
  validateRows,
  type ColumnMapping,
  type ImportField,
} from "@/lib/import";
import { cn } from "@/lib/utils";

type Sheet = { fileName: string; headers: string[]; body: unknown[][]; headerRowNumber: number };
type Result = { inserted: number; newLandholders: number; skipped: string[] };

async function readTable(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
    if (parsed.errors.length && parsed.data.length === 0) throw new Error(parsed.errors[0].message);
    return parsed.data;
  }
  if (name.endsWith(".xls")) throw new Error("Old .xls files aren't supported. In Excel, use File → Save As → .xlsx or CSV.");
  throw new Error("Choose an .xlsx or .csv file.");
}

function downloadTemplate() {
  downloadCsv(
    "dilaptrack-lot-import-template.csv",
    IMPORT_FIELDS.map((f) => f.label),
    [
      ["LOT-001", "12 Example Road, Townsville", "J & K Smith", "0400 000 000", "1+250", "Not started", "Alex Engineer", "Gate code 1234"],
      ["LOT-002", "14 Example Road, Townsville", "Example Pty Ltd", "owner@example.com", "1+410", "", "", ""],
    ],
  );
}

export function LotImporter({ existingLotNumbers }: { existingLotNumbers: string[] }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [show, setShow] = useState<"all" | "error" | "ready">("all");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(
    () => (sheet ? validateRows(sheet.body, mapping, existingLotNumbers, sheet.headerRowNumber + 1) : []),
    [sheet, mapping, existingLotNumbers],
  );
  const counts = useMemo(
    () => ({
      ready: rows.filter((r) => r.state === "ready").length,
      exists: rows.filter((r) => r.state === "exists").length,
      error: rows.filter((r) => r.state === "error").length,
    }),
    [rows],
  );
  const mappedFields = mapping.filter((m): m is ImportField => Boolean(m));
  const hasLotColumn = mappedFields.includes("lot_number");

  async function loadFile(file: File | undefined) {
    if (!file) return;
    try {
      const table = await readTable(file);
      const { headers, body, headerRowNumber } = splitHeader(table);
      if (headers.length === 0) throw new Error("The file is empty.");
      if (body.length > MAX_IMPORT_ROWS) throw new Error(`The file has more than ${MAX_IMPORT_ROWS} rows.`);
      setSheet({ fileName: file.name, headers, body, headerRowNumber });
      setMapping(autoMapColumns(headers));
      setResult(null);
      setShow("all");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't read that file.");
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void loadFile(e.dataTransfer.files[0]);
  }

  function runImport() {
    startTransition(async () => {
      const res = await importLots(rowsToImport(rows));
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setResult({ inserted: res.inserted ?? 0, newLandholders: res.newLandholders ?? 0, skipped: res.skipped ?? [] });
    });
  }

  if (result) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <p className="text-lg font-semibold">
            {result.inserted} lot{result.inserted === 1 ? "" : "s"} imported
          </p>
          {result.newLandholders > 0 && (
            <p className="text-sm text-muted-fg">
              {result.newLandholders} new landholder{result.newLandholders === 1 ? " was" : "s were"} added to the landholder register.
            </p>
          )}
          {result.skipped.length > 0 && (
            <p className="max-w-lg text-sm text-muted-fg">
              Skipped because they already exist: {result.skipped.join(", ")}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <ButtonLink href="/lots">View lot register</ButtonLink>
            <Button variant="secondary" onClick={() => (setSheet(null), setResult(null))}>
              Import another file
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const visible = rows.filter((r) => show === "all" || (show === "ready" ? r.state === "ready" : r.state === "error"));

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-4 py-8 text-center",
              dragging && "border-primary bg-primary/5",
            )}
          >
            <FileSpreadsheet className="size-10 text-muted-fg" />
            {sheet ? (
              <p className="text-sm">
                <span className="font-medium">{sheet.fileName}</span> — {rows.length} rows
              </p>
            ) : (
              <p className="text-sm text-muted-fg">Drop an Excel or CSV file here</p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover">
                <Upload className="size-4" /> {sheet ? "Choose a different file" : "Choose file"}
                <input
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(e) => {
                    void loadFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button variant="secondary" onClick={downloadTemplate}>
                Download template
              </Button>
            </div>
            <p className="max-w-xl text-xs text-muted-fg">
              The first row should hold column headings. Recognised columns:{" "}
              {IMPORT_FIELDS.map((f) => f.label).join(", ")}. Only Lot Number is required. Lot numbers already in
              the register are skipped, never overwritten. Landholders are matched to the landholder register by name;
              new names are added to it (with the contact, if given).
            </p>
          </div>
        </CardContent>
      </Card>

      {sheet && (
        <Card>
          <CardHeader title="1. Check the columns" description="We've matched your headings to lot fields. Change any that are wrong." />
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sheet.headers.map((header, i) => (
                <label key={i} className="flex flex-col gap-1 text-sm">
                  <span className="truncate font-medium" title={header}>
                    {header || `Column ${i + 1}`}
                  </span>
                  <Select
                    value={mapping[i] ?? ""}
                    onChange={(e) => {
                      const value = (e.target.value || null) as ImportField | null;
                      setMapping((prev) => prev.map((m, j) => (j === i ? value : m === value ? null : m)));
                    }}
                  >
                    <option value="">Don&apos;t import</option>
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
            {!hasLotColumn && (
              <p className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="size-4" /> Choose which column holds the Lot Number.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {sheet && hasLotColumn && (
        <Card>
          <CardHeader
            title="2. Review and import"
            description={
              <span className="flex flex-wrap gap-2 pt-1">
                <Badge tone="green">{counts.ready} ready</Badge>
                <Badge tone="gray">{counts.exists} already exist</Badge>
                <Badge tone="red">{counts.error} with problems</Badge>
              </span>
            }
            actions={
              <>
                <Select value={show} onChange={(e) => setShow(e.target.value as typeof show)} className="h-8 w-auto" aria-label="Show rows">
                  <option value="all">All rows</option>
                  <option value="ready">Ready</option>
                  <option value="error">Problems</option>
                </Select>
                <Button onClick={runImport} disabled={pending || counts.ready === 0}>
                  {pending ? "Importing…" : `Import ${counts.ready} lot${counts.ready === 1 ? "" : "s"}`}
                </Button>
              </>
            }
          />
          {counts.error > 0 && (
            <p className="border-b border-border bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-5 dark:bg-amber-950 dark:text-amber-300">
              Rows with problems won&apos;t be imported. Fix them in the spreadsheet and upload it again, or import the
              ready rows now.
            </p>
          )}
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-card text-left text-xs font-medium tracking-wide text-muted-fg uppercase">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Result</th>
                  {IMPORT_FIELDS.filter((f) => mappedFields.includes(f.key)).map((f) => (
                    <th key={f.key} className="px-3 py-2 whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((r) => (
                  <tr key={r.rowNumber} className={r.state === "error" ? "bg-red-50/60 dark:bg-red-950/30" : undefined}>
                    <td className="px-3 py-2 text-muted-fg tabular-nums">{r.rowNumber}</td>
                    <td className="min-w-48 px-3 py-2">
                      <span className="flex items-start gap-1.5">
                        {r.state === "ready" ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        ) : r.state === "exists" ? (
                          <MinusCircle className="mt-0.5 size-4 shrink-0 text-muted-fg" />
                        ) : (
                          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                        )}
                        <span className={r.state === "error" ? "text-red-700 dark:text-red-300" : "text-muted-fg"}>
                          {r.messages.join("; ") || "Ready"}
                        </span>
                      </span>
                    </td>
                    {IMPORT_FIELDS.filter((f) => mappedFields.includes(f.key)).map((f) => (
                      <td key={f.key} className="max-w-60 truncate px-3 py-2" title={r.values[f.key]}>
                        {r.values[f.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-sm text-muted-fg">
        Prefer to add lots one at a time?{" "}
        <Link href="/lots/new" className="text-primary hover:underline">
          Create a lot
        </Link>
        .
      </p>
    </div>
  );
}
