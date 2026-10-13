"use client";

import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LandholderForm } from "./landholder-form";

export type LandholderOption = { id: string; name: string; phone?: string | null };

/**
 * Choose a lot's landholder from the registry, with type-to-search and
 * "add a new landholder" without leaving the form. Submits `landholder_id`.
 */
export function LandholderPicker({
  options: initialOptions,
  defaultId,
  canAdd,
  name = "landholder_id",
}: {
  options: LandholderOption[];
  defaultId?: string | null;
  canAdd: boolean;
  name?: string;
}) {
  const listId = useId();
  const [options, setOptions] = useState(initialOptions);
  const [selected, setSelected] = useState(defaultId ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.id === selected);
  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return options
      .filter((o) => words.every((w) => `${o.name} ${o.phone ?? ""}`.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 100);
  }, [options, query]);
  const exact = options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(id: string) {
    setSelected(id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // don't submit the lot form
      if (matches[active]) choose(matches[active].id);
      else if (canAdd && query.trim()) setAdding(true);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        id="landholder"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm shadow-sm focus:border-ring focus:outline-2 focus:outline-ring/30"
      >
        <span className={cn("truncate", !current && "text-muted-fg")}>{current?.name ?? "Choose a landholder…"}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-fg" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-fg" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search landholders…"
              aria-controls={listId}
              aria-label="Search landholders"
              className="h-10 w-full rounded-t-lg bg-transparent pr-3 pl-9 text-sm outline-none"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {!query && (
              <li
                role="option"
                aria-selected={selected === ""}
                onClick={() => choose("")}
                className="cursor-pointer px-3 py-2 text-sm text-muted-fg hover:bg-muted"
              >
                No landholder
              </li>
            )}
            {matches.map((o, i) => (
              <li
                key={o.id}
                role="option"
                aria-selected={o.id === selected}
                onClick={() => choose(o.id)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center gap-2 px-3 py-2 text-sm", i === active && "bg-muted")}
              >
                <Check className={cn("size-4 shrink-0", o.id === selected ? "text-primary" : "invisible")} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                {o.phone && <span className="shrink-0 text-xs text-muted-fg">{o.phone}</span>}
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted-fg">No matching landholders.</li>}
          </ul>
          {canAdd && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-muted"
            >
              <Plus className="size-4" />
              {query.trim() && !exact ? `Add “${query.trim()}” as a new landholder` : "Add a new landholder"}
            </button>
          )}
        </div>
      )}

      {/* Rendered outside the lot form: forms can't be nested. */}
      {adding &&
        createPortal(
          <Dialog open onClose={() => setAdding(false)} title="Add landholder" description="Adds them to the landholder register.">
            <LandholderForm
              defaultName={exact ? "" : query.trim()}
              onSaved={(saved) => {
                setOptions((prev) => [...prev, { id: saved.id, name: saved.name }]);
                choose(saved.id);
                setAdding(false);
              }}
            />
          </Dialog>,
          document.body,
        )}
    </div>
  );
}
