import type { Enums } from "@/lib/database.types";

export type Tone = "gray" | "blue" | "amber" | "green" | "red" | "purple";

type Option<T extends string> = { value: T; label: string; tone: Tone };

export const ROLES: Option<Enums<"app_role">>[] = [
  { value: "admin", label: "Administrator", tone: "purple" },
  { value: "project_manager", label: "Project Manager", tone: "blue" },
  { value: "site_engineer", label: "Site Engineer", tone: "green" },
  { value: "read_only", label: "Read Only", tone: "gray" },
];

export const LOT_STATUSES: Option<Enums<"lot_status">>[] = [
  { value: "not_started", label: "Not started", tone: "gray" },
  { value: "in_progress", label: "In progress", tone: "blue" },
  { value: "on_hold", label: "On hold", tone: "amber" },
  { value: "closed", label: "Closed", tone: "green" },
];

export const SURVEY_STATUSES: Option<Enums<"survey_status">>[] = [
  { value: "not_started", label: "Not started", tone: "gray" },
  { value: "scheduled", label: "Scheduled", tone: "purple" },
  { value: "in_progress", label: "In progress", tone: "blue" },
  { value: "complete", label: "Complete", tone: "green" },
];

export const DEFECT_PRIORITIES: Option<Enums<"defect_priority">>[] = [
  { value: "low", label: "Low", tone: "gray" },
  { value: "medium", label: "Medium", tone: "blue" },
  { value: "high", label: "High", tone: "amber" },
  { value: "critical", label: "Critical", tone: "red" },
];

export const DEFECT_STATUSES: Option<Enums<"defect_status">>[] = [
  { value: "open", label: "Open", tone: "red" },
  { value: "in_progress", label: "In progress", tone: "amber" },
  { value: "closed", label: "Closed", tone: "green" },
];

export const REINSTATEMENT_STATUSES: Option<Enums<"reinstatement_status">>[] = [
  { value: "not_started", label: "Not started", tone: "gray" },
  { value: "in_progress", label: "In progress", tone: "amber" },
  { value: "complete", label: "Complete", tone: "green" },
];

/** File folders, in the order they appear under each lot. `slug` is the storage folder name. */
export const FILE_CATEGORIES: { value: Enums<"file_category">; label: string; slug: string }[] = [
  { value: "pre_construction", label: "Pre-Construction", slug: "pre-construction" },
  { value: "post_construction", label: "Post-Construction", slug: "post-construction" },
  { value: "defects", label: "Defects", slug: "defects" },
  { value: "reinstatement", label: "Reinstatement", slug: "reinstatement" },
  { value: "closeout", label: "Closeout", slug: "closeout" },
];

export const SURVEY_TYPES: { value: Enums<"survey_type">; label: string; slug: string }[] = [
  { value: "pre_construction", label: "Pre-Construction Survey", slug: "pre-construction" },
  { value: "post_construction", label: "Post-Construction Survey", slug: "post-construction" },
];

export function optionFor<T extends string>(options: Option<T>[], value: T | null | undefined): Option<T> {
  return options.find((o) => o.value === value) ?? { value: (value ?? "") as T, label: value ?? "—", tone: "gray" };
}

export function labelFor<T extends string>(options: { value: T; label: string }[], value: T | null | undefined) {
  return options.find((o) => o.value === value)?.label ?? value ?? "—";
}
