export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

export const ok = (message?: string, id?: string): ActionResult => ({ ok: true, message, id });
export const fail = (error: string): ActionResult => ({ ok: false, error });

/** Turn a Supabase / Postgres error into a message a site engineer can act on. */
export function dbError(error: { message: string; code?: string } | null | undefined, fallback = "Something went wrong"): ActionResult {
  if (!error) return fail(fallback);
  if (error.code === "23505") {
    return fail(/landholders/.test(error.message) ? "A landholder with that name already exists." : "That lot number already exists.");
  }
  if (error.code === "23503" && /landholder/.test(error.message)) {
    return fail("This landholder still has lots. Move those lots to another landholder first.");
  }
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return fail("You don't have permission to do that.");
  }
  if (error.code === "23514" && /_check|_needs_/.test(error.message)) {
    if (error.message.includes("surveys_complete_needs_details")) return fail("A completed survey needs a survey date and surveyor.");
    return fail("Please check the required fields.");
  }
  return fail(error.message || fallback);
}
