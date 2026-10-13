"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateSurvey } from "@/actions/records";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SURVEY_STATUSES } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";
import { todayISO } from "@/lib/format";

export function SurveyForm({ survey }: { survey: Tables<"surveys"> }) {
  const router = useRouter();
  const [status, setStatus] = useState(survey.status);
  const complete = status === "complete";
  return (
    <ActionForm action={(fd) => updateSurvey(survey.id, fd)} onSuccess={() => router.refresh()}>
      {(pending) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {SURVEY_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Survey date" htmlFor="survey_date" required={complete}>
              <Input
                id="survey_date"
                name="survey_date"
                type="date"
                defaultValue={survey.survey_date ?? (complete ? todayISO() : "")}
                required={complete}
              />
            </Field>
            <Field label="Surveyor" htmlFor="surveyor" required={complete}>
              <Input id="surveyor" name="surveyor" defaultValue={survey.surveyor ?? ""} required={complete} maxLength={200} />
            </Field>
            <Field label="Notes" htmlFor="notes" className="sm:col-span-3" hint="Condition observations, access notes, weather, etc.">
              <Textarea id="notes" name="notes" defaultValue={survey.notes ?? ""} rows={5} maxLength={10000} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit">{pending ? "Saving…" : "Save survey"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
