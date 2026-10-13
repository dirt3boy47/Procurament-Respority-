import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const root = join(__dirname, "..", "..");

/** A fresh database with the Supabase stand-ins and every migration applied. */
export async function createDb() {
  const db = new PGlite({ parsers: { 20: Number, 1700: Number, 1082: (x: string) => x } });
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  const dir = join(root, "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return db;
}

/** Create an auth user (fires the profile trigger) and optionally set its role. */
export async function createUser(
  db: PGlite,
  email: string,
  opts: { role?: string; active?: boolean; name?: string } = {},
) {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    email,
    JSON.stringify({ full_name: opts.name ?? email.split("@")[0] }),
  ]);
  if (opts.role !== undefined || opts.active !== undefined) {
    // Runs as the database owner, like the service-role invite action.
    await db.query(
      "update public.profiles set role = coalesce($2::public.app_role, role), active = coalesce($3, active) where id = $1",
      [id, opts.role ?? null, opts.active ?? null],
    );
  }
  return id;
}

/** Run queries as a signed-in user, exactly as PostgREST would (role + JWT sub). */
export function as(db: PGlite, userId: string) {
  return async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    db.transaction(async (tx: Transaction) => {
      await tx.query("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      return (await tx.query<T>(sql, params)).rows;
    });
}
