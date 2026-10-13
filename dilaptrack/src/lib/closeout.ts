import type { Views } from "@/lib/database.types";

type Lot = Views<"lot_overview">;

export type ChecklistItem = { key: string; label: string; done: boolean; detail: string; href: string };

/** The five close-out conditions, in the order they're normally achieved. */
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
      key: "defects",
      label: "Defects closed",
      done: lot.open_defects === 0,
      detail: lot.total_defects === 0 ? "No defects recorded" : `${lot.open_defects} of ${lot.total_defects} open`,
      href: `${base}/defects`,
    },
    {
      key: "reinstatement",
      label: "Reinstatement complete",
      done: lot.open_reinstatement === 0,
      detail:
        lot.total_reinstatement === 0
          ? "No reinstatement required"
          : `${lot.total_reinstatement - lot.open_reinstatement} of ${lot.total_reinstatement} complete`,
      href: `${base}/reinstatement`,
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

