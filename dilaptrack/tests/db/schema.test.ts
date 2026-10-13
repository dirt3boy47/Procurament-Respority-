import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createDb, createUser } from "./harness";

let db: PGlite;
let admin: string, pm: string, engineer: string, viewer: string, pending: string;
let pmQ: ReturnType<typeof as>, engQ: ReturnType<typeof as>, viewQ: ReturnType<typeof as>;

async function lotId(lotNumber: string) {
  const { rows } = await db.query<{ id: string }>("select id from public.lots where lot_number = $1", [lotNumber]);
  return rows[0].id;
}

beforeAll(async () => {
  db = await createDb();
  admin = await createUser(db, "admin@example.com", { name: "Ada Admin" });
  pm = await createUser(db, "pm@example.com", { role: "project_manager", active: true, name: "Pat Manager" });
  engineer = await createUser(db, "eng@example.com", { role: "site_engineer", active: true, name: "Sam Engineer" });
  viewer = await createUser(db, "viewer@example.com", { role: "read_only", active: true });
  pending = await createUser(db, "stranger@example.com");
  pmQ = as(db, pm);
  engQ = as(db, engineer);
  viewQ = as(db, viewer);
}, 60_000);

describe("accounts", () => {
  it("makes the first user an active admin and later sign-ups inactive", async () => {
    const { rows } = await db.query<{ id: string; role: string; active: boolean }>(
      "select id, role, active from public.profiles where id in ($1, $2)",
      [admin, pending],
    );
    expect(rows.find((r) => r.id === admin)).toMatchObject({ role: "admin", active: true });
    expect(rows.find((r) => r.id === pending)).toMatchObject({ role: "read_only", active: false });
  });

  it("stops non-admins changing their own role", async () => {
    await expect(engQ("update public.profiles set role = 'admin' where id = $1", [engineer])).rejects.toThrow(
      /Only administrators/,
    );
    await engQ("update public.profiles set full_name = 'Sam E.' where id = $1", [engineer]);
  });

  it("never removes the last active admin", async () => {
    await expect(as(db, admin)("update public.profiles set role = 'read_only' where id = $1", [admin])).rejects.toThrow(
      /at least one active administrator/,
    );
  });

  it("gives inactive accounts no access to records", async () => {
    await db.query("insert into public.lots (lot_number) values ('SEED-1')");
    await db.query("insert into public.landholders (name) values ('Seed Owner')");
    expect(await as(db, pending)("select * from public.lots")).toHaveLength(0);
    expect(await as(db, pending)("select * from public.landholders")).toHaveLength(0);
    expect(await viewQ("select * from public.lots")).toHaveLength(1);
    await db.query("delete from public.lots where lot_number = 'SEED-1'");
    await db.query("delete from public.landholders where name = 'Seed Owner'");
  });
});

describe("landholder registry", () => {
  it("keeps one entry per name, ignoring case and spacing", async () => {
    await engQ("insert into public.landholders (name, phone) values ('  J   Smith ', '0400 000 000')");
    const [row] = await viewQ<{ name: string }>("select name from public.landholders");
    expect(row.name).toBe("J Smith");
    await expect(pmQ("insert into public.landholders (name) values ('j smith')")).rejects.toThrow(/duplicate key/);
  });

  it("lets engineers add and edit landholders but only managers delete them", async () => {
    await engQ("update public.landholders set email = 'js@example.com' where name = 'J Smith'");
    await expect(viewQ("insert into public.landholders (name) values ('Nope')")).rejects.toThrow(/row-level security/);
    expect(await engQ("delete from public.landholders where name = 'J Smith' returning id")).toHaveLength(0);
  });

  it("can't be deleted while lots belong to it", async () => {
    const [h] = await pmQ<{ id: string }>("insert into public.landholders (name) values ('Temp Owner') returning id");
    await pmQ("insert into public.lots (lot_number, landholder_id) values ('LOT-TMP', $1)", [h.id]);
    await expect(pmQ("delete from public.landholders where id = $1", [h.id])).rejects.toThrow(/foreign key/);
    await pmQ("delete from public.lots where lot_number = 'LOT-TMP'");
    await pmQ("delete from public.landholders where id = $1", [h.id]);
  });
});

