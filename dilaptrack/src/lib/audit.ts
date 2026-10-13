import type { Json, Tables } from "@/lib/database.types";

export type AuditEntry = Tables<"audit_log">;

const TABLE_NAMES: Record<string, string> = {
  lots: "lot",
  surveys: "survey",
  defects: "defect",
  reinstatement_items: "reinstatement item",
  attachments: "file",
  profiles: "user",
};

const FIELD_NAMES: Record<string, string> = {
  lot_number: "lot number",
  landholder_contact: "landholder contact",
  assigned_engineer: "assigned engineer",
  landholder_signoff_date: "landholder acceptance date",
  landholder_signoff_name: "accepted by (name)",
  landholder_signoff_notes: "acceptance notes",
  survey_date: "survey date",
  assigned_to: "assigned to",
  due_date: "due date",
  required_works: "required works",
  completion_date: "completion date",
  landholder_accepted: "landholder accepted",
  landholder_accepted_date: "acceptance date",
  closed_by: "closed by",
  full_name: "name",
};

export const fieldName = (f: string) => FIELD_NAMES[f] ?? f.replace(/_/g, " ");

function get(data: Json | null, key: string): Json | undefined {
  return data && typeof data === "object" && !Array.isArray(data) ? data[key] : undefined;
}

/** A short sentence such as "updated the status of a defect". */
export function describeChange(entry: AuditEntry) {
  const noun = TABLE_NAMES[entry.table_name] ?? entry.table_name;
  const data = entry.new_data ?? entry.old_data;
  if (entry.table_name === "surveys" && entry.action === "UPDATE") {
    return `updated a survey (${(entry.changed_fields ?? []).map(fieldName).join(", ")})`;
  }
  if (entry.table_name === "attachments") {
    const name = get(data, "file_name");
    if (entry.action === "INSERT") return `uploaded ${typeof name === "string" ? name : "a file"}`;
    if (entry.action === "DELETE") return `deleted ${typeof name === "string" ? name : "a file"}`;
  }
  if (entry.table_name === "lots" && entry.action === "UPDATE" && entry.changed_fields?.includes("status")) {
    const status = get(entry.new_data, "status");
    if (status === "closed") return "closed the lot";
    if (get(entry.old_data, "status") === "closed") return "reopened the lot";
  }
  switch (entry.action) {
    case "INSERT":
      return `added a ${noun}`;
    case "DELETE":
      return `deleted a ${noun}`;
    default:
      return `updated a ${noun} (${(entry.changed_fields ?? []).map(fieldName).join(", ")})`;
  }
}

/** Format an audit value for display. */
export function formatValue(value: Json | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  // Enum values such as "in_progress" read better as "in progress".
  if (typeof value === "string") return /^[a-z]+(_[a-z]+)+$/.test(value) ? value.replace(/_/g, " ") : value;
  return JSON.stringify(value);
}
