// T2W Procurement API — Supabase Edge Function.
//
// Separate from the works app's `t2w-sql` bridge: it never accepts SQL from the
// caller, it authenticates the user's own Supabase session, and every request
// runs inside a transaction as the `procurement_app` role, which can only touch
// the `procurement` schema.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.8";
import { ApiError, actionInfo, handle, type User } from "./api.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// Publishable (public) key fallback in case the legacy anon key is ever disabled.
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_yjyMuCPwmM28IzG6JwNblw_eWbFuDZE";
const DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";

let sql: ReturnType<typeof postgres> | null = null;
function db() {
  if (!sql) {
    sql = postgres(DB_URL, {
      max: 1,
      prepare: false,
      fetch_types: false,
      idle_timeout: 5,
      max_lifetime: 60,
      connect_timeout: 10,
      onnotice: () => {},
      // Keep dates as YYYY-MM-DD strings and return numbers as numbers.
      types: {
        plainDate: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
        plainNumeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
        plainInt8: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
      },
    });
  }
  return sql;
}

const tokenCache = new Map<string, { user: User; expires: number }>();

async function authenticate(req: Request): Promise<User> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "Sign in required.");
  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) return cached.user;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` } });
  const authUser = await res.json().catch(() => ({}));
  if (!res.ok || !authUser?.id) throw new ApiError(401, "Your session has expired. Please sign in again.");

  const rows = await db()`select email, full_name, role, active from procurement.v_user where user_id = ${authUser.id}::uuid`;
  const profile = rows[0];
  if (!profile || !profile.active || profile.role === "pending") throw new ApiError(403, "Your T2W account has not been activated.");
  const user: User = {
    id: authUser.id,
    email: profile.email || authUser.email || "",
    fullName: profile.full_name || profile.email || authUser.email || "",
    role: profile.role,
  };
  if (tokenCache.size > 500) tokenCache.clear();
  tokenCache.set(token, { user, expires: Date.now() + 45_000 });
  return user;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!DB_URL || !SUPABASE_URL) return json({ error: "Procurement API is not configured." }, 503);
  try {
    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");
    const params = body?.params ?? {};
    const user = await authenticate(req);
    if (action !== "me" && !actionInfo(action)) throw new ApiError(404, `Unknown action: ${action}`);

    const result = await db().begin(async (tx: any) => {
      await tx.unsafe("set local role procurement_app");
      await tx.unsafe("set local statement_timeout = '20s'");
      return handle({ query: (text, p = []) => tx.unsafe(text, p as any[]) }, user, action, params);
    });
    return json(result);
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message }, err.status);
    console.error(err);
    const msg = String((err as Error)?.message ?? err);
    if (/connection|terminated|timeout/i.test(msg)) {
      try { await sql?.end({ timeout: 1 }); } catch (_) { /* ignore */ }
      sql = null;
    }
    return json({ error: "The procurement service hit an error. Please try again." }, 500);
  }
});