describe("lot register and import", () => {
  it("imports lots, matching or adding landholders and skipping duplicate lots", async () => {
    await pmQ("insert into public.lots (lot_number, address) values ('LOT-001', '1 Main St')");
    const [{ result }] = await pmQ<{ result: { inserted: number; new_landholders: number; skipped: string[] } }>(
      "select public.import_lots($1) as result",
      [
        JSON.stringify([
          { lot_number: " lot-001 ", address: "dupe" },
          { lot_number: "LOT-002", address: "2 Main St", chainage: "1+250", landholder: "j smith" },
          { lot_number: "LOT-003", status: "on_hold", landholder: "New Owner", landholder_contact: "new@example.com" },
          { lot_number: "LOT-004", landholder: "new  owner" },
        ]),
      ],
    );
    expect(result).toEqual({ inserted: 3, new_landholders: 1, skipped: ["lot-001"] });
    const rows = await viewQ<{ lot_number: string; chainage_m: number | null; status: string; landholder_name: string | null }>(
      "select lot_number, chainage_m, status, landholder_name from public.lot_overview order by lot_number",
    );
    expect(rows).toEqual([
      { lot_number: "LOT-001", chainage_m: null, status: "not_started", landholder_name: null },
      { lot_number: "LOT-002", chainage_m: 1250, status: "not_started", landholder_name: "J Smith" },
      { lot_number: "LOT-003", chainage_m: null, status: "on_hold", landholder_name: "New Owner" },
      { lot_number: "LOT-004", chainage_m: null, status: "not_started", landholder_name: "New Owner" },
    ]);
    const [owner] = await viewQ<{ email: string }>("select email from public.landholders where name = 'New Owner'");
    expect(owner.email).toBe("new@example.com");
  });

  it("rejects a duplicate lot number typed by hand", async () => {
    await expect(pmQ("insert into public.lots (lot_number) values ('Lot-002')")).rejects.toThrow(/duplicate key/);
  });

  it("only lets managers create lots or import", async () => {
    await expect(engQ("insert into public.lots (lot_number) values ('LOT-X')")).rejects.toThrow(/row-level security/);
    await expect(viewQ("select public.import_lots('[]')")).rejects.toThrow(/Only administrators and project managers/);
  });

  it("creates a pre- and post-construction survey for every lot", async () => {
    const rows = await viewQ<{ survey_type: string }>(
      "select survey_type from public.surveys where lot_id = $1 order by survey_type",
      [await lotId("LOT-002")],
    );
    expect(rows.map((r) => r.survey_type)).toEqual(["pre_construction", "post_construction"]);
  });

  it("parses chainage formats", async () => {
    const { rows } = await db.query<{ a: number; b: number; c: number; d: number | null }>(
      "select public.parse_chainage('CH 12+345.5') a, public.parse_chainage('12345') b, public.parse_chainage('0+050') c, public.parse_chainage('n/a') d",
    );
    expect(rows[0]).toEqual({ a: 12345.5, b: 12345, c: 50, d: null });
  });
});

