"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addLotLandholder, removeLotLandholder, updateLotLandholder } from "@/actions/lot-landholders";
import { LandholderPicker, type LandholderOption } from "@/components/landholders/landholder-picker";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { LANDHOLDER_ROLES } from "@/lib/constants";
import type { LotLandholder } from "@/lib/data";
import { formatDate } from "@/lib/format";

function LinkFields({ link }: { link?: LotLandholder }) {
  const [damage, setDamage] = useState(link?.restoration_required ?? false);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" htmlFor="role">
          <Select id="role" name="role" defaultValue={link?.role ?? "owner"}>
            {LANDHOLDER_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Property" htmlFor="property" hint="e.g. 12 Gowrie Rd, or Road reserve">
          <Input id="property" name="property" defaultValue={link?.property ?? ""} maxLength={200} />
        </Field>
      </div>
      <div className="rounded-lg border border-border p-3">
        <Checkbox
          name="restoration_required"
          checked={damage}
          onChange={(e) => setDamage(e.target.checked)}
          label="Damage to this property needs restoring"
        />
        <p className="mt-1 text-xs text-muted-fg">
          Makes the landholder&apos;s written acceptance of the restoration a hold point before the lot can close.
        </p>
        {damage && (
          <Field label="Damage to restore" htmlFor="damage_notes" className="mt-3" required>
            <Textarea id="damage_notes" name="damage_notes" defaultValue={link?.damage_notes ?? ""} rows={3} maxLength={5000} required />
          </Field>
        )}
      </div>
    </>
  );
}

function AddButton({ lotId, options, linkedIds }: { lotId: string; options: LandholderOption[]; linkedIds: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Add landholder
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a landholder to this lot" className="max-w-xl">
        <ActionForm
          action={(fd) => addLotLandholder(lotId, fd)}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        >
          {(pending) => (
            <>
              <Field label="Landholder" htmlFor="landholder" required hint="From the landholder register. Search, or add a new one.">
                <LandholderPicker options={options.filter((o) => !linkedIds.includes(o.id))} canAdd />
              </Field>
              <LinkFields />
              <div className="flex justify-end">
                <Button type="submit">{pending ? "Adding…" : "Add to lot"}</Button>
              </div>
            </>
          )}
        </ActionForm>
      </Dialog>
    </>
  );
}

function EditButton({ link }: { link: LotLandholder }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={`Edit ${link.landholder.name}`}>
        <Pencil />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={link.landholder.name} className="max-w-xl">
        <ActionForm
          action={(fd) => updateLotLandholder(link.id, fd)}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        >
          {(pending) => (
            <>
              <LinkFields link={link} />
              <div className="flex justify-end">
                <Button type="submit">{pending ? "Saving…" : "Save"}</Button>
              </div>
            </>
          )}
        </ActionForm>
      </Dialog>
    </>
  );
}

function RemoveButton({ link }: { link: LotLandholder }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label={`Remove ${link.landholder.name}`}
      onClick={() => {
        if (!confirm(`Remove ${link.landholder.name} from this lot? They stay in the landholder register.`)) return;
        startTransition(async () => {
          const res = await removeLotLandholder(link.id);
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}

/** Acceptance status of one landholder link. */
export function AcceptanceBadge({ link }: { link: LotLandholder }) {
  if (link.acceptance_date)
    return (
      <Badge tone="green">
        <CheckCircle2 className="size-3" /> Accepted {formatDate(link.acceptance_date)}
      </Badge>
    );
  if (link.restoration_required)
    return (
      <Badge tone="amber">
        <AlertTriangle className="size-3" /> Hold point: acceptance needed
      </Badge>
    );
  return <Badge tone="gray">No damage recorded</Badge>;
}

export function LotLandholders({
  lotId,
  links,
  options,
  canEdit,
  canManage,
}: {
  lotId: string;
  links: LotLandholder[];
  options: LandholderOption[];
  canEdit: boolean;
  canManage: boolean;
}) {
  return (
    <div>
      {links.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-fg sm:px-5">No landholders linked yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {links.map((l) => (
            <li key={l.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/landholders/${l.landholder_id}`} className="font-medium text-primary hover:underline">
                    {l.landholder.name}
                  </Link>
                  <StatusBadge options={LANDHOLDER_ROLES} value={l.role} />
                  <AcceptanceBadge link={l} />
                </div>
                <p className="mt-0.5 text-xs text-muted-fg">
                  {[l.property, l.landholder.phone, l.landholder.email].filter(Boolean).join(" · ") || "No contact details"}
                </p>
                {l.restoration_required && l.damage_notes && (
                  <p className="mt-1 text-sm whitespace-pre-wrap">
                    <span className="font-medium">Damage: </span>
                    {l.damage_notes}
                  </p>
                )}
              </div>
              {(canEdit || canManage) && (
                <div className="flex shrink-0 items-center">
                  {canEdit && <EditButton link={l} />}
                  {canManage && <RemoveButton link={l} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="border-t border-border px-4 py-3 sm:px-5">
          <AddButton lotId={lotId} options={options} linkedIds={links.map((l) => l.landholder_id)} />
        </div>
      )}
    </div>
  );
}
