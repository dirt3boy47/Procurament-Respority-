"use client";

/* eslint-disable @next/next/no-img-element -- signed Supabase URLs are shown as-is */
import { Check, Eye, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { LANDHOLDER_ROLES, labelFor } from "@/lib/constants";
import type { LotOverview } from "@/lib/data";
import type { Tables } from "@/lib/database.types";
import { formatDate } from "@/lib/format";
import { slugify } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import type { ReportLandholder } from "@/reports/reports";

export type BuilderPhoto = {
  id: string;
  src: string;
  caption: string;
  folder: string;
  landholderId: string | null;
  createdAt: string;
};

type Landholder = ReportLandholder & { id: string };

const RECIPIENTS = ["Principal", "Landholder", "Council", "Insurer", "Project file"];

export function ReportBuilder({
  lot,
  landholders,
  surveys,
  photos,
  canSave,
  project,
  generatedBy,
}: {
  lot: LotOverview;
  landholders: Landholder[];
  surveys: Tables<"surveys">[];
  photos: BuilderPhoto[];
  canSave: boolean;
  project: string;
  generatedBy: string;
}) {
  const router = useRouter();
  const [landholderId, setLandholderId] = useState("");
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [issuedTo, setIssuedTo] = useState("Principal");
  const [introduction, setIntroduction] = useState("");
  const [include, setInclude] = useState({ details: true, landholders: true, surveys: true });
  const [onlyTheirs, setOnlyTheirs] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);

  const landholder = landholders.find((l) => l.id === landholderId) ?? null;
  const title = customTitle ?? `Condition Report - Lot ${lot.lot_number}${landholder ? ` - ${landholder.name}` : ""}`;
  const names = useMemo(() => Object.fromEntries(landholders.map((l) => [l.id, l.name])), [landholders]);

  const visible = useMemo(
    () => photos.filter((p) => !landholder || !onlyTheirs || p.landholderId === null || p.landholderId === landholder.id),
    [photos, landholder, onlyTheirs],
  );
  const groups = useMemo(() => {
    const map = new Map<string, BuilderPhoto[]>();
    for (const p of visible) map.set(p.folder, [...(map.get(p.folder) ?? []), p]);
    return [...map.entries()];
  }, [visible]);
  const chosen = visible.filter((p) => selected.has(p.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  async function build() {
    const { renderCustomReport } = await import("@/reports/render");
    return renderCustomReport({
      meta: { project, generatedBy },
      title,
      issuedTo: issuedTo.trim() || null,
      introduction: introduction.trim() || null,
      lot,
      landholder,
      include,
      landholders,
      surveys,
      photos: chosen.map((p) => ({
        src: p.src,
        group: p.folder,
        caption: [p.caption, p.landholderId && names[p.landholderId], formatDate(p.createdAt)].filter(Boolean).join(" - "),
      })),
    });
  }

  async function preview() {
    const tab = window.open("", "_blank");
    tab?.document.write("<p style='font:16px system-ui;padding:24px'>Preparing report…</p>");
    setBusy("preview");
    try {
      const url = URL.createObjectURL(await build());
      if (tab) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      toast.error((e as Error).message || "Couldn't create the report");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!title.trim()) return void toast.error("Give the report a title.");
    setBusy("save");
    try {
      const blob = await build();
      const supabase = createClient();
      const fileName = `${slugify(title)}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const attachmentId = await uploadFile(supabase, new File([blob], fileName, { type: "application/pdf" }), {
        lotId: lot.id,
        lotNumber: lot.lot_number,
        category: "reports",
        landholderId: landholder?.id ?? null,
        caption: title,
      });
      const { error } = await supabase.from("issued_reports").insert({
        lot_id: lot.id,
        landholder_id: landholder?.id ?? null,
        attachment_id: attachmentId,
        title: title.trim(),
        issued_to: issuedTo.trim() || null,
        notes: introduction.trim() || null,
        photo_count: chosen.length,
      });
      if (error) throw new Error(error.message);
      toast.success("Report saved to the lot" + (landholder ? ` and ${landholder.name}` : ""));
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Couldn't save the report");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Landholder" htmlFor="rb-landholder" hint="Report on one landholder's property, or the whole lot.">
          <Select id="rb-landholder" value={landholderId} onChange={(e) => setLandholderId(e.target.value)}>
            <option value="">Whole lot</option>
            {landholders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} - {labelFor(LANDHOLDER_ROLES, l.role)}
                {l.property ? ` (${l.property})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prepared for" htmlFor="rb-to">
          <Input id="rb-to" list="rb-recipients" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} maxLength={200} />
          <datalist id="rb-recipients">
            {RECIPIENTS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="Title" htmlFor="rb-title" className="sm:col-span-2">
          <Input id="rb-title" value={title} onChange={(e) => setCustomTitle(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Introduction" htmlFor="rb-intro" className="sm:col-span-2" hint="Optional: purpose of the report, request reference, etc.">
          <Textarea id="rb-intro" value={introduction} onChange={(e) => setIntroduction(e.target.value)} rows={3} maxLength={5000} />
        </Field>
      </div>

      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="mb-2 text-sm font-medium">Include</legend>
        <Checkbox checked={include.details} onChange={(e) => setInclude({ ...include, details: e.target.checked })} label="Lot details" />
        <Checkbox
          checked={include.landholders}
          onChange={(e) => setInclude({ ...include, landholders: e.target.checked })}
          label={landholder ? "Landholder, damage and acceptance" : "Landholders, damage and acceptance"}
        />
        <Checkbox checked={include.surveys} onChange={(e) => setInclude({ ...include, surveys: e.target.checked })} label="Surveys and notes" />
      </fieldset>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Photos <span className="font-normal text-muted-fg">({chosen.length} selected)</span>
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {landholder && (
              <Checkbox
                checked={onlyTheirs}
                onChange={(e) => setOnlyTheirs(e.target.checked)}
                label={`Only ${landholder.name}'s and general photos`}
              />
            )}
            <button type="button" className="text-primary hover:underline" onClick={() => setMany(visible.map((p) => p.id), true)}>
              Select all
            </button>
            <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-fg">No photos on this lot yet.</p>
        ) : (
          groups.map(([folder, items]) => (
            <div key={folder} className="mb-4">
              <div className="mb-1.5 flex items-center gap-3 text-xs text-muted-fg">
                <span className="font-medium tracking-wide uppercase">{folder}</span>
                <button type="button" className="hover:text-fg hover:underline" onClick={() => setMany(items.map((p) => p.id), true)}>
                  all
                </button>
                <button type="button" className="hover:text-fg hover:underline" onClick={() => setMany(items.map((p) => p.id), false)}>
                  none
                </button>
              </div>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {items.map((p) => {
                  const on = selected.has(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => toggle(p.id)}
                        aria-pressed={on}
                        title={p.caption}
                        className={cn(
                          "relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-muted",
                          on ? "border-primary" : "border-transparent opacity-80 hover:opacity-100",
                        )}
                      >
                        <img src={p.src} alt={p.caption} loading="lazy" className="size-full object-cover" />
                        <span
                          className={cn(
                            "absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border",
                            on ? "border-primary bg-primary text-primary-fg" : "border-white/80 bg-black/30",
                          )}
                        >
                          {on && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                        {p.landholderId && names[p.landholderId] && (
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-left text-[10px] text-white">
                            {names[p.landholderId]}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="secondary" onClick={preview} disabled={busy !== null}>
          {busy === "preview" ? <Loader2 className="animate-spin" /> : <Eye />} Preview PDF
        </Button>
        {canSave && (
          <Button onClick={save} disabled={busy !== null}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Create and save report
          </Button>
        )}
      </div>
      {canSave && (
        <p className="text-xs text-muted-fg">
          Saving stores the PDF on this lot{landholder ? ` and against ${landholder.name}` : ""}, with who it was prepared for, so a
          copy is always available on request.
        </p>
      )}
    </div>
  );
}