describe("surveys and files", () => {
  it("lets engineers complete surveys, which requires a date and surveyor", async () => {
    const lot = await lotId("LOT-002");
    await expect(
      engQ("update public.surveys set status = 'complete' where lot_id = $1 and survey_type = 'pre_construction'", [lot]),
    ).rejects.toThrow(/surveys_complete_needs_details/);
    const [s] = await engQ<{ completed_at: string | null }>(
      "update public.surveys set status = 'complete', survey_date = '2026-10-01', surveyor = 'Sam' where lot_id = $1 and survey_type = 'pre_construction' returning completed_at",
      [lot],
    );
    expect(s.completed_at).not.toBeNull();
    const [lotRow] = await viewQ<{ status: string }>("select status from public.lots where id = $1", [lot]);
    expect(lotRow.status).toBe("in_progress");
  });

  it("does not let read-only users change surveys", async () => {
    const rows = await viewQ("update public.surveys set notes = 'x' where lot_id = $1 returning id", [await lotId("LOT-002")]);
    expect(rows).toHaveLength(0);
  });

  it("controls file uploads by role", async () => {
    await engQ("insert into storage.objects (bucket_id, name, owner_id) values ('lot-files', 'LOT-002/pre-construction/a.jpg', $1)", [
      engineer,
    ]);
    await expect(
      viewQ("insert into storage.objects (bucket_id, name, owner_id) values ('lot-files', 'LOT-002/pre-construction/b.jpg', $1)", [
        viewer,
      ]),
    ).rejects.toThrow(/row-level security/);
    const lot = await lotId("LOT-002");
    await engQ(
      "insert into public.attachments (lot_id, category, storage_path, file_name, mime_type, uploaded_by) values ($1, 'pre_construction', 'LOT-002/pre-construction/a.jpg', 'a.jpg', 'image/jpeg', $2)",
      [lot, engineer],
    );
    const [att] = await viewQ<{ kind: string }>("select kind from public.attachments where storage_path = 'LOT-002/pre-construction/a.jpg'");
    expect(att.kind).toBe("photo");
  });

  it("rejects a survey file filed in the wrong folder", async () => {
    const lot = await lotId("LOT-002");
    const [survey] = await viewQ<{ id: string }>(
      "select id from public.surveys where lot_id = $1 and survey_type = 'pre_construction'",
      [lot],
    );
    await expect(
      engQ(
        "insert into public.attachments (lot_id, category, survey_id, storage_path, file_name, uploaded_by) values ($1, 'closeout', $2, 'x/y.pdf', 'y.pdf', $3)",
        [lot, survey.id, engineer],
      ),
    ).rejects.toThrow(/matching survey folder/);
  });

  it("no longer has defect or reinstatement folders", async () => {
    await expect(
      engQ(
        "insert into public.attachments (lot_id, category, storage_path, file_name, uploaded_by) values ($1, 'defects', 'x/d.jpg', 'd.jpg', $2)",
        [await lotId("LOT-002"), engineer],
      ),
    ).rejects.toThrow(/invalid input value for enum/);
  });
});

describe("close-out", () => {
  it("lists what is blocking close-out and refuses to close", async () => {
    const lot = await lotId("LOT-002");
    const [{ blockers }] = await viewQ<{ blockers: string[] }>("select public.lot_closeout_blockers($1) as blockers", [lot]);
    expect(blockers).toEqual(["Post-construction survey is not complete", "Landholder acceptance has not been recorded"]);
    await expect(pmQ("update public.lots set status = 'closed' where id = $1", [lot])).rejects.toThrow(
      /cannot be closed: Post-construction survey/,
    );
  });

  it("closes a lot once both surveys and acceptance are done, then freezes its records", async () => {
    const lot = await lotId("LOT-002");
    await engQ(
      "update public.surveys set status = 'complete', survey_date = '2026-12-01', surveyor = 'Sam' where lot_id = $1 and survey_type = 'post_construction'",
      [lot],
    );
    await pmQ("update public.lots set landholder_signoff_date = '2026-12-06', landholder_signoff_name = 'J Smith' where id = $1", [lot]);
    const [overview] = await viewQ<{ ready_to_close: boolean }>("select ready_to_close from public.lot_overview where id = $1", [lot]);
    expect(overview.ready_to_close).toBe(true);

    await expect(engQ("update public.lots set status = 'closed' where id = $1 returning id", [lot])).resolves.toHaveLength(0);
    const [closed] = await pmQ<{ status: string; closed_by: string }>(
      "update public.lots set status = 'closed' where id = $1 returning status, closed_by",
      [lot],
    );
    expect(closed).toEqual({ status: "closed", closed_by: pm });

    await expect(
      engQ("update public.surveys set notes = 'late note' where lot_id = $1", [lot]),
    ).rejects.toThrow(/is closed/);
    await expect(engQ("delete from public.attachments where lot_id = $1", [lot])).rejects.toThrow(/is closed/);

    const [reopened] = await pmQ<{ closed_at: string | null }>(
      "update public.lots set status = 'in_progress' where id = $1 returning closed_at",
      [lot],
    );
    expect(reopened.closed_at).toBeNull();
  });

  it("still lets a manager delete a closed lot with all of its records", async () => {
    await pmQ("insert into public.lots (lot_number) values ('LOT-DEL')");
    const lot = await lotId("LOT-DEL");
    await engQ(
      "update public.surveys set status = 'complete', survey_date = '2026-01-01', surveyor = 'S' where lot_id = $1",
      [lot],
    );
    await engQ(
      "insert into public.attachments (lot_id, category, storage_path, file_name, uploaded_by) values ($1, 'closeout', 'LOT-DEL/closeout/f.pdf', 'f.pdf', $2)",
      [lot, engineer],
    );
    await pmQ("update public.lots set landholder_signoff_date = '2026-02-01', landholder_signoff_name = 'X' where id = $1", [lot]);
    await pmQ("update public.lots set status = 'closed' where id = $1", [lot]);
    await expect(pmQ("delete from public.lots where id = $1 returning id", [lot])).resolves.toHaveLength(1);
  });

  it("will not create a lot as already closed", async () => {
    await expect(pmQ("insert into public.lots (lot_number, status) values ('LOT-Z', 'closed')")).rejects.toThrow(
      /cannot be created as closed/,
    );
  });
});

