// Runs the real migration and API handlers against an in-process Postgres
// (PGlite). The `public` tables are minimal stand-ins shaped like the works
// app's tables, filled with synthetic rows.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../supabase/functions/t2w-procurement-api/api.ts";
import { createDb, caller, iso } from "./fixture.mjs";

const admin = { id: "u1", email: "admin@example.com", fullName: "Admin", role: "admin" };
const crew = { id: "u2", email: "crew@example.com", fullName: "Crew", role: "crew_chief" };
const client = { id: "u3", email: "client@example.com", fullName: "Client", role: "client_viewer" };

let pg;
let call;

before(async () => {
  pg = await createDb(`
    insert into public.tblasset ("Record Key","Asset ID","Pipeline Section","Register","Asset Type","Chainage Start (m)",
      "Valve Arrangement Type","Valve Assembly Group","Branch / Tee Size","Fitting Material","Fitting DN (mm)","Type of Bend","Installed") values
      ('PHW-AV-001','PHW-AV-001','PHW','Valve','AV',100,'AV TYPE 1A','AV Pit Type 1A & 1B (Buried)','DN600x300',null,null,null,null),
      ('PHW-AV-002','PHW-AV-002','PHW','Valve','AV',900,'AV TYPE 1A','AV Pit Type 1A & 1B (Buried)','DN600x300',null,null,null,null),
      ('PHW-AV-003','PHW-AV-003','PHW','Valve','AV',2000,'AV  TYPE 1A ','AV Pit Type 1A & 1B (Buried)','DN600x300',null,null,null,'Yes'),
      ('PWG-SCV-001','PWG-SCV-001','PWG','Valve','SCV',500,'SCV TYPE 1B','SCV Type 1 (Buried)','DN375x150',null,null,null,null),
      ('PHW-B-001','PHW-B-001','PHW','Bend','HOR',300,null,null,null,'DICL',600,'11.25°',null),
      ('PHW-FS-001','PHW-FS-001','PHW','Foreign Service','GAS',300,null,null,null,null,null,null,null);
    insert into public.app_schedule_activity values
      ('A1','PHW lay 0-1000','Pipeline - PHW','Open Cut','PHW',null,'${iso(150)}','${iso(180)}',0),
      ('A2','PHW lay 1000-3000','Pipeline - PHW','Open Cut','PHW',null,'${iso(300)}','${iso(330)}',0),
      ('V1','Valve install','Pipeline','Valve Installation','PHW',null,'${iso(200)}','${iso(400)}',0),
      ('W1','PWG lay','Pipeline - PWG','Open Cut','PWG',null,'${iso(20)}','${iso(40)}',0);
    insert into public.app_schedule_activity_asset values
      ('A1','PHW-AV-001'),('V1','PHW-AV-001'),('A1','PHW-AV-002'),('A2','PHW-AV-003'),('W1','PWG-SCV-001'),('A1','PHW-B-001');
  `);
  call = caller(pg);
});

async function expectError(promise, status, pattern) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
    assert.equal(err.status, status);
    if (pattern) assert.match(err.message, pattern);
    return true;
  });
}

test("procurement_app cannot write to public tables", async () => {
  await assert.rejects(pg.transaction(async (tx) => {
    await tx.query("set local role procurement_app");
    await tx.query(`update public.tblasset set "Installed" = 'Yes'`);
  }), /permission denied/);
  await assert.rejects(pg.transaction(async (tx) => {
    await tx.query("set local role procurement_app");
    await tx.query(`select * from public.tblasset`);
  }), /permission denied/);
});

test("starter templates are created per assembly, with whitespace normalised", async () => {
  const { rows } = await call(admin, "templates.list");
  const keys = rows.map((r) => r.assembly_key).sort();
  assert.deepEqual(keys, ["AV TYPE 1A | DN600x300", "DICL DN600 11.25° HOR", "SCV TYPE 1B | DN375x150"]);
  const av = rows.find((r) => r.assembly_key.startsWith("AV"));
  assert.equal(av.status, "DRAFT");
  assert.equal(av.asset_count, 3);
  assert.equal(av.line_count, 2);
});

