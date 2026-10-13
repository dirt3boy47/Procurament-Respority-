import type { ComponentProps } from "react";
import type { LotReport, ReinstatementReport, SummaryReport, SurveyReport } from "./reports";

/** Everything needed to draw a report, as returned by GET /api/reports/[type]. */
export type ReportData = { fileName: string } & (
  | ({ type: "lot" } & ComponentProps<typeof LotReport>)
  | ({ type: "survey" } & ComponentProps<typeof SurveyReport>)
  | ({ type: "reinstatement" } & ComponentProps<typeof ReinstatementReport>)
  | ({ type: "summary" } & ComponentProps<typeof SummaryReport>)
);
