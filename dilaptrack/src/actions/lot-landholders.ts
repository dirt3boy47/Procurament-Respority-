"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { actionSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, formFields, optionalDate, requiredText, text, uuid } from "@/lib/validation";

const ROLES = ["road_authority", "owner", "adjacent_resident", "occupier", "other"] as const;

const linkSchema = z
  .object({
    role: z.enum(ROLES, { message: "Choose a role" }),
    property: text(200),
    restoration_required: z.boolean(),
    damage_notes: text(5000),
  })
  .refine((v) => !v.restoration_required || v.damage_notes, {
    message: "Describe the damage that needs restoring.",
  });

function parseLink(formData: FormData) {
  return linkSchema.safeParse({
    ...formFields(formData, ["role", "property", "damage_notes"]),
    restoration_required: formData.get("restoration_required") === "on",
  });
}

/** Link a landholder from the register to a lot. */
export async function addLotLandholder(lotId: string, formData: FormData): Promise<ActionResult> {
  const session = await actionSession("editRecords");
  if ("error" in session) return fail(session.error);
  const landholderId = String(formData.get("landholder_id") ?? "");
  if (!uuid.safeParse(lotId).success) return fail("Unknown lot");
  if (!uuid.safeParse(landholderId).success) return fail("Choose a landholder from the list");
  const parsed = parseLink(formData);
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("lot_landholders").insert({ lot_id: lotId, landholder_id: landholderId, ...parsed.data });
  if (error) {
    if (error.code === "23505") return fail("That landholder is already on this lot.");
    return dbError(error);
  }
  revalidatePath("/", "layout");
  return ok("Landholder added to the lot");
}

/** Role, property, and whether there's damage to restore (which makes acceptance a hold point). */
export async function updateLotLandholder(linkId: string, formData: FormData): Promise<ActionResult> {
  const session = await actionSession("editRecords");
  if ("error" in session) return fail(session.error);
  const parsed = parseLink(formData);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = await createClient();
  const { error, count } = await supabase.from("lot_landholders").update(parsed.data, { count: "exact" }).eq("id", linkId);
  if (error) return dbError(error);
  if (!count) return fail("Not found, or you don't have permission to change it.");
  revalidatePath("/", "layout");
  return ok("Saved");
}

export async function removeLotLandholder(linkId: string): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();
  const { error, count } = await supabase.from("lot_landholders").delete({ count: "exact" }).eq("id", linkId);
  if (error) return dbError(error);
  if (!count) return fail("Not found, or you don't have permission to remove it.");
  revalidatePath("/", "layout");
  return ok("Landholder removed from the lot");
}

const acceptanceSchema = z.object({
  acceptance_date: optionalDate.refine((v) => v !== null, "Enter the date of the written acceptance"),
  acceptance_name: requiredText("Accepted by", 200),
  acceptance_notes: text(5000),
});

/** Record the landholder's written acceptance of restoration (the hold point). */
export async function recordAcceptance(linkId: string, formData: FormData): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const parsed = acceptanceSchema.safeParse(formFields(formData, ["acceptance_date", "acceptance_name", "acceptance_notes"]));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("lot_landholders").update(parsed.data).eq("id", linkId);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok("Written acceptance recorded");
}

export async function clearAcceptance(linkId: string): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lot_landholders")
    .update({ acceptance_date: null, acceptance_name: null, acceptance_notes: null })
    .eq("id", linkId);
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return ok("Acceptance removed");
}
