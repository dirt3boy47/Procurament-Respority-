import Link from "next/link";
import { Folder, FolderOpen } from "lucide-react";
import { FileSection } from "@/components/files/file-section";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { FILE_CATEGORIES } from "@/lib/constants";
import { getAttachments, getLot, getLotLandholders } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/lots/[id]/files">) {
  return { title: `Files · Lot ${(await getLot((await params).id)).lot_number}` };
}

export default async function LotFilesPage({ params, searchParams }: PageProps<"/lots/[id]/files">) {
  const session = await requireSession();
  const lot = await getLot((await params).id);
  const { folder } = await searchParams;
  const current = FILE_CATEGORIES.find((c) => c.slug === folder) ?? FILE_CATEGORIES[0];

  const supabase = await createClient();
  const [{ data: all }, files, { data: surveys }, links] = await Promise.all([
    supabase.from("attachments").select("category").eq("lot_id", lot.id),
    getAttachments({ lot_id: lot.id, category: current.value }),
    supabase.from("surveys").select("id, survey_type").eq("lot_id", lot.id),
    getLotLandholders(lot.id),
  ]);
  const counts = new Map<string, number>();
  (all ?? []).forEach((a) => counts.set(a.category, (counts.get(a.category) ?? 0) + 1));
  const surveyId = surveys?.find((s) => s.survey_type === current.value)?.id;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Folders">
        <p className="mb-2 px-2 text-xs font-medium tracking-wide text-muted-fg uppercase">Lot {lot.lot_number}</p>
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {FILE_CATEGORIES.map((c) => {
            const active = c.value === current.value;
            const Icon = active ? FolderOpen : Folder;
            return (
              <li key={c.value}>
                <Link
                  href={`?folder=${c.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-2 text-sm whitespace-nowrap",
                    active ? "bg-primary/10 font-medium text-primary" : "text-muted-fg hover:bg-muted hover:text-fg",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{c.label}</span>
                  <span className="text-xs tabular-nums">{counts.get(c.value) ?? 0}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Card>
        <CardHeader title={current.label} description={`${lot.lot_number} / ${current.slug}`} />
        <CardContent>
          <FileSection
            session={session}
            files={files}
            lotId={lot.id}
            lotNumber={lot.lot_number}
            category={current.value}
            surveyId={surveyId}
            locked={lot.status === "closed" || current.value === "reports"}
            landholders={links.map((l) => ({ id: l.landholder_id, name: l.landholder.name }))}
          />
          {current.value === "reports" && (
            <p className="mt-4 text-xs text-muted-fg">
              Issued reports are created on the lot&apos;s Reports tab, which also records who each was issued to.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
