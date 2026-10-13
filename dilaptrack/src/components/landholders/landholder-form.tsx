"use client";

import { createLandholder, updateLandholder, type SavedLandholder } from "@/actions/landholders";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { Tables } from "@/lib/database.types";

/** Add or edit a landholder in the registry. */
export function LandholderForm({
  landholder,
  defaultName = "",
  onSaved,
}: {
  landholder?: Tables<"landholders">;
  defaultName?: string;
  onSaved?: (saved: { id: string; name: string }) => void;
}) {
  return (
    <ActionForm
      action={(fd) => (landholder ? updateLandholder(landholder.id, fd) : createLandholder(fd))}
      onSuccess={(result) => {
        const saved = (result as SavedLandholder).landholder;
        onSaved?.(saved ?? { id: landholder!.id, name: "" });
      }}
    >
      {(pending) => (
        <>
          <Field label="Name" htmlFor="lh-name" required hint="Person or company, as it should appear on reports.">
            <Input id="lh-name" name="name" defaultValue={landholder?.name ?? defaultName} required maxLength={200} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="lh-phone">
              <Input id="lh-phone" name="phone" type="tel" defaultValue={landholder?.phone ?? ""} maxLength={50} />
            </Field>
            <Field label="Email" htmlFor="lh-email">
              <Input id="lh-email" name="email" type="email" defaultValue={landholder?.email ?? ""} maxLength={200} />
            </Field>
          </div>
          <Field label="Postal address" htmlFor="lh-postal">
            <Input id="lh-postal" name="postal_address" defaultValue={landholder?.postal_address ?? ""} maxLength={300} />
          </Field>
          <Field label="Notes" htmlFor="lh-notes" hint="Access arrangements, preferred contact times, agents, etc.">
            <Textarea id="lh-notes" name="notes" defaultValue={landholder?.notes ?? ""} rows={3} maxLength={5000} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit">{pending ? "Saving…" : landholder ? "Save changes" : "Add landholder"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
