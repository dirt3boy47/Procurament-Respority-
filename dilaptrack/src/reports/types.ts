import type { ComponentProps } from "react";
import type { LandholderReport, LotReport, SummaryReport, SurveyReport } from "./reports";

/** Everything needed to draw a report, as returned by GET /api/reports/[type]. */
export type ReportData = { fileName: string } & (
  | ({ type: "lot" } & ComponentProps<typeof LotReport>)
  | ({ type: "survey" } & ComponentProps<typeof SurveyReport>)
  | ({ type: "landholder" } & ComponentProps<typeof LandholderReport>)
  | ({ type: "summary" } & ComponentProps<typeof SummaryReport>)
);
