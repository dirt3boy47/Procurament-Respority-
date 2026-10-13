"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { actionSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { firstIssue } from "@/lib/validation";

const roleSchema = z.enum(["admin", "project_manager", "site_engineer", "read_only"]);

export async function updateUserAccess(userId: string, role: string, active: boolean): Promise<ActionResult> {
  const session = await actionSession("admin");
  if ("error" in session) return fail(session.error);
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return fail("Choose a role");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role: parsedRole.data, active }).eq("id", userId);
  if (error) return dbError(error);
  revalidatePath("/admin/users");
  return ok("Access updated");
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  full_name: z.string().trim().min(1, "Enter their name").max(100),
  role: roleSchema,
});

export async function inviteUser(formData: FormData): Promise<ActionResult> {
  const session = await actionSession("admin");
  if ("error" in session) return fail(session.error);
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return fail((e as Error).message);
  }
  const site = await getSiteUrl();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name },
    redirectTo: `${site}/auth/confirm?next=/account/password`,
  });
  if (error) {
    return fail(/already been registered/i.test(error.message) ? "That email already has an account." : error.message);
  }
  // The profile row is created by a database trigger; give it the chosen role.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: parsed.data.role, active: true, full_name: parsed.data.full_name })
    .eq("id", data.user.id);
  if (profileError) return fail(`Invite sent, but the role could not be set: ${profileError.message}`);
  revalidatePath("/admin/users");
  return ok(`Invitation sent to ${parsed.data.email}`);
}
