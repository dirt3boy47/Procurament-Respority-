import { FileText, Trash2 } from "lucide-react";
import { deleteIssuedReport } from "@/actions/issued-reports";
import { IssuedReportDownload } from "@/components/issued-report-download";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { requireSession } from "@/lib/auth";
import { FILE_CATEGORIES } from "@/lib/constants";
import { getAttachments, getLot, getLotLandholders } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ReportBuilder, type BuilderPhoto } from "./report-builder";

export async function generateMetadata({ params }: PageProps<"/lots/[id]/reports">) {
  return { title: `Reports · Lot ${(await getLot((await params).id)).lot_number}` };
}

export default async function LotReportsPage({ params }: PageProps<"/lots/[id]/reports">) {
  const session = await requireSession();
  const lot = await getLot((await params).id);
  const supabase = await createClient();
  const [links, attachments, { data: surveys }, { data: reports }, { data: people }] = await Promise.all([
    getLotLandholders(lot.id),
    getAttachments({ lot_id: lot.id }),
    supabase.from("surveys").select("*").eq("lot_id", lot.id).order("survey_type"),
    supabase.from("issued_reports").select("*").eq("lot_id", lot.id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const personName = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const landholderName = new Map(links.map((l) => [l.landholder_id, l.landholder.name]));

  // Photos that can go in a PDF (JPEG preview, or a JPEG/PNG original).
  const photos: BuilderPhoto[] = attachments.flatMap((a) => {
    if (a.kind !== "photo" || a.category === "reports" || !a.previewUrl) return [];
    if (!a.preview_path && a.mime_type !== "image/jpeg" && a.mime_type !== "image/png") return [];
    return [
      {
        id: a.id,
        src: a.previewUrl,
        caption: a.caption || a.file_name,
        folder: FILE_CATEGORIES.find((c) => c.value === a.category)?.label ?? a.category,
        landholderId: a.landholder_id,
        createdAt: a.created_at,
      },
    ];
  });

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title="Create a report"
          description="Pick the landholder, who it's for, what to include and exactly which photos. Available at any time, including after close-out."
        />
        <CardContent>
          <ReportBuilder
            lot={lot}
            landholders={links.map((l) => ({
              id: l.landholder_id,
              name: l.landholder.name,
              role: l.role,
              property: l.property,
              phone: l.landholder.phone,
              email: l.landholder.email,
              restoration_required: l.restoration_required,
              damage_notes: l.damage_notes,
              acceptance_date: l.acceptance_date,
              acceptance_name: l.acceptance_name,
              acceptance_notes: l.acceptance_notes,
            }))}
            surveys={surveys ?? []}
            photos={photos}
            canSave={session.can.editRecords}
            project={process.env.NEXT_PUBLIC_PROJECT_NAME || "DilapTrack"}
            generatedBy={session.profile.full_name || session.profile.email}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Issued reports" description="Saved against this lot, newest first." />
        {(reports ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-fg sm:px-5">No reports issued yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="space-y-2 px-4 py-3 sm:px-5">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-fg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-fg">
                      {formatDateTime(r.created_at)}
                      {r.created_by && ` · by ${personName.get(r.created_by) ?? "unknown"}`}
                    </p>
                    <p className="text-xs text-muted-fg">
                      {[
                        r.issued_to && `For ${r.issued_to}`,
                        r.landholder_id && (landholderName.get(r.landholder_id) ?? "Landholder"),
                        `${r.photo_count} photo${r.photo_count === 1 ? "" : "s"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {r.notes && <p className="mt-1 text-xs whitespace-pre-wrap">{r.notes}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <IssuedReportDownload attachmentId={r.attachment_id} />
                  {session.can.manage && (
                    <ConfirmButton
                      variant="ghost"
                      size="sm"
                      confirmText={`Delete "${r.title}"? The saved PDF is removed.`}
                      action={deleteIssuedReport.bind(null, r.id)}
                    >
                      <Trash2 />
                      <span className="sr-only">Delete</span>
                    </ConfirmButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
