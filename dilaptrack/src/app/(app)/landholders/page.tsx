import type { Metadata } from "next";
import { Contact } from "lucide-react";
import { AddLandholderButton } from "@/components/landholders/landholder-dialogs";
import { LandholderList } from "@/components/landholders/landholder-list";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth";
import { listLandholders, listLots } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Landholders" };

export default async function LandholdersPage() {
  const { can } = await requireSession();
  const supabase = await createClient();
  const [landholders, lots, { data: links }] = await Promise.all([
    listLandholders(),
    listLots(),
    supabase.from("lot_landholders").select("lot_id, landholder_id"),
  ]);
  const lotNumber = new Map(lots.map((l) => [l.id, l.lot_number]));
  const lotsByLandholder: Record<string, string[]> = {};
  for (const link of links ?? []) {
    const n = lotNumber.get(link.lot_id);
    if (n) (lotsByLandholder[link.landholder_id] ??= []).push(n);
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
