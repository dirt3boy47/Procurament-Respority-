import Link from "next/link";
import { describeChange, fieldName, formatValue, type AuditEntry } from "@/lib/audit";
import type { Json } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";

const value = (data: Json | null, key: string) =>
  data && typeof data === "object" && !Array.isArray(data) ? data[key] : undefined;

/** Audit entries with field-level before/after values. */
export function AuditList({ entries, lots }: { entries: AuditEntry[]; lots?: Map<string, { lot_number: string }> }) {
  if (entries.length === 0) return <p className="px-4 py-6 text-sm text-muted-fg sm:px-5">No changes recorded yet.</p>;
  return (
    <ol className="divide-y divide-border">
      {entries.map((e) => {
        const lot = lots && e.lot_id ? lots.get(e.lot_id) : undefined;
        return (
          <li key={e.id} className="px-4 py-3 text-sm sm:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p>
                <span className="font-medium">{e.actor_name ?? "System"}</span> {describeChange(e)}
                {lot && (
                  <>
                    {" "}
                    on{" "}
                    <Link href={`/lots/${e.lot_id}/history`} className="text-primary hover:underline">
                      Lot {lot.lot_number}
                    </Link>
                  </>
                )}
              </p>
              <time className="text-xs text-muted-fg" dateTime={e.created_at}>
                {formatDateTime(e.created_at)}
              </time>
            </div>
            {e.action === "UPDATE" && e.changed_fields && (
              <ul className="mt-1.5 space-y-0.5 text-xs">
                {e.changed_fields.map((f) => (
                  <li key={f} className="text-muted-fg">
                    <span className="font-medium text-fg">{fieldName(f)}:</span>{" "}
                    <span className="line-through decoration-red-400/60">{formatValue(value(e.old_data, f))}</span> →{" "}
                    <span className="text-fg">{formatValue(value(e.new_data, f))}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
