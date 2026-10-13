import { CheckCircle2, Hammer, Lock, Trash2 } from "lucide-react";
import { deleteReinstatement } from "@/actions/records";
import { FileUploader } from "@/components/files/file-uploader";
import { Gallery } from "@/components/files/gallery";
import { ReinstatementDialog } from "@/components/records/record-dialogs";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth";
import { REINSTATEMENT_STATUSES } from "@/lib/constants";
import { getAttachments, getLot } from "@/lib/data";
import { formatDate, reinstatementRef } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/lots/[id]/reinstatement">) {
  return { title: `Reinstatement · Lot ${(await getLot((await params).id)).lot_number}` };
}

export default async function LotReinstatementPage({ params }: PageProps<"/lots/[id]/reinstatement">) {
  const session = await requireSession();
  const lot = await getLot((await params).id);
  const supabase = await createClient();
  const [{ data }, photos] = await Promise.all([
    supabase.from("reinstatement_items").select("*").eq("lot_id", lot.id).order("ref"),
    getAttachments({ lot_id: lot.id, category: "reinstatement" }),
  ]);
  const items = data ?? [];
  const locked = lot.status === "closed";
  const canEdit = session.can.editRecords && !locked;
  const permissions = { userId: session.profile.id, canEdit, canManage: session.can.manage && !locked };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-fg">
          {items.length === 0
            ? "No reinstatement works recorded."
            : `${items.length - lot.open_reinstatement} of ${items.length} complete.`}
        </p>
        {canEdit && <ReinstatementDialog lotId={lot.id} lotNumber={lot.lot_number} />}
        {locked && (
          <span className="flex items-center gap-1.5 text-sm text-muted-fg">
            <Lock className="size-4" /> Lot closed
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Hammer} title="No reinstatement works">
            Add the works needed to return the property to its pre-construction condition.
          </EmptyState>
        </Card>
      ) : (
        items.map((r) => (
          <Card key={r.id} id={r.id} className="scroll-mt-20">
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-fg">{reinstatementRef(r.ref)}</span>
                  <StatusBadge options={REINSTATEMENT_STATUSES} value={r.status} />
                  {r.landholder_accepted ? (
                    <Badge tone="green">
                      <CheckCircle2 className="size-3" /> Landholder accepted
                    </Badge>
                  ) : (
                    <Badge tone="gray">Awaiting landholder acceptance</Badge>
                  )}
                </div>
                <p className="mt-1.5 font-medium whitespace-pre-wrap">{r.required_works}</p>
              </div>
              <div className="flex items-center gap-1">
                {canEdit && <ReinstatementDialog lotId={lot.id} lotNumber={lot.lot_number} item={r} />}
                {session.can.manage && !locked && (
                  <ConfirmButton
                    variant="ghost"
                    size="icon"
                    confirmText={`Delete ${reinstatementRef(r.ref)} and its photos?`}
                    action={deleteReinstatement.bind(null, r.id)}
                  >
                    <Trash2 />
                    <span className="sr-only">Delete</span>
                  </ConfirmButton>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 px-4 py-3 text-sm sm:grid-cols-3 sm:px-5">
              <div>
                <dt className="text-xs text-muted-fg">Completed</dt>
                <dd>{formatDate(r.completion_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-fg">Accepted</dt>
                <dd>{r.landholder_accepted ? formatDate(r.landholder_accepted_date) : "—"}</dd>
              </div>
              {r.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs text-muted-fg">Notes</dt>
                  <dd className="whitespace-pre-wrap">{r.notes}</dd>
                </div>
              )}
            </dl>
            <div className="space-y-2 border-t border-border px-4 py-3 sm:px-5">
              <Gallery
                items={photos.filter((p) => p.reinstatement_id === r.id)}
                permissions={permissions}
                size="sm"
                emptyText="No photos."
              />
              {canEdit && (
                <FileUploader
                  lotId={lot.id}
                  lotNumber={lot.lot_number}
                  category="reinstatement"
                  reinstatementId={r.id}
                  accept="image/*,video/*,application/pdf"
                  label="Drop photos here"
                  compact
                />
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
