import Link from "next/link";
import { ChevronLeft, FileDown, MapPin, Phone, UserRound } from "lucide-react";
import { LotTabs } from "@/components/lots/lot-tabs";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
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
            {lot.landholder && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" /> {lot.landholder}
              </span>
            )}
            {lot.landholder_contact && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" />
                {/^[+\d][\d\s()-]{6,}$/.test(lot.landholder_contact) ? (
                  <a href={`tel:${lot.landholder_contact.replace(/[^\d+]/g, "")}`} className="hover:underline">
                    {lot.landholder_contact}
                  </a>
                ) : (
                  lot.landholder_contact
                )}
              </span>
            )}
            {lot.chainage && <span>CH {lot.chainage}</span>}
          </div>
        </div>
        <a href={`/api/reports/lot?lot=${lot.id}`} target="_blank" rel="noopener" className={buttonClasses("secondary", "md", "no-print")}>
          <FileDown /> Lot report
        </a>
      </div>
      <LotTabs lotId={lot.id} openDefects={lot.open_defects} openReinstatement={lot.open_reinstatement} />
      <div className="pt-5">{children}</div>
    </>
  );
}
