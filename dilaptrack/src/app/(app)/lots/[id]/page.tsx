import Link from "next/link";
import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { deleteLot } from "@/actions/lots";
import { EditLotButton } from "@/components/lots/edit-lot";
import { closeoutChecklist, StepIcon } from "@/components/lots/progress";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { requireSession } from "@/lib/auth";
import { getLot, listLandholders, teamNames } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/lots/[id]">) {
  const lot = await getLot((await params).id);
  return { title: `Lot ${lot.lot_number}` };
}

export default async function LotOverviewPage({ params }: PageProps<"/lots/[id]">) {
  const { can } = await requireSession();
  const lot = await getLot((await params).id);
  const checklist = closeoutChecklist(lot);
  const done = checklist.filter((c) => c.done).length;

  const details: [string, ReactNode][] = [
    ["Lot number", lot.lot_number],
    ["Property address", lot.address],
    [
      "Landholder",
      lot.landholder_id ? (
        <Link href={`/landholders/${lot.landholder_id}`} className="text-primary hover:underline">
          {lot.landholder_name}
        </Link>
      ) : null,
    ],
    ["Landholder phone / email", [lot.landholder_phone, lot.landholder_email].filter(Boolean).join(" · ") || null],
    ["Chainage", lot.chainage],
    ["Assigned engineer", lot.assigned_engineer],
    [
      "Pre-construction survey",
      lot.pre_survey_date ? `${formatDate(lot.pre_survey_date)}${lot.pre_surveyor ? ` · ${lot.pre_surveyor}` : ""}` : null,
    ],
    [
      "Post-construction survey",
      lot.post_survey_date ? `${formatDate(lot.post_survey_date)}${lot.post_surveyor ? ` · ${lot.post_surveyor}` : ""}` : null,
    ],
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader
          title="Lot details"
          actions={
            can.manage && (
              <EditLotButton
                lot={lot}
                engineers={await teamNames()}
                landholders={(await listLandholders()).map((l) => ({ id: l.id, name: l.name, phone: l.phone }))}
              />
            )
          }
        />
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium tracking-wide text-muted-fg uppercase">{label}</dt>
                <dd className="mt-0.5 text-sm">{value || "—"}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium tracking-wide text-muted-fg uppercase">Notes</dt>
              <dd className="mt-0.5 text-sm whitespace-pre-wrap">{lot.notes || "—"}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs text-muted-fg">Last updated {formatDateTime(lot.updated_at)}</p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title="Close-out progress"
          description={lot.status === "closed" ? `Closed ${formatDate(lot.closed_at)}` : `${done} of ${checklist.length} conditions met`}
        />
        <ul className="divide-y divide-border">
          {checklist.map((c) => (
            <li key={c.key}>
              <Link href={c.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted sm:px-5">
                <StepIcon state={c.done ? "done" : "todo"} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-fg">{c.detail}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {can.manage && (
        <Card className="border-red-200 lg:col-span-5 dark:border-red-900">
          <CardHeader
            title="Delete lot"
            description="Permanently removes this lot with its surveys and files. The landholder stays in the register. The audit log keeps a record."
            actions={
              <ConfirmButton
                variant="danger"
                size="sm"
                confirmText={`Delete lot ${lot.lot_number} and all of its records and files? This can't be undone.`}
                action={deleteLot.bind(null, lot.id)}
              >
                <Trash2 /> Delete lot
              </ConfirmButton>
            }
          />
        </Card>
      )}
    </div>
  );
}
