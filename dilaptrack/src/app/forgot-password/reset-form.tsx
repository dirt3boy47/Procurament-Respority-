"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/actions/auth";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ResetForm() {
  const [sent, setSent] = useState(false);
  if (sent) return <p className="text-sm">Check your inbox for the reset link. It can take a minute to arrive.</p>;
  return (
    <ActionForm action={requestPasswordReset} onSuccess={() => setSent(true)}>
      {(pending) => (
        <>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <Button type="submit" className="w-full">
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}
