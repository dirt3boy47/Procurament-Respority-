"use server";

import { revalidatePath } from "next/cache";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { actionSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attachmentPaths, removeFiles } from "./files-cleanup";

/** Delete an issued report and its PDF (managers). */
export async function deleteIssuedReport(reportId: string): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();
  const { data: report } = await supabase.from("issued_reports").select("attachment_id").eq("id", reportId).single();
  if (!report) return fail("Report not found");
  const paths = await attachmentPaths(supabase, "id", report.attachment_id);
  // Deleting the PDF's attachment row also deletes the issued-report record.
  const { error } = await supabase.from("attachments").delete().eq("id", report.attachment_id);
  if (error) return dbError(error);
  await removeFiles(supabase, paths);
  revalidatePath("/", "layout");
  return ok("Report deleted");
}

export async function revalidateLot() {
  revalidatePath("/", "layout");
}
