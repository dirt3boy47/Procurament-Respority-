import type { Views } from "@/lib/database.types";

type Lot = Views<"lot_overview">;

export type ChecklistItem = { key: string; label: string; done: boolean; detail: string; href: string };

/** The three close-out conditions, in the order they're normally achieved. */
export function closeoutChecklist(lot: Lot): ChecklistItem[] {
  const base = `/lots/${lot.id}`;
  return [
    {
      key: "pre",
      label: "Pre-construction survey complete",
      done: lot.pre_survey_status === "complete",
      detail: lot.pre_survey_status === "complete" ? "Complete" : "Not complete",
      href: `${base}/surveys/pre-construction`,
    },
    {
      key: "post",
      label: "Post-construction survey complete",
      done: lot.post_survey_status === "complete",
      detail: lot.post_survey_status === "complete" ? "Complete" : "Not complete",
      href: `${base}/surveys/post-construction`,
    },
    {
      key: "acceptance",
      label: "Landholder acceptance recorded",
      done: Boolean(lot.landholder_signoff_date),
      detail: lot.landholder_signoff_date ? `Accepted by ${lot.landholder_signoff_name ?? "landholder"}` : "Not recorded",
      href: `${base}/closeout`,
    },
  ];
}

