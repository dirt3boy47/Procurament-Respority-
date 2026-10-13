"use client";

import { useRouter } from "next/navigation";
import { updateMyName, updatePassword } from "@/actions/auth";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function NameForm({ name }: { name: string }) {
  const router = useRouter();
  return (
    <ActionForm action={updateMyName} onSuccess={() => router.refresh()} className="sm:flex-row sm:items-end">
      <Field label="Full name" htmlFor="full_name" className="flex-1">
        <Input id="full_name" name="full_name" defaultValue={name} required maxLength={100} />
      </Field>
      <Button type="submit">Save</Button>
    </ActionForm>
  );
}

export function PasswordForm({ onDone }: { onDone?: () => void }) {
  return (
    <ActionForm action={updatePassword} resetOnSuccess onSuccess={onDone}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
      </div>
      <div>
        <Button type="submit">Update password</Button>
      </div>
    </ActionForm>
  );
}
