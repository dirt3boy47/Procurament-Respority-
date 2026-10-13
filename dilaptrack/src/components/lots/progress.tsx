import { Check, Circle, Minus } from "lucide-react";
import { closeoutChecklist } from "@/lib/closeout";
import type { LotOverview } from "@/lib/data";
import { cn } from "@/lib/utils";

export { closeoutChecklist };

/** Five small dots showing close-out progress, for register rows. */
export function ProgressDots({ lot }: { lot: LotOverview }) {
  const items = closeoutChecklist(lot);
  const done = items.filter((i) => i.done).length;
  return (
    <span className="inline-flex items-center gap-1" title={items.map((i) => `${i.done ? "✓" : "✗"} ${i.label}`).join("\n")}>
      {items.map((i) => (
        <span
          key={i.key}
          className={cn("size-2 rounded-full", i.done ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}
          aria-hidden
        />
      ))}
      <span className="sr-only">
        {done} of {items.length} close-out conditions met
      </span>
    </span>
  );
}

/** Small tick / dash / circle for a single condition. */
export function StepIcon({ state }: { state: "done" | "todo" | "na" }) {
  if (state === "done")
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check className="size-3.5" strokeWidth={3} aria-label="Done" />
      </span>
    );
  if (state === "na") return <Minus className="size-5 text-muted-fg" aria-label="Not applicable" />;
  return <Circle className="size-5 text-slate-300 dark:text-slate-600" aria-label="Not done" />;
}
