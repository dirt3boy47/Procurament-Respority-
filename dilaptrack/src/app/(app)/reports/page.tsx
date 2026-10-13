import type { Metadata } from "next";
import { ClipboardCheck, FileBarChart, FileText, Hammer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth";
import { listLots } from "@/lib/data";
import { ReportCard } from "./report-card";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireSession();
  const lots = (await listLots()).map((l) => ({ id: l.id, label: `Lot ${l.lot_number}${l.address ? ` - ${l.address}` : ""}` }));
  return (
    <>
      <PageHeader title="Reports" description="PDF reports, generated from the latest data. Open in the browser, print or download." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReportCard
          type="summary"
          icon={<FileBarChart />}
          title="Project Summary Report"
          description="Headline figures, the full lot register with survey and close-out status, and all open defects."
          lots={lots}
        />
        <ReportCard
          type="lot"
          icon={<FileText />}
          title="Individual Lot Report"
          description="Everything about one lot: details, close-out checklist, surveys, defects, reinstatement, acceptance and photos."
          lots={lots}
          needsLot
        />
        <ReportCard
          type="survey"
          icon={<ClipboardCheck />}
          title="Dilapidation Survey Report"
          description="The photographic record of a lot's pre- and/or post-construction survey, with surveyor, date and notes."
          lots={lots}
          needsLot
          stages
        />
        <ReportCard
          type="reinstatement"
          icon={<Hammer />}
          title="Reinstatement Report"
          description="Reinstatement works and landholder acceptance, for the whole project or one lot (with photos)."
          lots={lots}
          optionalLot
          outstandingFilter
        />
      </div>
    </>
  );
}
