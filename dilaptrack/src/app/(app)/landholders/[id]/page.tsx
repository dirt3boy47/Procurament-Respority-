import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Trash2 } from "lucide-react";
import { deleteLandholder } from "@/actions/landholders";
import { IssuedReportDownload } from "@/components/issued-report-download";
import { EditLandholderButton } from "@/components/landholders/landholder-dialogs";
import { ProgressDots } from "@/components/lots/progress";
import { ReportButton } from "@/components/report-button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { requireSession } from "@/lib/auth";
import { LANDHOLDER_ROLES, LOT_STATUSES } from "@/lib/constants";
import { compareLotNumbers, listLots } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
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
  const supabase = await createClient();
  const [allLots, { data: links }, { data: reports }] = await Promise.all([
    listLots(),
    supabase.from("lot_landholders").select("*").eq("landholder_id", landholder.id),
    supabase.from("issued_reports").select("*").eq("landholder_id", landholder.id).order("created_at", { ascending: false }),
  ]);
  const lotById = new Map(allLots.map((l) => [l.id, l]));
  const rows = (links ?? [])
    .flatMap((link) => {
      const lot = lotById.get(link.lot_id);
      return lot ? [{ link, lot }] : [];
    })
    .sort((a, b) => compareLotNumbers(a.lot.lot_number, b.lot.lot_number));

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
            <div className="mt-5">
              <ReportButton type="landholder" params={{ landholder: landholder.id }} size="sm">
                Landholder pack (PDF)
              </ReportButton>
            </div>
            <p className="mt-5 text-xs text-muted-fg">Last updated {formatDateTime(landholder.updated_at)}</p>
            {can.manage && (
              <div className="mt-4 border-t border-border pt-4">
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  disabled={rows.length > 0}
                  confirmText={`Delete ${landholder.name} from the landholder register?`}
                  action={deleteLandholder.bind(null, landholder.id)}
                >
                  <Trash2 /> Delete landholder
                </ConfirmButton>
                {rows.length > 0 && (
                  <p className="mt-1 text-xs text-muted-fg">Remove this landholder from their lots before deleting them.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardHeader title="Lots" description={`${rows.length} lot${rows.length === 1 ? "" : "s"} this landholder is linked to.`} />
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-fg sm:px-5">
                Not linked to any lots yet. Add them from a lot&apos;s Overview, under Landholders.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map(({ link, lot }) => (
                  <li key={link.id}>
                    <Link href={`/lots/${lot.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          Lot {lot.lot_number} <StatusBadge options={LANDHOLDER_ROLES} value={link.role} />
                        </p>
                        <p className="truncate text-xs text-muted-fg">{link.property ?? lot.address ?? "No address"}</p>
                      </div>
                      {link.acceptance_date ? (
                        <Badge tone="green">Accepted {formatDate(link.acceptance_date)}</Badge>
                      ) : link.restoration_required ? (
                        <Badge tone="amber">Acceptance needed</Badge>
                      ) : null}
                      <ProgressDots lot={lot} />
                      <StatusBadge options={LOT_STATUSES} value={lot.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Issued reports" description="Condition reports produced for this landholder, newest first." />
            {(reports ?? []).length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-fg sm:px-5">None yet. Create one from a lot&apos;s Reports tab.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(reports ?? []).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <FileText className="size-4 shrink-0 text-muted-fg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-fg">
                        Lot {lotById.get(r.lot_id)?.lot_number ?? "?"} · {formatDateTime(r.created_at)}
                        {r.issued_to && ` · for ${r.issued_to}`}
                      </p>
                    </div>
                    <IssuedReportDownload attachmentId={r.attachment_id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
