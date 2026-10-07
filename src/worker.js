// T2W Procurement — Cloudflare Worker.
//
// Serves the static site from ./public and proxies /api/* to the
// `t2w-procurement-api` Supabase Edge Function. Sign-in uses the same Supabase
// accounts as the works app, but this site keeps its own cookies (t2wp_*) on
// its own hostname, so signing in or out here never touches a db-t2w session.

const ACCESS_COOKIE = "t2wp_at";
const REFRESH_COOKIE = "t2wp_rt";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function cookies(req) {
  const out = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore */ }
  }
  return out;
}

function cookieLine(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value || "")}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, maxAge | 0)}`;
}

function sessionCookies(session) {
  const lines = [cookieLine(ACCESS_COOKIE, session.access_token, Math.max(60, Number(session.expires_in || 3600)))];
  if (session.refresh_token) lines.push(cookieLine(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30));
  return lines;
}

const clearCookies = () => [cookieLine(ACCESS_COOKIE, "", 0), cookieLine(REFRESH_COOKIE, "", 0)];

function withCookies(res, lines) {
  const out = new Response(res.body, res);
  for (const line of lines) out.headers.append("set-cookie", line);
  return out;
}

async function authCall(env, path, body, token) {
  const headers = { apikey: env.SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/${path}`, { method: "POST", headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function callFunction(env, token, action, params) {
  return fetch(`${env.SUPABASE_URL}/functions/v1/${env.PROCUREMENT_FUNCTION}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, params }),
  });
}

// Call the API with the caller's session, refreshing an expired token once.
async function rpc(req, env, action, params) {
  const jar = cookies(req);
  let token = jar[ACCESS_COOKIE];
  let refreshed = null;
  if (!token && jar[REFRESH_COOKIE]) {
    const r = await authCall(env, "token?grant_type=refresh_token", { refresh_token: jar[REFRESH_COOKIE] });
    if (r.ok && r.data.access_token) { refreshed = r.data; token = r.data.access_token; }
  }
  if (!token) return json({ error: "Sign in required." }, 401, { "set-cookie": clearCookies()[0] });

  let res = await callFunction(env, token, action, params);
  if (res.status === 401 && !refreshed && jar[REFRESH_COOKIE]) {
    const r = await authCall(env, "token?grant_type=refresh_token", { refresh_token: jar[REFRESH_COOKIE] });
    if (r.ok && r.data.access_token) {
      refreshed = r.data;
      res = await callFunction(env, r.data.access_token, action, params);
    }
  }
  const out = new Response(res.body, { status: res.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  if (res.status === 401) return withCookies(out, clearCookies());
  return refreshed ? withCookies(out, sessionCookies(refreshed)) : out;
}

function sameOrigin(req, url) {
  const origin = req.headers.get("origin");
  return !origin || origin === url.origin;
}

async function api(req, env, url) {
  const path = url.pathname.replace(/^\/api/, "");
  if (req.method !== "POST" && !(req.method === "GET" && path === "/me")) return json({ error: "Method not allowed" }, 405);
  if (req.method === "POST" && !sameOrigin(req, url)) return json({ error: "Cross-site request blocked." }, 403);

  if (path === "/auth/login") {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return json({ error: "Email and password are required." }, 400);
    const r = await authCall(env, "token?grant_type=password", { email, password });
    if (!r.ok || !r.data.access_token) return json({ error: r.data.error_description || r.data.msg || "Sign in failed." }, 401);
    // Make sure the account is active and allowed in before setting cookies.
    const me = await callFunction(env, r.data.access_token, "me", {});
    const meData = await me.json().catch(() => ({}));
    if (!me.ok) return json({ error: meData.error || "Sign in failed." }, me.status);
    if (!meData.permissions?.view) return json({ error: "Your role doesn't have access to the procurement planner." }, 403);
    return withCookies(json({ ok: true, ...meData }), sessionCookies(r.data));
  }

  if (path === "/auth/logout") {
    const token = cookies(req)[ACCESS_COOKIE];
    // scope=local signs out this browser session only, not other devices or the works app.
    if (token) await authCall(env, "logout?scope=local", null, token).catch(() => {});
    return withCookies(json({ ok: true }), clearCookies());
  }

  if (path === "/me") return rpc(req, env, "me", {});

  if (path === "/rpc") {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.action !== "string") return json({ error: "Bad request" }, 400);
    return rpc(req, env, body.action, body.params || {});
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(req, env, url);
      } catch (err) {
        console.error(err);
        return json({ error: "The procurement service is unavailable. Please try again." }, 502);
      }
    }
    return env.ASSETS.fetch(req);
  },
};
