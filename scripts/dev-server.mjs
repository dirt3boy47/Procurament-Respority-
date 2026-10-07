// Local preview: serves ./public and answers /api/* with the real API handlers
// running on PGlite with synthetic data. No Supabase or Cloudflare needed.
//   node scripts/dev-server.mjs [port] [role]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createDb, caller, demoSeed } from "../test/fixture.mjs";
import { ApiError } from "../supabase/functions/t2w-procurement-api/api.ts";

const port = Number(process.argv[2] || 8788);
const user = { id: "dev", email: "dev@example.com", fullName: "Local Dev", role: process.argv[3] || "admin" };
const call = caller(await createDb(demoSeed()));
const root = new URL("../public/", import.meta.url).pathname;
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  try {
    if (url.pathname === "/api/me") return send(200, await call(user, "me"));
    if (url.pathname === "/api/auth/logout" || url.pathname === "/api/auth/login") return send(200, { ok: true });
    if (url.pathname === "/api/rpc") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { action, params } = JSON.parse(body);
      return send(200, await call(user, action, params));
    }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    const file = await readFile(join(root, path)).catch(() => null);
    if (!file) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(file);
  } catch (err) {
    if (err instanceof ApiError) return send(err.status, { error: err.message });
    console.error(err);
    send(500, { error: String(err.message || err) });
  }
}).listen(port, () => console.log(`Procurement preview on http://localhost:${port} as ${user.role}`));
