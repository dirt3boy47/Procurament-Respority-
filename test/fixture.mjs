// Shared test fixture: PGlite with stand-in `public` tables (shaped like the
// works app's), synthetic rows, and the real procurement migration applied.
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { handle } from "../supabase/functions/t2w-procurement-api/api.ts";

export const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

const PUBLIC_DDL = `
  create table public.tblasset (
    "Record Key" text primary key, "Asset ID" text, "Pipeline Section" text, "Register" text, "Asset Type" text,
    "Chainage Start (m)" float8, "Valve Arrangement Type" text, "Valve Assembly Group" text, "Valve Arrangement" text,
    "Branch / Tee Size" text, "Air Valve" text, "Scour Valve" text, "Fitting Type" text, "Fitting Material" text,
    "Fitting DN (mm)" int, "Type of Bend" text, "Bend Rate Class" text, "Thrust Block Category" text,
    "Utility Description" text, "Side" text, "Location Drawing Ref" text, "Drawing (Start)" text,
    "Installed" text, "Complete" text);
  create table public.app_schedule_activity (activity_id text primary key, activity_name text, area text, work_package text,
    pipeline_section text, chainage_display text, planned_start date, planned_finish date, physical_percent_complete float8);
  create table public.app_schedule_activity_asset (activity_id text, record_key text, primary key (activity_id, record_key));
  create table public.app_profiles (user_id uuid primary key, email text, full_name text, role text, active boolean);
`;

export async function createDb(seedSql) {
  const pg = new PGlite({ parsers: { 20: Number, 1700: Number, 1082: (x) => x } });
  await pg.exec(PUBLIC_DDL);
  await pg.exec(seedSql);
  await pg.exec(await readFile(new URL("../supabase/migrations/20261007000000_procurement_init.sql", import.meta.url), "utf8"));
  return pg;
}

// Run an action in a transaction as procurement_app, exactly like the edge function.
export function caller(pg) {
  return (user, action, params = {}) => pg.transaction(async (tx) => {
    await tx.query("set local role procurement_app");
    return handle({ query: async (t, p = []) => (await tx.query(t, p)).rows }, user, action, params);
  });
}

// A larger synthetic project for the local dev server.
export function demoSeed() {
  const assets = [];
  const acts = [];
  const links = [];
  const sections = [["PHW", 0, 600, 300], ["PWG", 30, 375, 200]];
  for (const [sec, startOffset, dn, branch] of sections) {
    for (let k = 0; k < 12; k++) {
      const id = `${sec}-OC-${k}`;
      acts.push(`('${id}','${sec} [KP${k * 2}-${k * 2 + 2}] - Excavate, Bed, Lay Joint and Backfill','Pipeline - ${sec}','Open Cut / Special Crossing','${sec}',null,'${iso(startOffset + 40 + k * 21)}','${iso(startOffset + 55 + k * 21)}',0)`);
      for (let v = 0; v < 3; v++) {
        const ch = k * 2000 + v * 600 + 150;
        const [type, grp, tee] = v === 1
          ? ["SCV TYPE 1B", "SCV Type 1 (Buried)", `DN${dn}x150`]
          : [v === 0 ? "AV TYPE 1A" : "AV TYPE 2", v === 0 ? "AV Pit Type 1A & 1B (Buried)" : "AV Type 2 (Above Ground)", `DN${dn}x${branch}`];
        const key = `${sec}-${v === 1 ? "SCV" : "AV"}-${String(k * 3 + v + 1).padStart(3, "0")}`;
        assets.push(`('${key}','${key}','${sec}','Valve','${v === 1 ? "SCV" : "AV"}',${ch},'${type}','${grp}','${tee}',null,null,null,null)`);
        links.push(`('${id}','${key}')`);
      }
      for (let b = 0; b < 2; b++) {
        const key = `${sec}-HB-${String(k * 2 + b + 1).padStart(3, "0")}`;
        assets.push(`('${key}','${key}','${sec}','Bend','HOR',${k * 2000 + b * 900 + 400},null,null,null,'DICL',${dn},'${b ? "22.5°" : "11.25°"}',null)`);
        links.push(`('${id}','${key}')`);
      }
    }
  }
  return `
    insert into public.tblasset ("Record Key","Asset ID","Pipeline Section","Register","Asset Type","Chainage Start (m)",
      "Valve Arrangement Type","Valve Assembly Group","Branch / Tee Size","Fitting Material","Fitting DN (mm)","Type of Bend","Installed") values
      ${assets.join(",\n")};
    insert into public.app_schedule_activity values ${acts.join(",\n")};
    insert into public.app_schedule_activity_asset values ${links.join(",\n")};`;
}
