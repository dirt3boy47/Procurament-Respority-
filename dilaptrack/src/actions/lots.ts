"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { actionSession } from "@/lib/auth";
import type { ImportLot } from "@/lib/import";
import { MAX_IMPORT_ROWS } from "@/lib/import";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, formFields, requiredText, text, uuid } from "@/lib/validation";
import { attachmentPaths, removeFiles } from "./files-cleanup";

const LOT_FIELDS = ["lot_number", "address", "chainage", "status", "assigned_engineer", "notes"] as const;

const lotSchema = z.object({
  lot_number: requiredText("Lot number", 50),
  address: text(300),
  chainage: text(50),
  status: z.enum(["not_started", "in_progress", "on_hold"], { message: "Choose a status" }),
  assigned_engineer: text(100),
  notes: text(5000),
});

export async function createLot(formData: FormData): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const parsed = lotSchema.safeParse(formFields(formData, LOT_FIELDS));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const landholderId = String(formData.get("landholder_id") ?? "");
  if (landholderId && !uuid.safeParse(landholderId).success) return fail("Choose a landholder from the list");

  const supabase = await createClient();
  const { data, error } = await supabase.from("lots").insert(parsed.data).select("id").single();
  if (error) return dbError(error);
  // The first landholder; more can be added on the lot page.
  if (landholderId) {
    const { error: linkError } = await supabase
      .from("lot_landholders")
      .insert({ lot_id: data.id, landholder_id: landholderId, role: "owner" });
    if (linkError) return dbError(linkError);
  }
  revalidatePath("/", "layout");
  return ok(`Lot ${parsed.data.lot_number} created`, data.id);
}

export async function updateLot(lotId: string, formData: FormData): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  if (!uuid.safeParse(lotId).success) return fail("Unknown lot");

  // A closed lot keeps its status; it is reopened from the close-out page.
  const schema = lotSchema.extend({ status: z.enum(["not_started", "in_progress", "on_hold", "closed"]) });
  const parsed = schema.safeParse(formFields(formData, LOT_FIELDS));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { data: current } = await supabase.from("lots").select("status").eq("id", lotId).single();
  if (current && (current.status === "closed") !== (parsed.data.status === "closed")) {
    return fail("Close or reopen a lot from its Close-out page.");
  }
  const { error } = await supabase.from("lots").update(parsed.data).eq("id", lotId);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok("Lot updated");
}

export async function deleteLot(lotId: string): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();
  const paths = await attachmentPaths(supabase, "lot_id", lotId);
  const { error, count } = await supabase.from("lots").delete({ count: "exact" }).eq("id", lotId);
  if (error) return dbError(error);
  if (!count) return fail("Lot not found, or you don't have permission to delete it.");
  await removeFiles(supabase, paths);
  revalidatePath("/", "layout");
  redirect("/lots");
}

const importRowSchema = z.object({
  lot_number: z.string().trim().min(1).max(50),
  address: z.string().max(300),
  landholder: z.string().max(200),
  landholder_contact: z.string().max(200),
  chainage: z.string().max(50),
  status: z.enum(["not_started", "in_progress", "on_hold"]),
  assigned_engineer: z.string().max(100),
  notes: z.string().max(5000),
});

export async function importLots(
  rows: ImportLot[],
): Promise<ActionResult & { inserted?: number; newLandholders?: number; linked?: number; skipped?: string[] }> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const parsed = z.array(importRowSchema).min(1, "There are no rows to import").max(MAX_IMPORT_ROWS).safeParse(rows);
  if (!parsed.success) return fail(`Import data is invalid: ${firstIssue(parsed.error)}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_lots", { p_rows: parsed.data });
  if (error) return dbError(error);
  const result = data as { inserted: number; new_landholders: number; linked: number; skipped: string[] };
  revalidatePath("/", "layout");
  return {
    ...ok(`Imported ${result.inserted} lot${result.inserted === 1 ? "" : "s"}`),
    inserted: result.inserted,
    newLandholders: result.new_landholders,
    linked: result.linked,
    skipped: result.skipped,
  };
}

export async function setLotClosed(lotId: string, closed: boolean): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lots")
    .update({ status: closed ? "closed" : "in_progress" })
    .eq("id", lotId);
  if (error) {
    // The database explains which close-out conditions are unmet.
    const reason = error.message.match(/cannot be closed: (.*)$/)?.[1];
    return reason ? fail(`Can't close this lot yet: ${reason}.`) : dbError(error);
  }
  revalidatePath("/", "layout");
  return ok(closed ? "Lot closed" : "Lot reopened");
}
