import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import { capabilities, type Capabilities } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type Profile = Tables<"profiles">;
export type Session = { profile: Profile; can: Capabilities };

/** The signed-in user's profile, once per request. Null when signed out. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return profile;
});

/** For pages: signed-in, active users only. */
export async function requireSession(): Promise<Session> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.active) redirect("/pending");
  return { profile, can: capabilities(profile.role) };
}

/** For pages that need a capability (e.g. "manage"); others are sent to the dashboard. */
export async function requireCapability(cap: keyof Capabilities): Promise<Session> {
  const session = await requireSession();
  if (!session.can[cap]) redirect("/");
  return session;
}

/** For Server Actions: returns the session or an error message instead of redirecting. */
export async function actionSession(cap: keyof Capabilities): Promise<Session | { error: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Your session has expired. Please sign in again." };
  const can = capabilities(profile.active ? profile.role : null);
  if (!can[cap]) return { error: "You don't have permission to do that." };
  return { profile, can };
}
