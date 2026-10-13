import type { Metadata } from "next";
import { FileDown } from "lucide-react";
import { ReinstatementRegister } from "@/components/records/registers";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth";
import { lotNumbers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reinstatement register" };

export default async function ReinstatementPage() {
  await requireSession();
  const supabase = await createClient();
  const [{ data }, lots] = await Promise.all([
    supabase.from("reinstatement_items").select("*").order("ref"),
    lotNumbers(),
  ]);
  return (
    <>
      <PageHeader
        title="Reinstatement register"
        description="Works to return each property to its pre-construction condition."
        actions={
          <a href="/api/reports/reinstatement" target="_blank" rel="noopener" className={buttonClasses("secondary")}>
            <FileDown /> PDF report
          </a>
        }
      />
      <ReinstatementRegister
        items={data ?? []}
        lots={Object.fromEntries([...lots].map(([id, l]) => [id, { lot_number: l.lot_number, address: l.address }]))}
      />
    </>
  );
}
