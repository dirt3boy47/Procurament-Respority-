import type { Metadata } from "next";
import { ClipboardCheck, Contact, FileBarChart, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth";
import { listLandholders, listLots } from "@/lib/data";
import { ReportCard } from "./report-card";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireSession();
  const lots = (await listLots()).map((l) => ({ id: l.id, label: `Lot ${l.lot_number}${l.address ? ` - ${l.address}` : ""}` }));
  const landholders = (await listLandholders()).map((h) => ({ id: h.id, label: h.name }));
  return (
    <>
      <PageHeader title="Reports" description="PDF reports, generated from the latest data. Open in the browser, print or download." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReportCard
          type="summary"
          icon={<FileBarChart />}
          title="Project Summary Report"
          description="Headline figures and the full lot register with survey, landholder acceptance and close-out status."
          lots={lots}
        />
        <ReportCard
          type="lot"
          icon={<FileText />}
          title="Individual Lot Report"
          description="Everything about one lot: details, landholder, close-out checklist, surveys, acceptance and photos."
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
          type="landholder"
          icon={<Contact />}
          title="Landholder Report"
          description="Each landholder's contact details with the survey, acceptance and close-out status of their lots. For one landholder or all of them."
          lots={landholders}
          lotLabel="Landholder"
          lotParam="landholder"
          optionalLot
        />
      </div>
    </>
  );
}
