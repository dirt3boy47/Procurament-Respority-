"use client";

import { saveDefect } from "@/actions/records";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { DEFECT_PRIORITIES, DEFECT_STATUSES } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";

export function DefectForm({
  lotId,
  defect,
  names,
  onSaved,
}: {
  lotId: string;
  defect?: Tables<"defects">;
  names: string[];
  onSaved: (id?: string) => void;
}) {
  return (
    <ActionForm action={(fd) => saveDefect(lotId, defect?.id ?? null, fd)} onSuccess={(r) => onSaved(r.ok ? r.id : undefined)}>
      {(pending) => (
        <>
          <Field label="Description" htmlFor="description" required>
            <Textarea
              id="description"
              name="description"
              defaultValue={defect?.description ?? ""}
              required
              rows={3}
              maxLength={2000}
              placeholder="What and where, e.g. 'New crack in driveway slab, 1.2 m long, near front gate'"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority" htmlFor="priority">
              <Select id="priority" name="priority" defaultValue={defect?.priority ?? "medium"}>
                {DEFECT_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={defect?.status ?? "open"}>
                {DEFECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned to" htmlFor="assigned_to">
              <Input id="assigned_to" name="assigned_to" list="defect-names" defaultValue={defect?.assigned_to ?? ""} maxLength={200} />
              <datalist id="defect-names">
                {names.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label="Due date" htmlFor="due_date">
              <Input id="due_date" name="due_date" type="date" defaultValue={defect?.due_date ?? ""} />
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={defect?.notes ?? ""} rows={3} maxLength={5000} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit">{pending ? "Saving…" : defect ? "Save changes" : "Add defect"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
