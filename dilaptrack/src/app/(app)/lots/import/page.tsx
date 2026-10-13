import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LotImporter } from "./lot-importer";

export const metadata: Metadata = { title: "Import lots" };

export default async function ImportPage() {
  await requireCapability("manage");
  const supabase = await createClient();
  const { data } = await supabase.from("lots").select("lot_number");
  return (
    <>
      <PageHeader
        title="Import lots"
        description="Upload the lot register as Excel (.xlsx) or CSV. You'll see a preview and any problems before anything is saved."
      />
      <LotImporter existingLotNumbers={(data ?? []).map((l) => l.lot_number)} />
    </>
  );
}
