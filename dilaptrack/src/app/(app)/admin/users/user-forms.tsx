"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { inviteUser, updateUserAccess } from "@/actions/users";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ROLES } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";
import { formatDate } from "@/lib/format";

export function UserRow({ user, isMe }: { user: Tables<"profiles">; isMe: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const [pending, startTransition] = useTransition();
  const dirty = role !== user.role || active !== user.active;

  function save() {
    startTransition(async () => {
      const res = await updateUserAccess(user.id, role, active);
      if (!res.ok) {
        toast.error(res.error);
        setRole(user.role);
        setActive(user.active);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{user.full_name || user.email}</span>
          {isMe && <Badge tone="blue">You</Badge>}
          {!user.active && <Badge tone="amber">No access</Badge>}
        </p>
        <p className="truncate text-xs text-muted-fg">
          {user.email} · joined {formatDate(user.created_at)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="h-9 w-44" aria-label="Role" disabled={pending}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <Select
          value={active ? "active" : "inactive"}
          onChange={(e) => setActive(e.target.value === "active")}
          className="h-9 w-32"
          aria-label="Access"
          disabled={pending}
        >
          <option value="active">Has access</option>
          <option value="inactive">No access</option>
        </Select>
        {dirty && (
          <Button size="sm" onClick={save} disabled={pending}>
            Save
          </Button>
        )}
      </div>
    </li>
  );
}

export function InviteForm() {
  const router = useRouter();
  return (
    <ActionForm action={inviteUser} resetOnSuccess onSuccess={() => router.refresh()}>
      {(pending) => (
        <>
          <Field label="Name" htmlFor="invite-name">
            <Input id="invite-name" name="full_name" required maxLength={100} />
          </Field>
          <Field label="Email" htmlFor="invite-email">
            <Input id="invite-email" name="email" type="email" required />
          </Field>
          <Field label="Role" htmlFor="invite-role">
            <Select id="invite-role" name="role" defaultValue="site_engineer">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">{pending ? "Sending…" : "Send invitation"}</Button>
        </>
      )}
    </ActionForm>
  );
}
