import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { FileSection } from "@/components/files/file-section";
import { StatusBadge } from "@/components/ui/badge";
import { ReportButton } from "@/components/report-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { SURVEY_STATUSES, SURVEY_TYPES } from "@/lib/constants";
import { getAttachments, getLot } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { SurveyForm } from "./survey-form";

export async function generateMetadata({ params }: PageProps<"/lots/[id]/surveys/[stage]">) {
  const { id, stage } = await params;
  const lot = await getLot(id);
  const type = SURVEY_TYPES.find((t) => t.slug === stage);
  return { title: `${type?.label ?? "Survey"} · Lot ${lot.lot_number}` };
}

export default async function SurveyPage({ params }: PageProps<"/lots/[id]/surveys/[stage]">) {
  const session = await requireSession();
  const { id, stage } = await params;
  const type = SURVEY_TYPES.find((t) => t.slug === stage);
  if (!type) notFound();
  const lot = await getLot(id);

  const supabase = await createClient();
  const { data: survey } = await supabase
    .from("surveys")
    .select("*")
    .eq("lot_id", lot.id)
    .eq("survey_type", type.value)
    .single();
  if (!survey) notFound();
  const files = await getAttachments({ lot_id: lot.id, category: type.value });
  const locked = lot.status === "closed";
  const canEdit = session.can.editRecords && !locked;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={type.label}
          description={survey.completed_at ? `Completed ${formatDateTime(survey.completed_at)}` : undefined}
          actions={
            <>
              <StatusBadge options={SURVEY_STATUSES} value={survey.status} />
              <ReportButton type="survey" params={{ lot: lot.id, stage: type.value }} variant="ghost" size="sm">
                Survey report
              </ReportButton>
            </>
          }
        />
        <CardContent>
          {locked && (
            <p className="mb-4 flex items-center gap-2 text-sm text-muted-fg">
              <Lock className="size-4" /> This lot is closed. Reopen it to make changes.
            </p>
          )}
          {canEdit ? (
            <SurveyForm survey={survey} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-fg uppercase">Survey date</dt>
                <dd className="mt-0.5 text-sm">{formatDate(survey.survey_date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-fg uppercase">Surveyor</dt>
                <dd className="mt-0.5 text-sm">{survey.surveyor ?? "—"}</dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-xs font-medium tracking-wide text-muted-fg uppercase">Notes</dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap">{survey.notes || "—"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Photos, videos and report" description={`Stored in ${lot.lot_number} / ${type.slug.replace("-", " ")}`} />
        <CardContent>
          <FileSection
            session={session}
            files={files}
            lotId={lot.id}
            lotNumber={lot.lot_number}
            category={type.value}
            surveyId={survey.id}
            locked={locked}
          />
        </CardContent>
      </Card>
    </div>
  );
}
