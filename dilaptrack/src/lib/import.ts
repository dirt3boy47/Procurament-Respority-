// Lot import: map spreadsheet columns to lot fields and validate rows before
// anything is written. Pure functions, shared by the import page and tests.
import type { Enums } from "@/lib/database.types";

export type ImportField =
  | "lot_number"
  | "address"
  | "landholder"
  | "landholder_contact"
  | "chainage"
  | "status"
  | "assigned_engineer"
  | "notes";

export const IMPORT_FIELDS: { key: ImportField; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "lot_number", label: "Lot Number", required: true, aliases: ["lot", "lotno", "lotnumber", "lotid", "lotref", "property", "propertyid", "propertyno"] },
  { key: "address", label: "Property Address", aliases: ["address", "propertyaddress", "streetaddress", "location", "siteaddress"] },
  { key: "landholder", label: "Landholder", aliases: ["landholder", "landowner", "owner", "ownername", "landholdername", "occupier", "resident"] },
  { key: "landholder_contact", label: "Landholder Contact", aliases: ["contact", "phone", "mobile", "email", "landholdercontact", "contactdetails", "ownercontact"] },
  { key: "chainage", label: "Chainage", aliases: ["chainage", "ch", "chainagem", "kp", "chainagefrom", "startchainage"] },
  { key: "status", label: "Status", aliases: ["status", "lotstatus"] },
  { key: "assigned_engineer", label: "Assigned Engineer", aliases: ["engineer", "assignedengineer", "siteengineer", "assignedto", "responsible"] },
  { key: "notes", label: "Notes", aliases: ["notes", "comments", "remarks", "note", "comment"] },
];

export const MAX_IMPORT_ROWS = 2000;

/** Column index -> field (or null to ignore the column). */
export type ColumnMapping = (ImportField | null)[];

export type ImportRow = {
  /** Spreadsheet row number (1-based, including the header row). */
  rowNumber: number;
  values: Record<ImportField, string>;
  state: "ready" | "exists" | "error";
  messages: string[];
};

export type ImportLot = { [K in ImportField]: K extends "status" ? Enums<"lot_status"> : string };

const normaliseHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Guess which lot field each column holds from its heading. */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const used = new Set<ImportField>();
  const mapping: ColumnMapping = headers.map(() => null);
  // Exact alias matches first, then "heading contains alias" for the rest.
  for (const pass of ["exact", "contains"] as const) {
    headers.forEach((header, i) => {
      if (mapping[i]) return;
      const h = normaliseHeader(header);
      if (!h) return;
      const field = IMPORT_FIELDS.find(
        (f) =>
          !used.has(f.key) &&
          (pass === "exact"
            ? f.aliases.includes(h) || normaliseHeader(f.label) === h
            : f.aliases.some((a) => a.length > 3 && h.includes(a))),
      );
      if (field) {
        mapping[i] = field.key;
        used.add(field.key);
      }
    });
  }
  return mapping;
}

/** Turn a cell from CSV / Excel into trimmed text. Excel dates become YYYY-MM-DD. */
export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
  return String(value).replace(/\s+/g, " ").trim();
}

const STATUS_ALIASES: Record<string, Enums<"lot_status">> = {
  "": "not_started",
  notstarted: "not_started",
  pending: "not_started",
  new: "not_started",
  open: "in_progress",
  inprogress: "in_progress",
  active: "in_progress",
  started: "in_progress",
  onhold: "on_hold",
  hold: "on_hold",
};

/** Parse a status cell. Returns null if it isn't recognised. */
export function parseLotStatus(value: string): Enums<"lot_status"> | null {
  return STATUS_ALIASES[normaliseHeader(value)] ?? null;
}

const lotKey = (lotNumber: string) => lotNumber.trim().toLowerCase();

/**
 * Validate data rows (header row excluded) against the column mapping and the
 * lot numbers already in the register.
 */
export function validateRows(
  rows: unknown[][],
  mapping: ColumnMapping,
  existingLotNumbers: string[],
  firstRowNumber = 2,
): ImportRow[] {
  const existing = new Set(existingLotNumbers.map(lotKey));
  const seen = new Map<string, number>();
  const result: ImportRow[] = [];

  rows.forEach((cells, index) => {
    const rowNumber = firstRowNumber + index;
    const text = cells.map(cellToString);
    if (text.every((c) => c === "")) return; // blank line

    const values = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, ""])) as Record<ImportField, string>;
    mapping.forEach((field, col) => {
      if (field) values[field] = values[field] ? `${values[field]} ${text[col] ?? ""}`.trim() : (text[col] ?? "");
    });

    const messages: string[] = [];
    let state: ImportRow["state"] = "ready";

    if (!values.lot_number) {
      messages.push("Lot number is missing");
      state = "error";
    } else if (values.lot_number.length > 50) {
      messages.push("Lot number is longer than 50 characters");
      state = "error";
    }

    if (values.status) {
      const normalised = normaliseHeader(values.status);
      if (normalised === "closed" || normalised === "complete" || normalised === "completed") {
        messages.push("Lots can't be imported as closed — close them in DilapTrack once close-out is complete");
        state = "error";
      } else if (!parseLotStatus(values.status)) {
        messages.push(`Unknown status "${values.status}" (use Not started, In progress or On hold)`);
        state = "error";
      }
    }

    if (values.lot_number && state !== "error") {
      const key = lotKey(values.lot_number);
      const firstRow = seen.get(key);
      if (firstRow !== undefined) {
        messages.push(`Duplicate of row ${firstRow} in this file`);
        state = "error";
      } else if (existing.has(key)) {
        messages.push("Already in the register — will be skipped");
        state = "exists";
      }
    }
    if (values.lot_number && !seen.has(lotKey(values.lot_number))) seen.set(lotKey(values.lot_number), rowNumber);

    result.push({ rowNumber, values, state, messages });
  });

  return result;
}

/** The rows to send to the database. */
export function rowsToImport(rows: ImportRow[]): ImportLot[] {
  return rows
    .filter((r) => r.state === "ready")
    .map((r) => ({ ...r.values, status: parseLotStatus(r.values.status) ?? "not_started" }));
}

/** First non-blank row is treated as the header row. */
export function splitHeader(table: unknown[][]): { headers: string[]; body: unknown[][]; headerRowNumber: number } {
  const index = table.findIndex((r) => r.some((c) => cellToString(c) !== ""));
  if (index === -1) return { headers: [], body: [], headerRowNumber: 1 };
  return { headers: table[index].map(cellToString), body: table.slice(index + 1), headerRowNumber: index + 1 };
}
