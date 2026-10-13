import Link from "next/link";
import { CheckCircle2, Lock, LockOpen } from "lucide-react";
import { clearAcceptance } from "@/actions/lot-landholders";
import { setLotClosed } from "@/actions/lots";
import { FileSection } from "@/components/files/file-section";
import { AcceptanceBadge } from "@/components/lots/lot-landholders";
import { closeoutChecklist, StepIcon } from "@/components/lots/progress";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { requireSession } from "@/lib/auth";
import { LANDHOLDER_ROLES } from "@/lib/constants";
import { getAttachments, getLot, getLotLandholders } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import { AcceptanceForm } from "./signoff-form";

export async function generateMetadata({ params }: PageProps<"/lots/[id]/closeout">) {
  return { title: `Close-out · Lot ${(await getLot((await params).id)).lot_number}` };
}

export default async function CloseoutPage({ params }: PageProps<"/lots/[id]/closeout">) {
  const session = await requireSession();
  const lot = await getLot((await params).id);
  const [files, links] = await Promise.all([getAttachments({ lot_id: lot.id, category: "closeout" }), getLotLandholders(lot.id)]);
  const checklist = closeoutChecklist(lot);
  const closed = lot.status === "closed";
  const { manage } = session.can;
  const holdPoints = links.filter((l) => l.restoration_required || l.acceptance_date);

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <Card className={closed ? "border-emerald-300 dark:border-emerald-800" : undefined}>
        <CardHeader
          title="Close-out checklist"
          description={
            closed
              ? `Closed ${formatDateTime(lot.closed_at)}`
              : lot.ready_to_close
                ? "All conditions are met. This lot can be closed."
                : "A lot can only be closed when every condition is met."
          }
        />
        <ul className="divide-y divide-border">
          {checklist.map((c) => (
            <li key={c.key} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <StepIcon state={c.done ? "done" : "todo"} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-fg">{c.detail}</p>
              </div>
              {!c.done && c.key !== "acceptance" && (
                <Link href={c.href} className="text-sm text-primary hover:underline">
                  Go to
                </Link>
              )}
            </li>
          ))}
        </ul>
        {manage && (
          <div className="border-t border-border px-4 py-4 sm:px-5">
            {closed ? (
              <ConfirmButton
                action={setLotClosed.bind(null, lot.id, false)}
                confirmText={`Reopen lot ${lot.lot_number}? Its records become editable again.`}
              >
                <LockOpen /> Reopen lot
              </ConfirmButton>
            ) : (
              <ConfirmButton
                variant="primary"
                action={setLotClosed.bind(null, lot.id, true)}
                confirmText={`Close lot ${lot.lot_number}? Its records will be locked. Reports can still be issued.`}
                disabled={!lot.ready_to_close}
              >
                <Lock /> Close lot
              </ConfirmButton>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Written acceptance of restoration"
            description="Hold point: required from each landholder whose property was damaged and restored."
          />
          {holdPoints.length === 0 ? (
            <p className="flex items-start gap-2 px-4 py-4 text-sm sm:px-5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>
                No damage recorded against any landholder on this lot, so no written acceptance is required. Record damage
                on the lot&apos;s <Link href={`/lots/${lot.id}`} className="text-primary hover:underline">Overview</Link> if
                restoration is needed.
              </span>
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {holdPoints.map((l) => (
                <li key={l.id} className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l.landholder.name}</span>
                    <StatusBadge options={LANDHOLDER_ROLES} value={l.role} />
                    <AcceptanceBadge link={l} />
                  </div>
                  {l.property && <p className="text-xs text-muted-fg">{l.property}</p>}
                  {l.damage_notes && (
                    <p className="text-sm whitespace-pre-wrap">
                      <span className="font-medium">Damage restored: </span>
                      {l.damage_notes}
                    </p>
                  )}
                  {l.acceptance_date ? (
                    <div className="space-y-2 text-sm">
                      <p>
                        Accepted in writing by <strong>{l.acceptance_name}</strong> on {formatDate(l.acceptance_date)}.
                      </p>
                      {l.acceptance_notes && <p className="whitespace-pre-wrap text-muted-fg">{l.acceptance_notes}</p>}
                      {manage && !closed && (
                        <ConfirmButton
                          size="sm"
                          variant="ghost"
                          action={clearAcceptance.bind(null, l.id)}
                          confirmText={`Remove the recorded acceptance from ${l.landholder.name}?`}
                        >
                          Remove acceptance
                        </ConfirmButton>
                      )}
                    </div>
                  ) : manage && !closed ? (
                    <AcceptanceForm linkId={l.id} defaultName={l.landholder.name} />
                  ) : (
                    <p className="text-sm text-muted-fg">
                      Waiting for written acceptance.{" "}
                      {session.can.editRecords && "Upload the signed form below; a project manager records the acceptance."}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Close-out documents" description="Signed acceptance forms, final photos and correspondence." />
          <CardContent>
            <FileSection
              session={session}
              files={files}
              lotId={lot.id}
              lotNumber={lot.lot_number}
              category="closeout"
              locked={closed}
              landholders={links.map((l) => ({ id: l.landholder_id, name: l.landholder.name }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
