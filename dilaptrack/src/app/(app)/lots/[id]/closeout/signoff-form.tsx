"use client";

import { useRouter } from "next/navigation";
import { recordSignoff } from "@/actions/lots";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { todayISO } from "@/lib/format";

export function SignoffForm({ lotId, landholder }: { lotId: string; landholder: string }) {
  const router = useRouter();
  return (
    <ActionForm action={(fd) => recordSignoff(lotId, fd)} onSuccess={() => router.refresh()}>
      {(pending) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Accepted by" htmlFor="landholder_signoff_name" required>
              <Input id="landholder_signoff_name" name="landholder_signoff_name" defaultValue={landholder} required maxLength={200} />
            </Field>
            <Field label="Date accepted" htmlFor="landholder_signoff_date" required>
              <Input id="landholder_signoff_date" name="landholder_signoff_date" type="date" defaultValue={todayISO()} required />
            </Field>
          </div>
          <Field label="Notes" htmlFor="landholder_signoff_notes">
            <Textarea id="landholder_signoff_notes" name="landholder_signoff_notes" rows={2} maxLength={5000} />
          </Field>
          <div>
            <Button type="submit">{pending ? "Saving…" : "Record acceptance"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
