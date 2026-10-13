"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { actionSession } from "@/lib/auth";
import { STORAGE_BUCKET } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, formFields, optionalDate, requiredText, text, uuid } from "@/lib/validation";
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

// ---------------------------------------------------------------- defects

const DEFECT_FIELDS = ["description", "priority", "status", "assigned_to", "due_date", "notes"] as const;
const defectSchema = z.object({
  description: requiredText("Description", 2000),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "in_progress", "closed"]),
  assigned_to: text(200),
  due_date: optionalDate,
  notes: text(5000),
});

export async function saveDefect(lotId: string, defectId: string | null, formData: FormData): Promise<ActionResult> {
  const session = await actionSession("editRecords");
  if ("error" in session) return fail(session.error);
  if (!uuid.safeParse(lotId).success) return fail("Unknown lot");
  const parsed = defectSchema.safeParse(formFields(formData, DEFECT_FIELDS));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  if (defectId) {
    const { error, count } = await supabase
      .from("defects")
      .update(parsed.data, { count: "exact" })
      .eq("id", defectId)
      .eq("lot_id", lotId);
    if (error) return dbError(error);
    if (!count) return fail("Defect not found, or you don't have permission to change it.");
    revalidatePath("/", "layout");
    return ok("Defect updated", defectId);
  }
  const { data, error } = await supabase
    .from("defects")
    .insert({ ...parsed.data, lot_id: lotId })
    .select("id")
    .single();
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok("Defect added", data.id);
}

export async function deleteDefect(defectId: string): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();
  const paths = await attachmentPaths(supabase, "defect_id", defectId);
  const { error, count } = await supabase.from("defects").delete({ count: "exact" }).eq("id", defectId);
  if (error) return dbError(error);
  if (!count) return fail("Defect not found, or you don't have permission to delete it.");
  await removeFiles(supabase, paths);
  revalidatePath("/", "layout");
  return ok("Defect deleted");
}

// ---------------------------------------------------------------- reinstatement

const REINSTATEMENT_FIELDS = ["required_works", "status", "completion_date", "landholder_accepted_date", "notes"] as const;
const reinstatementSchema = z
  .object({
    required_works: requiredText("Required works", 2000),
    status: z.enum(["not_started", "in_progress", "complete"]),
    completion_date: optionalDate,
    landholder_accepted: z.boolean(),
    landholder_accepted_date: optionalDate,
    notes: text(5000),
  })
  .refine((r) => r.status !== "complete" || r.completion_date, {
    message: "Enter the completion date for completed works.",
  });

export async function saveReinstatement(lotId: string, itemId: string | null, formData: FormData): Promise<ActionResult> {
  const session = await actionSession("editRecords");
  if ("error" in session) return fail(session.error);
  if (!uuid.safeParse(lotId).success) return fail("Unknown lot");
  const parsed = reinstatementSchema.safeParse({
    ...formFields(formData, REINSTATEMENT_FIELDS),
    landholder_accepted: formData.get("landholder_accepted") === "on",
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const values = {
    ...parsed.data,
    landholder_accepted_date: parsed.data.landholder_accepted ? parsed.data.landholder_accepted_date : null,
  };

  const supabase = await createClient();
  if (itemId) {
    const { error, count } = await supabase
      .from("reinstatement_items")
      .update(values, { count: "exact" })
      .eq("id", itemId)
      .eq("lot_id", lotId);
    if (error) return dbError(error);
    if (!count) return fail("Item not found, or you don't have permission to change it.");
    revalidatePath("/", "layout");
    return ok("Reinstatement item updated", itemId);
  }
  const { data, error } = await supabase
    .from("reinstatement_items")
    .insert({ ...values, lot_id: lotId })
    .select("id")
    .single();
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok("Reinstatement item added", data.id);
}

export async function deleteReinstatement(itemId: string): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();
  const paths = await attachmentPaths(supabase, "reinstatement_id", itemId);
  const { error, count } = await supabase.from("reinstatement_items").delete({ count: "exact" }).eq("id", itemId);
  if (error) return dbError(error);
  if (!count) return fail("Item not found, or you don't have permission to delete it.");
  await removeFiles(supabase, paths);
  revalidatePath("/", "layout");
  return ok("Reinstatement item deleted");
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
