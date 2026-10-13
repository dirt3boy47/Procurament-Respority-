"use client";

import { useState } from "react";
import { saveReinstatement } from "@/actions/records";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { REINSTATEMENT_STATUSES } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";
import { todayISO } from "@/lib/format";

export function ReinstatementForm({
  lotId,
  item,
  onSaved,
}: {
  lotId: string;
  item?: Tables<"reinstatement_items">;
  onSaved: (id?: string) => void;
}) {
  const [status, setStatus] = useState(item?.status ?? "not_started");
  const [accepted, setAccepted] = useState(item?.landholder_accepted ?? false);
  return (
    <ActionForm
      action={(fd) => saveReinstatement(lotId, item?.id ?? null, fd)}
      onSuccess={(r) => onSaved(r.ok ? r.id : undefined)}
    >
      {(pending) => (
        <>
          <Field label="Required works" htmlFor="required_works" required>
            <Textarea
              id="required_works"
              name="required_works"
              defaultValue={item?.required_works ?? ""}
              required
              rows={3}
              maxLength={2000}
              placeholder="e.g. Reinstate 20 m of post-and-wire fence along the northern boundary"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {REINSTATEMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Completion date" htmlFor="completion_date" required={status === "complete"}>
              <Input
                id="completion_date"
                name="completion_date"
                type="date"
                defaultValue={item?.completion_date ?? (status === "complete" ? todayISO() : "")}
                required={status === "complete"}
              />
            </Field>
          </div>
          <div className="rounded-lg border border-border p-3">
            <Checkbox
              name="landholder_accepted"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              label="Landholder has accepted these works"
            />
            {accepted && (
              <Field label="Date accepted" htmlFor="landholder_accepted_date" className="mt-3">
                <Input
                  id="landholder_accepted_date"
                  name="landholder_accepted_date"
                  type="date"
                  defaultValue={item?.landholder_accepted_date ?? todayISO()}
                />
              </Field>
            )}
          </div>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} rows={3} maxLength={5000} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit">{pending ? "Saving…" : item ? "Save changes" : "Add item"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
