import "server-only";
import { STORAGE_BUCKET } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Storage paths (originals and previews) for attachments matching a column. */
export async function attachmentPaths(
  supabase: Supabase,
  column: "lot_id" | "id",
  value: string,
) {
  const { data } = await supabase.from("attachments").select("storage_path, preview_path").eq(column, value);
  return (data ?? []).flatMap((a) => [a.storage_path, a.preview_path].filter((p): p is string => Boolean(p)));
}

/** Remove files from storage after their records are deleted. Failures only leave orphaned files. */
export async function removeFiles(supabase: Supabase, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths.slice(i, i + 100));
    if (error) console.error("Could not remove files from storage", error.message);
  }
}
