"use client";

import { useRouter } from "next/navigation";
import { recordAcceptance } from "@/actions/lot-landholders";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { todayISO } from "@/lib/format";

export function AcceptanceForm({ linkId, defaultName }: { linkId: string; defaultName: string }) {
  const router = useRouter();
  return (
    <ActionForm action={(fd) => recordAcceptance(linkId, fd)} onSuccess={() => router.refresh()}>
      {(pending) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Accepted by" htmlFor={`acc-name-${linkId}`} required>
              <Input id={`acc-name-${linkId}`} name="acceptance_name" defaultValue={defaultName} required maxLength={200} />
            </Field>
            <Field label="Date of written acceptance" htmlFor={`acc-date-${linkId}`} required>
              <Input id={`acc-date-${linkId}`} name="acceptance_date" type="date" defaultValue={todayISO()} required />
            </Field>
          </div>
          <Field label="Notes" htmlFor={`acc-notes-${linkId}`}>
            <Textarea id={`acc-notes-${linkId}`} name="acceptance_notes" rows={2} maxLength={5000} />
          </Field>
          <div>
            <Button type="submit">{pending ? "Saving…" : "Record written acceptance"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
