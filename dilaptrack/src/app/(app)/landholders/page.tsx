import type { Metadata } from "next";
import { Contact } from "lucide-react";
import { AddLandholderButton } from "@/components/landholders/landholder-dialogs";
import { LandholderList } from "@/components/landholders/landholder-list";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth";
import { listLandholders, listLots } from "@/lib/data";

export const metadata: Metadata = { title: "Landholders" };

export default async function LandholdersPage() {
  const { can } = await requireSession();
  const [landholders, lots] = await Promise.all([listLandholders(), listLots()]);
  const lotsByLandholder: Record<string, string[]> = {};
  for (const lot of lots) {
    if (lot.landholder_id) (lotsByLandholder[lot.landholder_id] ??= []).push(lot.lot_number);
  }

  return (
    <>
      <PageHeader
        title="Landholder register"
        description="Landowners and occupiers. Choose from this list when setting up a lot."
        actions={can.editRecords && <AddLandholderButton />}
      />
      {landholders.length === 0 ? (
        <Card>
          <EmptyState icon={Contact} title="No landholders yet" action={can.editRecords && <AddLandholderButton />}>
            Add landholders here, from a lot&apos;s edit form, or by importing lots with a Landholder column.
          </EmptyState>
        </Card>
      ) : (
        <LandholderList landholders={landholders} lotsByLandholder={lotsByLandholder} />
      )}
    </>
  );
}
