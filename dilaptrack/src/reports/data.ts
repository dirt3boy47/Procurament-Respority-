import "server-only";
import type { Tables } from "@/lib/database.types";
import { STORAGE_BUCKET } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { PdfPhoto } from "./kit";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Attachment = Tables<"attachments">;

/** Which stored image to embed: the JPEG preview, or a JPEG/PNG original. */
function embeddable(a: Attachment): { path: string; format: "jpg" | "png" } | null {
  if (a.preview_path) return { path: a.preview_path, format: "jpg" };
  if (a.mime_type === "image/jpeg") return { path: a.storage_path, format: "jpg" };
  if (a.mime_type === "image/png") return { path: a.storage_path, format: "png" };
  return null;
}

/** Download photos for a report (a few at a time). Photos that fail to load are left out. */
export async function loadPhotos(supabase: Supabase, attachments: Attachment[], limit: number): Promise<PdfPhoto[]> {
  const chosen = attachments
    .filter((a) => a.kind === "photo")
    .map((a) => ({ a, src: embeddable(a) }))
    .filter((x): x is { a: Attachment; src: NonNullable<ReturnType<typeof embeddable>> } => x.src !== null)
    .slice(0, limit);

  const results: (PdfPhoto | null)[] = new Array(chosen.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < chosen.length) {
      const i = next++;
      const { a, src } = chosen[i];
      const { data } = await supabase.storage.from(STORAGE_BUCKET).download(src.path);
      if (!data) continue;
      results[i] = {
        data: Buffer.from(await data.arrayBuffer()),
        format: src.format,
        caption: [a.caption || a.file_name, formatDate(a.created_at)].join(" - "),
      };
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return results.filter((p): p is PdfPhoto => p !== null);
}
