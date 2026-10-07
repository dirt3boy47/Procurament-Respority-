// Worker auth/proxy behaviour against a mocked Supabase.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const env = {
  SUPABASE_URL: "https://sb.test",
  SUPABASE_PUBLISHABLE_KEY: "pk",
  PROCUREMENT_FUNCTION: "t2w-procurement-api",
  ASSETS: { fetch: async () => new Response("static") },
};

let calls;
let validTokens;
beforeEach(() => {
  calls = [];
  validTokens = new Set(["good"]);
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const auth = init.headers?.authorization || "";
    calls.push({ url: u, auth, body: init.body });
    const reply = (status, data) => new Response(JSON.stringify(data), { status });
    if (u.includes("grant_type=password")) {
      const { password } = JSON.parse(init.body);
      return password === "pw" ? reply(200, { access_token: "good", refresh_token: "r1", expires_in: 3600 }) : reply(400, { error_description: "Invalid login credentials" });
    }
    if (u.includes("grant_type=refresh_token")) {
      validTokens.add("fresh");
      return reply(200, { access_token: "fresh", refresh_token: "r2", expires_in: 3600 });
    }
    if (u.includes("/auth/v1/logout")) return new Response(null, { status: 204 });
    if (u.includes("/functions/v1/t2w-procurement-api")) {
      const token = auth.replace("Bearer ", "");
      if (!validTokens.has(token)) return reply(401, { error: "expired" });
      const { action } = JSON.parse(init.body);
      if (action === "me") return reply(200, { user: { role: "admin" }, permissions: { view: true } });
      return reply(200, { action, token });
    }
    return reply(404, {});
  };
});

const req = (path, { method = "POST", body, cookie, origin } = {}) => new Request("https://proc.test" + path, {
  method,
  headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

test("login sets this site's own cookies only on success", async () => {
  const bad = await worker.fetch(req("/api/auth/login", { body: { email: "a@b.c", password: "nope" } }), env);
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get("set-cookie"), null);
  const ok = await worker.fetch(req("/api/auth/login", { body: { email: "A@B.c", password: "pw" } }), env);
  assert.equal(ok.status, 200);
  const cookies = ok.headers.get("set-cookie");
  assert.match(cookies, /t2wp_at=good;.*HttpOnly; Secure; SameSite=Lax/);
  assert.match(cookies, /t2wp_rt=r1/);
  assert.doesNotMatch(cookies, /t2w_at=/, "never touches the works app cookie name");
});

test("rpc forwards the session token and refreshes once when it expires", async () => {
  const ok = await worker.fetch(req("/api/rpc", { body: { action: "dashboard" }, cookie: "t2wp_at=good" }), env);
  assert.deepEqual(await ok.json(), { action: "dashboard", token: "good" });

  const r = await worker.fetch(req("/api/rpc", { body: { action: "dashboard" }, cookie: "t2wp_at=stale; t2wp_rt=r1" }), env);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).token, "fresh");
  assert.match(r.headers.get("set-cookie"), /t2wp_at=fresh/);

  const none = await worker.fetch(req("/api/rpc", { body: { action: "dashboard" } }), env);
  assert.equal(none.status, 401);
});

test("cross-site POSTs are refused; logout is local-scope", async () => {
  const x = await worker.fetch(req("/api/rpc", { body: { action: "dashboard" }, cookie: "t2wp_at=good", origin: "https://evil.test" }), env);
  assert.equal(x.status, 403);
  const out = await worker.fetch(req("/api/auth/logout", { cookie: "t2wp_at=good" }), env);
  assert.match(out.headers.get("set-cookie"), /t2wp_at=;.*Max-Age=0/);
  assert.ok(calls.some((c) => c.url.includes("logout?scope=local")), "does not sign the user out of db-t2w");
});

test("non-API paths are served from static assets", async () => {
  const r = await worker.fetch(new Request("https://proc.test/schedule.html"), env);
  assert.equal(await r.text(), "static");
});
