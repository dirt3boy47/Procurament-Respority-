"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { actionSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, formFields, requiredText, text, uuid } from "@/lib/validation";

const FIELDS = ["name", "phone", "email", "postal_address", "notes"] as const;

const landholderSchema = z.object({
  name: requiredText("Name", 200),
  phone: text(50),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address")
    .transform((v) => (v === "" ? null : v)),
  postal_address: text(300),
  notes: text(5000),
});

export type SavedLandholder = ActionResult & { landholder?: { id: string; name: string } };

/** Add a landholder to the registry (from the Landholders page or the lot form's picker). */
export async function createLandholder(formData: FormData): Promise<SavedLandholder> {
  const session = await actionSession("editRecords");
  if ("error" in session) return fail(session.error);
  const parsed = landholderSchema.safeParse(formFields(formData, FIELDS));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.from("landholders").insert(parsed.data).select("id, name").single();
  if (error) return dbError(error);
  revalidatePath("/", "layout");
  return { ...ok(`${data.name} added to the landholder register`, data.id), landholder: data };
}

export async function updateLandholder(id: string, formData: FormData): Promise<ActionResult> {
  const session = await actionSession("editRecords");
  if ("error" in session) return fail(session.error);
  if (!uuid.safeParse(id).success) return fail("Unknown landholder");
  const parsed = landholderSchema.safeParse(formFields(formData, FIELDS));
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error, count } = await supabase.from("landholders").update(parsed.data, { count: "exact" }).eq("id", id);
  if (error) return dbError(error);
  if (!count) return fail("Landholder not found, or you don't have permission to change it.");
  revalidatePath("/", "layout");
  return ok("Landholder updated");
}

export async function deleteLandholder(id: string): Promise<ActionResult> {
  const session = await actionSession("manage");
  if ("error" in session) return fail(session.error);
  const supabase = await createClient();
  const { error, count } = await supabase.from("landholders").delete({ count: "exact" }).eq("id", id);
  if (error) return dbError(error);
  if (!count) return fail("Landholder not found, or you don't have permission to delete it.");
  revalidatePath("/", "layout");
  return ok("Landholder deleted");
}
