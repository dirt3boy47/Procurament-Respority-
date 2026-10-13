"use client";

import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { LOT_STATUSES } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";

type LotValues = Partial<
  Pick<
    Tables<"lots">,
    "lot_number" | "address" | "landholder" | "landholder_contact" | "chainage" | "status" | "assigned_engineer" | "notes"
  >
>;

export function LotForm({
  action,
  lot = {},
  engineers,
  submitLabel,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  lot?: LotValues;
  engineers: string[];
  submitLabel: string;
  onSuccess?: (result: ActionResult) => void;
}) {
  const closed = lot.status === "closed";
  return (
    <ActionForm action={action} onSuccess={onSuccess}>
      {(pending) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lot number" htmlFor="lot_number" required>
              <Input id="lot_number" name="lot_number" defaultValue={lot.lot_number ?? ""} required maxLength={50} />
            </Field>
            <Field label="Chainage" htmlFor="chainage" hint='e.g. 12+345 or 12345'>
              <Input id="chainage" name="chainage" defaultValue={lot.chainage ?? ""} maxLength={50} />
            </Field>
            <Field label="Property address" htmlFor="address" className="sm:col-span-2">
              <Input id="address" name="address" defaultValue={lot.address ?? ""} maxLength={300} autoComplete="off" />
            </Field>
            <Field label="Landholder" htmlFor="landholder">
              <Input id="landholder" name="landholder" defaultValue={lot.landholder ?? ""} maxLength={200} />
            </Field>
            <Field label="Landholder contact" htmlFor="landholder_contact" hint="Phone or email">
              <Input id="landholder_contact" name="landholder_contact" defaultValue={lot.landholder_contact ?? ""} maxLength={200} />
            </Field>
            <Field label="Assigned engineer" htmlFor="assigned_engineer">
              <Input
                id="assigned_engineer"
                name="assigned_engineer"
                list="engineer-names"
                defaultValue={lot.assigned_engineer ?? ""}
                maxLength={100}
              />
              <datalist id="engineer-names">
                {engineers.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label="Status" htmlFor="status" hint={closed ? "Reopen the lot from its Close-out page." : undefined}>
              <Select id="status" name="status" defaultValue={lot.status ?? "not_started"} disabled={closed}>
                {LOT_STATUSES.filter((s) => closed || s.value !== "closed").map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              {closed && <input type="hidden" name="status" value="closed" />}
            </Field>
            <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" name="notes" defaultValue={lot.notes ?? ""} rows={4} maxLength={5000} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit">{pending ? "Saving…" : submitLabel}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
