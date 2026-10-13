import type { Metadata } from "next";
import Link from "next/link";
import { AuditList } from "@/components/audit-list";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireCapability } from "@/lib/auth";
import { lotNumbers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 100;
const TABLES = [
  ["", "All records"],
  ["lots", "Lots"],
  ["surveys", "Surveys"],
  ["landholders", "Landholders"],
  ["attachments", "Files"],
  ["profiles", "Users"],
] as const;

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  await requireCapability("manage");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const table = typeof params.table === "string" ? params.table : "";

  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (table) query = query.eq("table_name", table);
  const [{ data }, lots] = await Promise.all([query, lotNumbers()]);
  const entries = data ?? [];
  const hasMore = entries.length > PAGE_SIZE;
  const href = (p: number, t = table) => `/audit?${new URLSearchParams({ ...(t && { table: t }), ...(p > 1 && { page: String(p) }) })}`;

  return (
    <>
      <PageHeader title="Audit log" description="Every change made in DilapTrack: who, what and when. Entries can't be edited or deleted." />
      <div className="mb-3 flex flex-wrap gap-1">
        {TABLES.map(([value, label]) => (
          <Link
            key={value}
            href={href(1, value)}
            className={buttonClasses(table === value ? "primary" : "secondary", "sm")}
          >
            {label}
          </Link>
        ))}
      </div>
      <Card>
        <AuditList entries={entries.slice(0, PAGE_SIZE)} lots={lots} />
      </Card>
      <div className="mt-4 flex justify-between">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonClasses("secondary", "sm")}>
            Newer
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={href(page + 1)} className={buttonClasses("secondary", "sm")}>
            Older
          </Link>
        )}
      </div>
    </>
  );
}