test("need date is the earliest linked activity; order-by subtracts lead time and buffer", async () => {
  const { rows } = await call(admin, "requirements", { includeInstalled: true });
  const byKey = Object.fromEntries(rows.map((r) => [r.record_key, r]));
  assert.ok(!byKey["PHW-FS-001"], "foreign services are not procured");
  const av1 = byKey["PHW-AV-001"];
  assert.equal(av1.need_date, iso(150));
  assert.equal(av1.need_activity_id, "A1");
  assert.equal(av1.order_by_date, iso(150 - 84 - 14));
  assert.equal(av1.status, "PLANNED");
  assert.equal(byKey["PHW-AV-003"].status, "INSTALLED");
  // SCV needed in 20 days with 98 days lead+buffer -> overdue
  assert.equal(byKey["PWG-SCV-001"].status, "OVERDUE");
  // installed assets are hidden by default
  const def = await call(admin, "requirements", {});
  assert.ok(!def.rows.some((r) => r.record_key === "PHW-AV-003"));
});

test("full flow: approve BOM, draft PO from assets, issue, receive, confirm", async () => {
  const tpl = (await call(admin, "templates.list")).rows.find((r) => r.assembly_key.startsWith("AV"));
  const { template, lines } = await call(admin, "template.get", { id: tpl.id });
  // add a real component line and save (saving resets to DRAFT)
  await call(admin, "template.save", {
    id: template.id, title: template.title, assemblyKey: template.assembly_key, categoryCode: "AV",
    lines: [...lines, { item_code: "AV-DN100", description: "Air valve DN100", qty: 1, uom: "ea", lead_time_days: 120 }],
  });
  await expectError(call(admin, "asset.confirmBom", { recordKey: "PHW-AV-001" }), 400, /Approve the BOM/);
  await call(admin, "template.approve", { id: template.id });

  // line-level lead time (120) now drives the order-by date
  const r1 = (await call(admin, "asset.get", { recordKey: "PHW-AV-001" })).asset;
  assert.equal(r1.order_by_date, iso(150 - 120 - 14));
  assert.equal(r1.status, "ORDER_NOW");

  const draft = await call(admin, "po.draftFromAssets", { recordKeys: ["PHW-AV-001", "PHW-AV-002"] });
  assert.equal(draft.lines.length, 3);
  const valveLine = draft.lines.find((l) => l.item_code === "AV-DN100");
  assert.equal(valveLine.qty, 2);
  assert.equal(valveLine.allocations.length, 2);
  assert.equal(draft.categoryCode, "AV");

  const { id: supplierId } = await call(admin, "supplier.save", { name: "Valve Co" });
  const { id: poId } = await call(admin, "po.save", { po_number: "PO-1001", supplier_id: supplierId, lines: draft.lines });
  await expectError(call(admin, "po.save", { po_number: "PO-1001", lines: draft.lines }), 400, /already exists/);

  let a1 = (await call(admin, "asset.get", { recordKey: "PHW-AV-001" })).asset;
  assert.equal(a1.status, "PART_ORDERED", "draft PO counts as in progress, not ordered");
  assert.equal(a1.lines_drafted, 3);
  // drafted qty is not offered again
  const again = await call(admin, "po.draftFromAssets", { recordKeys: ["PHW-AV-001"] });
  assert.equal(again.lines.length, 0);

  await call(admin, "po.setStatus", { id: poId, status: "ISSUED" });
  a1 = (await call(admin, "asset.get", { recordKey: "PHW-AV-001" })).asset;
  assert.equal(a1.status, "ORDERED");
  assert.equal(a1.bom_confirmed, false);

  await call(admin, "asset.confirmBom", { recordKey: "PHW-AV-001" });
  a1 = (await call(admin, "asset.get", { recordKey: "PHW-AV-001" })).asset;
  assert.equal(a1.bom_confirmed, true);

  // crew chief can receive but not edit
  const po = await call(crew, "po.get", { id: poId });
  await expectError(call(crew, "po.setStatus", { id: poId, status: "CANCELLED" }), 403);
  await call(crew, "po.receive", { id: poId, docket_no: "D1", lines: po.lines.map((l) => ({ po_line_id: l.id, qty: 1 })) });
  let p = (await call(admin, "po.get", { id: poId })).po;
  assert.equal(p.status, "PART_RECEIVED");
  await expectError(call(crew, "po.receive", { id: poId, lines: [{ po_line_id: po.lines[0].id, qty: 5 }] }), 400, /exceed/);
  await call(crew, "po.receive", { id: poId, lines: po.lines.map((l) => ({ po_line_id: l.id, qty: l.qty - 1 })) });
  p = (await call(admin, "po.get", { id: poId })).po;
  assert.equal(p.status, "RECEIVED");
  a1 = (await call(admin, "asset.get", { recordKey: "PHW-AV-001" })).asset;
  assert.equal(a1.status, "RECEIVED");

  // changing the BOM afterwards makes the confirmation stale
  const t2 = await call(admin, "template.get", { id: template.id });
  await call(admin, "template.save", {
    id: template.id, title: template.title, assemblyKey: template.assembly_key, categoryCode: "AV",
    lines: [...t2.lines, { item_code: "GATE-DN300", description: "Gate valve DN300", qty: 1 }],
  });
  a1 = (await call(admin, "asset.get", { recordKey: "PHW-AV-001" })).asset;
  assert.equal(a1.bom_confirmed, false);
  assert.equal(a1.bom_confirmation_stale, true);
  assert.equal(a1.status, "PART_ORDERED", "new BOM line is not yet ordered");
  assert.equal(a1.lines_ordered, 3);
  assert.equal(a1.bom_lines, 4);

  const dash = await call(admin, "dashboard");
  assert.ok(dash.counts.OVERDUE >= 1);
  assert.ok(dash.urgent.length >= 1);
  const audit = await call(admin, "audit.list");
  assert.ok(audit.rows.some((r) => r.action === "po.receive"));
});

