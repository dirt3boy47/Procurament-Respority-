import Link from "next/link";
import { ChevronLeft, MapPin, Phone, UserRound } from "lucide-react";
import { LotTabs } from "@/components/lots/lot-tabs";
import { StatusBadge } from "@/components/ui/badge";
import { ReportButton } from "@/components/report-button";
import { requireSession } from "@/lib/auth";
import { LOT_STATUSES } from "@/lib/constants";
import { getLot } from "@/lib/data";

export default async function LotLayout({ children, params }: LayoutProps<"/lots/[id]">) {
  await requireSession();
  const { id } = await params;
  const lot = await getLot(id);

  return (
    <>
      <Link href="/lots" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted-fg hover:text-fg">
        <ChevronLeft className="size-4" /> Lot register
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Lot {lot.lot_number}</h1>
            <StatusBadge options={LOT_STATUSES} value={lot.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-fg">
            {lot.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {lot.address}
              </span>
            )}
            {lot.landholder_id && (
              <Link href={`/landholders/${lot.landholder_id}`} className="inline-flex items-center gap-1 hover:text-fg hover:underline">
                <UserRound className="size-3.5" /> {lot.landholder_name}
                {lot.landholder_count > 1 && <span className="text-muted-fg">+{lot.landholder_count - 1} more</span>}
              </Link>
            )}
            {lot.landholder_phone && (
              <a href={`tel:${lot.landholder_phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:text-fg hover:underline">
                <Phone className="size-3.5" /> {lot.landholder_phone}
              </a>
            )}
            {lot.chainage && <span>CH {lot.chainage}</span>}
          </div>
        </div>
        <ReportButton type="lot" params={{ lot: lot.id }} className="no-print">
          Lot report
        </ReportButton>
      </div>
      <LotTabs lotId={lot.id} fileCount={lot.file_count} reportCount={lot.issued_report_count} />
      <div className="pt-5">{children}</div>
    </>
  );
}
