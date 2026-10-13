"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getProfile } from "@/lib/auth";
import { getSiteUrl, safeNext } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
  redirect(safeNext(formData.get("next") as string | null));
}

export async function signOut() {
  const supabase = await createClient();
  // Local scope: only this browser is signed out.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return fail("Enter a valid email address.");
  const supabase = await createClient();
  const site = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${site}/auth/confirm?next=/account/password`,
  });
  // Same message either way, so the form can't be used to discover accounts.
  if (error && error.status !== 429) console.error("Password reset failed", error.message);
  if (error?.status === 429) return fail("Too many requests. Please wait a minute and try again.");
  return ok("If that email has an account, a reset link is on its way.");
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match", path: ["confirm"] });

export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message);
  return ok("Password updated.");
}

export async function updateMyName(formData: FormData): Promise<ActionResult> {
  const name = z.string().trim().min(1, "Enter your name").max(100).safeParse(formData.get("full_name"));
  if (!name.success) return fail(name.error.issues[0].message);
  const profile = await getProfile();
  if (!profile) return fail("Your session has expired. Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name.data }).eq("id", profile.id);
  if (error) return fail(error.message);
  return ok("Name updated.");
}