describe("audit trail", () => {
  it("records who changed what", async () => {
    const lot = await lotId("LOT-003");
    await pmQ("update public.lots set address = '3 Main St', notes = 'Gate code 1234' where id = $1", [lot]);
    const [entry] = await viewQ<{
      action: string;
      changed_fields: string[];
      old_data: Record<string, unknown>;
      new_data: Record<string, unknown>;
      actor_name: string;
    }>(
      "select action, changed_fields, old_data, new_data, actor_name from public.audit_log where lot_id = $1 and action = 'UPDATE' order by id desc limit 1",
      [lot],
    );
    expect(entry).toEqual({
      action: "UPDATE",
      changed_fields: ["address", "notes"],
      old_data: { address: null, notes: null },
      new_data: { address: "3 Main St", notes: "Gate code 1234" },
      actor_name: "Pat Manager",
    });
  });

  it("records landholder changes", async () => {
    const rows = await viewQ<{ action: string }>("select action from public.audit_log where table_name = 'landholders'");
    expect(rows.map((r) => r.action)).toContain("INSERT");
  });

  it("cannot be edited by anyone through the API", async () => {
    await expect(pmQ("delete from public.audit_log")).rejects.toThrow(/permission denied/);
    await expect(as(db, admin)("update public.audit_log set actor_name = 'x'")).rejects.toThrow(/permission denied/);
  });
});

describe("upgrading an existing database", () => {
  it("moves free-text landholders on lots into the registry", async () => {
    const old = await createDb({
      "20261014000000_dilap_focus.sql": async (d) => {
        await d.exec(`
          insert into public.lots (lot_number, landholder, landholder_contact) values
            ('A1', 'Ridge Farming Co', '07 5555 0000'),
            ('A2', ' ridge  farming co', 'farm@example.com'),
            ('A3', 'M Patel', 'mp@example.com'),
            ('A4', null, null);
          insert into public.defects (lot_id, description) select id, 'x' from public.lots where lot_number = 'A1';`);
      },
    });
    const { rows } = await old.query<{ lot_number: string; name: string | null; phone: string | null; email: string | null }>(
      `select l.lot_number, h.name, h.phone, h.email from public.lots l
       left join public.landholders h on h.id = l.landholder_id order by l.lot_number`,
    );
    expect(rows).toEqual([
      { lot_number: "A1", name: "Ridge Farming Co", phone: "07 5555 0000", email: null },
      { lot_number: "A2", name: "Ridge Farming Co", phone: "07 5555 0000", email: null },
      { lot_number: "A3", name: "M Patel", phone: null, email: "mp@example.com" },
      { lot_number: "A4", name: null, phone: null, email: null },
    ]);
    const { rows: tables } = await old.query<{ n: number }>(
      "select count(*)::int n from information_schema.tables where table_schema = 'public' and table_name in ('defects', 'reinstatement_items')",
    );
    expect(tables[0].n).toBe(0);
    await old.close();
  }, 60_000);
});
