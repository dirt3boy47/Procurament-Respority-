import { ClipboardList, Lock, Trash2 } from "lucide-react";
import { deleteDefect } from "@/actions/records";
import { FileUploader } from "@/components/files/file-uploader";
import { Gallery } from "@/components/files/gallery";
import { DefectDialog } from "@/components/records/record-dialogs";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth";
import { DEFECT_PRIORITIES, DEFECT_STATUSES } from "@/lib/constants";
import { getAttachments, getLot, teamNames } from "@/lib/data";
import { defectRef, formatDate, isOverdue } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/lots/[id]/defects">) {
  return { title: `Defects · Lot ${(await getLot((await params).id)).lot_number}` };
}

const ORDER = { open: 0, in_progress: 1, closed: 2 } as const;

export default async function LotDefectsPage({ params }: PageProps<"/lots/[id]/defects">) {
  const session = await requireSession();
  const lot = await getLot((await params).id);
  const supabase = await createClient();
  const [{ data }, photos, names] = await Promise.all([
    supabase.from("defects").select("*").eq("lot_id", lot.id).order("ref"),
    getAttachments({ lot_id: lot.id, category: "defects" }),
    teamNames(),
  ]);
  const defects = (data ?? []).sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.ref - b.ref);
  const locked = lot.status === "closed";
  const canEdit = session.can.editRecords && !locked;
  const permissions = { userId: session.profile.id, canEdit, canManage: session.can.manage && !locked };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-fg">
          {defects.length === 0
            ? "No defects recorded."
            : `${lot.open_defects} open of ${defects.length}. All defects must be closed before the lot can be closed.`}
        </p>
        {canEdit && <DefectDialog lotId={lot.id} lotNumber={lot.lot_number} names={names} />}
        {locked && (
          <span className="flex items-center gap-1.5 text-sm text-muted-fg">
            <Lock className="size-4" /> Lot closed
          </span>
        )}
      </div>

      {defects.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No defects">
            Record any damage or issues found at this property, with photos.
          </EmptyState>
        </Card>
      ) : (
        defects.map((d) => {
          const overdue = isOverdue(d.due_date, d.status === "closed");
          return (
            <Card key={d.id} id={d.id} className="scroll-mt-20">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-fg">{defectRef(d.ref)}</span>
                    <StatusBadge options={DEFECT_PRIORITIES} value={d.priority} />
                    <StatusBadge options={DEFECT_STATUSES} value={d.status} />
                  </div>
                  <p className="mt-1.5 font-medium whitespace-pre-wrap">{d.description}</p>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && <DefectDialog lotId={lot.id} lotNumber={lot.lot_number} defect={d} names={names} />}
                  {session.can.manage && !locked && (
                    <ConfirmButton
                      variant="ghost"
                      size="icon"
                      confirmText={`Delete defect ${defectRef(d.ref)} and its photos?`}
                      action={deleteDefect.bind(null, d.id)}
                    >
                      <Trash2 />
                      <span className="sr-only">Delete</span>
                    </ConfirmButton>
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 px-4 py-3 text-sm sm:grid-cols-4 sm:px-5">
                <div>
                  <dt className="text-xs text-muted-fg">Assigned to</dt>
                  <dd>{d.assigned_to ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-fg">Due</dt>
                  <dd className={overdue ? "font-medium text-red-600 dark:text-red-400" : undefined}>
                    {formatDate(d.due_date)}
                    {overdue && " (overdue)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-fg">Raised</dt>
                  <dd>{formatDate(d.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-fg">Closed</dt>
                  <dd>{formatDate(d.closed_at)}</dd>
                </div>
                {d.notes && (
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="text-xs text-muted-fg">Notes</dt>
                    <dd className="whitespace-pre-wrap">{d.notes}</dd>
                  </div>
                )}
              </dl>
              <div className="space-y-2 border-t border-border px-4 py-3 sm:px-5">
                <Gallery
                  items={photos.filter((p) => p.defect_id === d.id)}
                  permissions={permissions}
                  size="sm"
                  emptyText="No photos."
                />
                {canEdit && (
                  <FileUploader
                    lotId={lot.id}
                    lotNumber={lot.lot_number}
                    category="defects"
                    defectId={d.id}
                    accept="image/*,video/*,application/pdf"
                    label="Drop photos here"
                    compact
                  />
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
