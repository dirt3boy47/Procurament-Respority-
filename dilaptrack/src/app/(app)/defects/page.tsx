import type { Metadata } from "next";
import { DefectRegister } from "@/components/records/registers";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth";
import { lotNumbers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Defects register" };

export default async function DefectsPage() {
  await requireSession();
  const supabase = await createClient();
  const [{ data }, lots] = await Promise.all([supabase.from("defects").select("*"), lotNumbers()]);
  return (
    <>
      <PageHeader title="Defects register" description="Defects across all lots. Add defects from a lot's Defects tab." />
      <DefectRegister
        defects={data ?? []}
        lots={Object.fromEntries([...lots].map(([id, l]) => [id, { lot_number: l.lot_number, address: l.address }]))}
      />
    </>
  );
}
