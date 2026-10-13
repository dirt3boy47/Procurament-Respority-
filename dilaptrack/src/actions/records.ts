"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { actionSession } from "@/lib/auth";
import { STORAGE_BUCKET } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, formFields, optionalDate, text, uuid } from "@/lib/validation";
import { attachmentPaths, removeFiles } from "./files-cleanup";

// ---------------------------------------------------------------- surveys

const surveySchema = z
  .object({
    status: z.enum(["not_started", "scheduled", "in_progress", "complete"]),
    survey_date: optionalDate,
    surveyor: text(200),
    notes: text(10000),
  })
  .refine((s) => s.status !== "complete" || (s.survey_date && s.surveyor), {
    message: "A completed survey needs a survey date and surveyor.",
  });

export async function updateSurvey(surveyId: string, formData: FormData): Promise<ActionResult> {
  const session = await actionSession("editRecords");
  if ("error" in session) return fail(session.error);
  if (!uuid.safeParse(surveyId).success) return fail("Unknown survey");
  const parsed = surveySchema.safeParse(formFields(formData, ["status", "survey_date", "surveyor", "notes"]));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error, count } = await supabase.from("surveys").update(parsed.data, { count: "exact" }).eq("id", surveyId);
  if (error) return dbError(error);
  if (!count) return fail("Survey not found, or you don't have permission to change it.");
  revalidatePath("/", "layout");
  return ok("Survey saved");
}

// ---------------------------------------------------------------- files

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  const session = await actionSession("editRecords");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();
  const paths = await attachmentPaths(supabase, "id", attachmentId);
  const { error, count } = await supabase.from("attachments").delete({ count: "exact" }).eq("id", attachmentId);
  if (error) return dbError(error);
  if (!count) return fail("You can only delete files you uploaded.");
  await removeFiles(supabase, paths);
  revalidatePath("/", "layout");
  return ok("File deleted");
}

export async function updateCaption(attachmentId: string, caption: string): Promise<ActionResult> {
  const session = await actionSession("editRecords");
  if ("error" in session) return fail(session.error);
  const parsed = text(500).safeParse(caption);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("attachments").update({ caption: parsed.data }).eq("id", attachmentId);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok("Caption saved");
}

/** A signed download link for one file (used by the gallery's download button). */
export async function downloadUrl(attachmentId: string): Promise<{ url?: string; error?: string }> {
  const session = await actionSession("view");
  if ("error" in session) return { error: session.error };
  const supabase = await createClient();
  const { data: file } = await supabase.from("attachments").select("storage_path, file_name").eq("id", attachmentId).single();
  if (!file) return { error: "File not found" };
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.storage_path, 300, { download: file.file_name });
  return error ? { error: error.message } : { url: data.signedUrl };
}
