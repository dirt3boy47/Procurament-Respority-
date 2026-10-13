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
      label: "Written acceptance of restoration (hold point)",
      done: lot.acceptances_outstanding === 0,
      detail:
        lot.restorations === 0
          ? "No damage recorded - not required"
          : `${lot.restorations - lot.acceptances_outstanding} of ${lot.restorations} received`,
      href: `${base}/closeout`,
    },
  ];
}

