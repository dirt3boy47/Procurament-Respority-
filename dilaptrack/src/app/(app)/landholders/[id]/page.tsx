import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import { deleteLandholder } from "@/actions/landholders";
import { EditLandholderButton } from "@/components/landholders/landholder-dialogs";
import { ProgressDots } from "@/components/lots/progress";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { requireSession } from "@/lib/auth";
import { LOT_STATUSES } from "@/lib/constants";
import { compareLotNumbers, listLots } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

async function getLandholder(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("landholders").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/landholders/[id]">) {
  return { title: (await getLandholder((await params).id)).name };
}

export default async function LandholderPage({ params }: PageProps<"/landholders/[id]">) {
  const { can } = await requireSession();
  const landholder = await getLandholder((await params).id);
  const lots = (await listLots())
    .filter((l) => l.landholder_id === landholder.id)
    .sort((a, b) => compareLotNumbers(a.lot_number, b.lot_number));

  const details: [string, ReactNode][] = [
    [
      "Phone",
      landholder.phone && (
        <a href={`tel:${landholder.phone.replace(/[^\d+]/g, "")}`} className="text-primary hover:underline">
          {landholder.phone}
        </a>
      ),
    ],
    [
      "Email",
      landholder.email && (
        <a href={`mailto:${landholder.email}`} className="text-primary hover:underline">
          {landholder.email}
        </a>
      ),
    ],
    ["Postal address", landholder.postal_address],
  ];

  return (
    <>
      <Link href="/landholders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-fg hover:text-fg">
        <ChevronLeft className="size-4" /> Landholder register
      </Link>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title={landholder.name} actions={can.editRecords && <EditLandholderButton landholder={landholder} />} />
          <CardContent>
            <dl className="space-y-4">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium tracking-wide text-muted-fg uppercase">{label}</dt>
                  <dd className="mt-0.5 text-sm">{value || "—"}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-fg uppercase">Notes</dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap">{landholder.notes || "—"}</dd>
              </div>
            </dl>
            <p className="mt-5 text-xs text-muted-fg">Last updated {formatDateTime(landholder.updated_at)}</p>
            {can.manage && (
              <div className="mt-4 border-t border-border pt-4">
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  disabled={lots.length > 0}
                  confirmText={`Delete ${landholder.name} from the landholder register?`}
                  action={deleteLandholder.bind(null, landholder.id)}
                >
                  <Trash2 /> Delete landholder
                </ConfirmButton>
                {lots.length > 0 && (
                  <p className="mt-1 text-xs text-muted-fg">Landholders with lots can&apos;t be deleted. Move the lots first.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Lots" description={`${lots.length} lot${lots.length === 1 ? "" : "s"} belonging to this landholder.`} />
          {lots.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-fg sm:px-5">
              No lots yet. Choose this landholder when creating or editing a lot.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {lots.map((l) => (
                <li key={l.id}>
                  <Link href={`/lots/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Lot {l.lot_number}</p>
                      <p className="truncate text-xs text-muted-fg">{l.address ?? "No address"}</p>
                    </div>
                    <ProgressDots lot={l} />
                    <StatusBadge options={LOT_STATUSES} value={l.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
