import { AuditList } from "@/components/audit-list";
import { Card, CardHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { getLot } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/lots/[id]/history">) {
  return { title: `History · Lot ${(await getLot((await params).id)).lot_number}` };
}

export default async function LotHistoryPage({ params }: PageProps<"/lots/[id]/history">) {
  await requireSession();
  const lot = await getLot((await params).id);
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .eq("lot_id", lot.id)
    .order("created_at", { ascending: false })
    .limit(300);
  return (
    <Card>
      <CardHeader title="Change history" description="Every change to this lot and its records, newest first." />
      <AuditList entries={data ?? []} />
    </Card>
  );
}