test("asset plan override moves the need date; hold takes it off the list", async () => {
  await call(admin, "asset.plan.save", { recordKey: "PWG-SCV-001", needDateOverride: iso(400), notes: "Re-sequenced" });
  let a = (await call(admin, "asset.get", { recordKey: "PWG-SCV-001" })).asset;
  assert.equal(a.need_date, iso(400));
  assert.equal(a.status, "PLANNED");
  await call(admin, "asset.plan.save", { recordKey: "PWG-SCV-001", onHold: true });
  a = (await call(admin, "asset.get", { recordKey: "PWG-SCV-001" })).asset;
  assert.equal(a.status, "ON_HOLD");
  assert.equal(a.need_date, iso(20), "clearing the override restores the programme date");
});

test("lead time changes flow through; permissions enforced", async () => {
  await expectError(call(crew, "category.save", { code: "BEND-DICL" }), 403);
  await expectError(call(client, "requirements"), 403);
  const cat = (await call(admin, "lookups")).categories.find((c) => c.code === "BEND-DICL");
  await call(admin, "category.save", { ...cat, lead_time_days: 10, buffer_days: 0 });
  const b = (await call(admin, "asset.get", { recordKey: "PHW-B-001" })).asset;
  assert.equal(b.order_by_date, iso(140));
});

test("draft POs can be deleted; issued ones cannot", async () => {
  const { id: poId } = await call(admin, "po.save", {
    po_number: "PO-T", lines: [{ item_code: "X", description: "Thing", qty: 2, allocations: [{ record_key: "PHW-B-001", qty: 3 }] }],
  }).catch((e) => ({ err: e }));
  assert.equal(poId, undefined, "over-allocation rejected");
  const ok = await call(admin, "po.save", { po_number: "PO-T", lines: [{ item_code: "X", description: "Thing", qty: 2 }] });
  await expectError(call(admin, "po.setStatus", { id: ok.id, status: "ISSUED" }), 400, /supplier/);
  await call(admin, "po.delete", { id: ok.id });
  await expectError(call(admin, "po.get", { id: ok.id }), 404);
});
