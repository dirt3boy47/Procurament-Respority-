"use server";

import { revalidatePath } from "next/cache";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { actionSession } from "@/lib/auth";
import { DEMO_NOTE, DEMO_PREFIX } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { removeFiles } from "./files-cleanup";

/** Delete the demo lots (with their files) and demo landholders that no longer have lots. */
export async function removeDemoData(): Promise<ActionResult> {
  const session = await actionSession("admin");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();

  const { data: lots } = await supabase.from("lots").select("id").like("lot_number", `${DEMO_PREFIX}%`);
  const lotIds = (lots ?? []).map((l) => l.id);
  if (lotIds.length) {
    const { data: files } = await supabase.from("attachments").select("storage_path, preview_path").in("lot_id", lotIds);
    const { error } = await supabase.from("lots").delete().in("id", lotIds);
    if (error) return dbError(error);
    await removeFiles(
      supabase,
      (files ?? []).flatMap((f) => [f.storage_path, f.preview_path].filter((p): p is string => Boolean(p))),
    );
  }

  const { data: owners } = await supabase.from("landholders").select("id").eq("notes", DEMO_NOTE);
  const { data: stillUsed } = await supabase.from("lots").select("landholder_id").not("landholder_id", "is", null);
  const used = new Set((stillUsed ?? []).map((l) => l.landholder_id));
  const removable = (owners ?? []).map((o) => o.id).filter((id) => !used.has(id));
  if (removable.length) {
    const { error } = await supabase.from("landholders").delete().in("id", removable);
    if (error) return dbError(error);
  }

  revalidatePath("/", "layout");
  return ok(`Removed ${lotIds.length} demo lots and ${removable.length} demo landholders`);
}
