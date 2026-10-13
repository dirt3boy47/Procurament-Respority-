import Link from "next/link";
import { CheckCircle2, Lock, LockOpen } from "lucide-react";
import { clearSignoff, setLotClosed } from "@/actions/lots";
import { FileSection } from "@/components/files/file-section";
import { closeoutChecklist, StepIcon } from "@/components/lots/progress";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { requireSession } from "@/lib/auth";
import { getAttachments, getLot } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import { SignoffForm } from "./signoff-form";

export async function generateMetadata({ params }: PageProps<"/lots/[id]/closeout">) {
  return { title: `Close-out · Lot ${(await getLot((await params).id)).lot_number}` };
}

export default async function CloseoutPage({ params }: PageProps<"/lots/[id]/closeout">) {
  const session = await requireSession();
  const lot = await getLot((await params).id);
  const files = await getAttachments({ lot_id: lot.id, category: "closeout" });
  const checklist = closeoutChecklist(lot);
  const closed = lot.status === "closed";
  const { manage } = session.can;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
                confirmText={`Close lot ${lot.lot_number}? Its records will be locked.`}
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
            title="Landholder acceptance"
            description="Final acceptance by the landholder that the property has been returned to its pre-construction condition."
          />
          <CardContent>
            {lot.landholder_signoff_date ? (
              <div className="space-y-3">
                <p className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span>
                    Accepted by <strong>{lot.landholder_signoff_name}</strong> on {formatDate(lot.landholder_signoff_date)}.
                  </span>
                </p>
                {lot.landholder_signoff_notes && <p className="text-sm whitespace-pre-wrap text-muted-fg">{lot.landholder_signoff_notes}</p>}
                {manage && !closed && (
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    action={clearSignoff.bind(null, lot.id)}
                    confirmText="Remove the recorded landholder acceptance?"
                  >
                    Remove acceptance
                  </ConfirmButton>
                )}
              </div>
            ) : manage && !closed ? (
              <SignoffForm lotId={lot.id} landholder={lot.landholder ?? ""} />
            ) : (
              <p className="text-sm text-muted-fg">
                Not recorded yet. {session.can.editRecords && "Upload the signed acceptance form below and ask a project manager to record it."}
              </p>
            )}
          </CardContent>
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
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
