// T2W Procurement API — request handlers.
//
// Database-agnostic: `db.query(text, params)` returns rows. The edge function
// (index.ts) supplies a postgres.js transaction running as `procurement_app`;
// the tests supply PGlite. Only erasable TypeScript syntax is used so Node can
// run this file directly.

export type Row = Record<string, any>;
export type Db = { query: (text: string, params?: unknown[]) => Promise<Row[]> };
export type User = { id: string; email: string; fullName: string; role: string };
type Ctx = { db: Db; user: User; params: Row };
type Perm = "view" | "edit" | "receive" | "admin";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PERMS: Record<Perm, string[]> = {
  view: ["admin", "superintendent", "crew_chief"],
  edit: ["admin", "superintendent"],
  receive: ["admin", "superintendent", "crew_chief"],
  admin: ["admin"],
};

export function permissionsFor(role: string): Record<Perm, boolean> {
  return {
    view: PERMS.view.includes(role),
    edit: PERMS.edit.includes(role),
    receive: PERMS.receive.includes(role),
    admin: PERMS.admin.includes(role),
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const bad = (message: string) => new ApiError(400, message);

function str(v: unknown, max = 500): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > max) throw bad(`Value is too long (max ${max} characters).`);
  return s;
}

function reqStr(v: unknown, label: string, max = 500): string {
  const s = str(v, max);
  if (!s) throw bad(`${label} is required.`);
  return s;
}

function num(v: unknown, label: string, opts: { min?: number; required?: boolean } = {}): number | null {
  if (v === undefined || v === null || v === "") {
    if (opts.required) throw bad(`${label} is required.`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw bad(`${label} must be a number.`);
  if (opts.min !== undefined && n < opts.min) throw bad(`${label} must be at least ${opts.min}.`);
  return n;
}

function int(v: unknown, label: string, opts: { min?: number; required?: boolean } = {}): number | null {
  const n = num(v, label, opts);
  if (n !== null && !Number.isInteger(n)) throw bad(`${label} must be a whole number.`);
  return n;
}

function date(v: unknown, label: string): string | null {
  const s = str(v, 10);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw bad(`${label} must be a date (YYYY-MM-DD).`);
  return s;
}

function id(v: unknown, label = "id"): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad(`A valid ${label} is required.`);
  return n;
}

function list(v: unknown): Row[] {
  return Array.isArray(v) ? v : [];
}

async function one(db: Db, text: string, params: unknown[] = []): Promise<Row | null> {
  const rows = await db.query(text, params);
  return rows[0] ?? null;
}

async function audit(ctx: Ctx, action: string, entity: string, entityId: unknown, details: Row = {}) {
  await ctx.db.query(
    `insert into procurement.audit (user_email, action, entity, entity_id, details) values ($1, $2, $3, $4, $5::text::jsonb)`,
    [ctx.user.email, action, entity, entityId === null || entityId === undefined ? null : String(entityId), JSON.stringify(details)],
  );
}

const REQ_COLUMNS = `record_key, asset_id, section, register, asset_type, chainage, assembly_key,
  valve_assembly_group, tee_size, fitting_material, fitting_dn, bend_angle, drawing, side,
  category_code, category_name, lead_time_days, buffer_days, effective_lead_days,
  programme_need_date, need_date_override, need_date, need_activity_id, order_by_date, status,
  template_id, template_status, bom_lines, lines_ordered, lines_received, lines_drafted, po_numbers,
  on_hold, plan_notes, bom_confirmed, bom_confirmation_stale, bom_confirmed_by, bom_confirmed_at`;

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------

async function lookups({ db }: Ctx) {
  const [sections, categories, suppliers, settings] = await Promise.all([
    db.query(`select distinct section from procurement.v_asset_need where section is not null order by 1`),
    db.query(`select * from procurement.category order by sort_order, code`),
    db.query(`select id, name, active from procurement.supplier order by name`),
    db.query(`select key, value, description from procurement.setting order by key`),
  ]);
  return {
    sections: sections.map((r) => r.section),
    categories,
    suppliers,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  };
}

async function dashboard({ db }: Ctx) {
  const [counts, urgent, forecast, pos, confirm, drafts, weeks] = await Promise.all([
    db.query(`select status, count(*)::int as n from procurement.v_requirement group by status`),
    db.query(`select ${REQ_COLUMNS} from procurement.v_requirement
               where status in ('OVERDUE','ORDER_NOW','PART_ORDERED')
               order by order_by_date nulls last, section, chainage limit 60`),
    db.query(`select case when order_by_date < current_date then null
                          else date_trunc('week', order_by_date)::date::text end as week,
                     category_code, count(*)::int as n
                from procurement.v_requirement
               where status in ('OVERDUE','ORDER_NOW','PLANNED','PART_ORDERED','NO_BOM')
                 and order_by_date is not null
               group by 1, 2 order by 1 nulls first, 2`),
    db.query(`select po.status, count(distinct po.id)::int as n,
                     coalesce(sum(pl.qty * pl.unit_cost), 0)::float8 as value
                from procurement.purchase_order po
                left join procurement.po_line pl on pl.po_id = po.id
               group by po.status`),
    db.query(`select count(*)::int as n from procurement.v_requirement
               where status in ('ORDERED','RECEIVED') and not bom_confirmed`),
    db.query(`select count(distinct t.id)::int as n from procurement.bom_template t
                join procurement.v_asset_need n on n.assembly_key = t.assembly_key
               where t.status = 'DRAFT'`),
    db.query(`select coalesce((select value::int from procurement.setting where key = 'forecast_weeks'), 26) as n`),
  ]);
  return {
    counts: Object.fromEntries(counts.map((r) => [r.status, r.n])),
    urgent,
    forecast,
    forecastWeeks: weeks[0]?.n ?? 26,
    purchaseOrders: pos,
    awaitingBomConfirmation: confirm[0]?.n ?? 0,
    draftTemplatesInUse: drafts[0]?.n ?? 0,
  };
}

async function requirements({ db, params }: Ctx) {
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    args.push(value);
    where.push(sql.replace("?", `$${args.length}`));
  };
  if (str(params.section)) add(`section = ?`, str(params.section));
  if (str(params.category)) add(`category_code = ?`, str(params.category));
  if (str(params.status)) add(`status = ?`, str(params.status));
  else if (!params.includeInstalled) where.push(`status <> 'INSTALLED'`);
  if (str(params.search)) add(`(record_key ilike ? or assembly_key ilike $${args.length + 1} or coalesce(po_numbers,'') ilike $${args.length + 1})`, `%${str(params.search)}%`);
  const horizon = int(params.horizonDays, "Horizon", { min: 0 });
  if (horizon !== null) add(`(order_by_date is null or order_by_date <= current_date + ?::int)`, horizon);
  const rows = await db.query(
    `select ${REQ_COLUMNS} from procurement.v_requirement
      ${where.length ? "where " + where.join(" and ") : ""}
      order by order_by_date nulls last, section, chainage, record_key`,
    args,
  );
  return { rows };
}

async function assetGet({ db, params }: Ctx) {
  const key = reqStr(params.recordKey, "Record key");
  const asset = await one(db, `select r.*, v.valve_arrangement_type, v.valve_arrangement, v.air_valve, v.scour_valve,
                                      v.fitting_type, v.bend_class, v.tb_category, v.utility_description, v.installed, v.complete
                                 from procurement.v_requirement r
                                 join procurement.v_register v on v.record_key = r.record_key
                                where r.record_key = $1`, [key]);
  if (!asset) throw new ApiError(404, "That asset is not in an active procurement category.");
  const [bom, activities, allocations, history] = await Promise.all([
    db.query(`select * from procurement.v_asset_bom where record_key = $1 order by line_no`, [key]),
    db.query(`select a.* from procurement.v_activity_link l join procurement.v_activity a on a.activity_id = l.activity_id
               where l.record_key = $1 order by a.planned_start nulls last`, [key]),
    db.query(`select pa.qty, pl.id as po_line_id, pl.item_code, pl.description, pl.qty as line_qty, pl.qty_received,
                     po.id as po_id, po.po_number, po.status as po_status, po.expected_date, s.name as supplier
                from procurement.po_allocation pa
                join procurement.po_line pl on pl.id = pa.po_line_id
                join procurement.purchase_order po on po.id = pl.po_id
                left join procurement.supplier s on s.id = po.supplier_id
               where pa.record_key = $1 order by po.created_at`, [key]),
    db.query(`select at, user_email, action, details from procurement.audit
               where entity = 'asset' and entity_id = $1 order by at desc limit 50`, [key]),
  ]);
  return { asset, bom, activities, allocations, history };
}

async function templatesList({ db }: Ctx) {
  const rows = await db.query(`
    select t.id, t.assembly_key, t.title, t.status, t.category_code, t.drawing_ref, t.approved_by, t.approved_at, t.updated_at,
           (select count(*)::int from procurement.bom_template_line l where l.template_id = t.id) as line_count,
           (select count(*)::int from procurement.v_asset_need n where n.assembly_key = t.assembly_key) as asset_count,
           (select min(n.need_date)::text from procurement.v_asset_need n where n.assembly_key = t.assembly_key) as first_need
      from procurement.bom_template t
      left join procurement.category c on c.code = t.category_code
     order by c.sort_order nulls last, t.assembly_key`);
  return { rows };
}

async function templateGet({ db, params }: Ctx) {
  const tid = id(params.id, "template id");
  const template = await one(db, `select * from procurement.bom_template where id = $1`, [tid]);
  if (!template) throw new ApiError(404, "Template not found.");
  const [lines, assets] = await Promise.all([
    db.query(`select * from procurement.bom_template_line where template_id = $1 order by line_no, id`, [tid]),
    db.query(`select record_key, asset_id, section, chainage, need_date, order_by_date, status, bom_confirmed
                from procurement.v_requirement where assembly_key = $1 order by need_date nulls last, record_key`, [template.assembly_key]),
  ]);
  return { template, lines, assets };
}

async function suppliersList({ db }: Ctx) {
  return { rows: await db.query(`select * from procurement.supplier order by name`) };
}

async function posList({ db, params }: Ctx) {
  const args: unknown[] = [];
  let where = "";
  if (str(params.status)) {
    args.push(str(params.status));
    where = `where po.status = $1`;
  }
  const rows = await db.query(`
    select po.id, po.po_number, po.status, po.order_date, po.expected_date, po.category_code, po.created_at, po.created_by,
           s.name as supplier,
           (select count(*)::int from procurement.po_line pl where pl.po_id = po.id) as line_count,
           (select coalesce(sum(pl.qty * pl.unit_cost), 0)::float8 from procurement.po_line pl where pl.po_id = po.id) as value,
           (select coalesce(sum(pl.qty), 0)::float8 from procurement.po_line pl where pl.po_id = po.id) as qty,
           (select coalesce(sum(pl.qty_received), 0)::float8 from procurement.po_line pl where pl.po_id = po.id) as qty_received,
           (select count(distinct pa.record_key)::int from procurement.po_line pl
              join procurement.po_allocation pa on pa.po_line_id = pl.id where pl.po_id = po.id) as asset_count
      from procurement.purchase_order po
      left join procurement.supplier s on s.id = po.supplier_id
      ${where}
     order by po.created_at desc`, args);
  return { rows };
}

async function poGet({ db, params }: Ctx) {
  const pid = id(params.id, "PO id");
  const po = await one(db, `select po.*, s.name as supplier from procurement.purchase_order po
                              left join procurement.supplier s on s.id = po.supplier_id where po.id = $1`, [pid]);
  if (!po) throw new ApiError(404, "Purchase order not found.");
  const [lines, allocations, receipts, history] = await Promise.all([
    db.query(`select * from procurement.po_line where po_id = $1 order by line_no, id`, [pid]),
    db.query(`select pa.po_line_id, pa.record_key, pa.qty, n.asset_id, n.section, n.need_date
                from procurement.po_allocation pa
                join procurement.po_line pl on pl.id = pa.po_line_id
                left join procurement.v_asset_need n on n.record_key = pa.record_key
               where pl.po_id = $1 order by n.need_date nulls last, pa.record_key`, [pid]),
    db.query(`select r.*, pl.item_code from procurement.receipt r join procurement.po_line pl on pl.id = r.po_line_id
               where pl.po_id = $1 order by r.received_date desc, r.id desc`, [pid]),
    db.query(`select at, user_email, action, details from procurement.audit
               where entity = 'po' and entity_id = $1 order by at desc limit 50`, [String(pid)]),
  ]);
  for (const line of lines) line.allocations = allocations.filter((a) => String(a.po_line_id) === String(line.id));
  return { po, lines, receipts, history };
}

// Proposed PO lines for a set of assets: outstanding BOM qty grouped by item.
async function poDraftFromAssets({ db, params }: Ctx) {
  const keys = list(params.recordKeys).map((k) => String(k)).filter(Boolean);
  if (!keys.length) throw bad("Select at least one asset.");
  if (keys.length > 1000) throw bad("Too many assets selected.");
  const rows = await db.query(`
    select b.record_key, b.item_code, b.description, b.uom, b.template_status,
           greatest(b.required_qty - b.ordered_qty - b.drafted_qty, 0)::float8 as outstanding,
           (n.need_date - n.buffer_days)::text as required_by, n.category_code
      from procurement.v_asset_bom b
      join procurement.v_asset_need n on n.record_key = b.record_key
     where b.record_key in (select jsonb_array_elements_text($1::text::jsonb))
     order by b.item_code, n.need_date nulls last, b.record_key`, [JSON.stringify(keys)]);
  const lines = new Map<string, Row>();
  const warnings: string[] = [];
  const draftTemplates = new Set<string>();
  const categories = new Set<string>();
  for (const r of rows) {
    if (r.template_status !== "APPROVED") draftTemplates.add(r.record_key);
    if (r.category_code) categories.add(r.category_code);
    if (!(Number(r.outstanding) > 0)) continue;
    let line = lines.get(r.item_code);
    if (!line) {
      line = { item_code: r.item_code, description: r.description, uom: r.uom, qty: 0, required_by: r.required_by, allocations: [] };
      lines.set(r.item_code, line);
    }
    line.qty += Number(r.outstanding);
    if (r.required_by && (!line.required_by || r.required_by < line.required_by)) line.required_by = r.required_by;
    line.allocations.push({ record_key: r.record_key, qty: Number(r.outstanding) });
  }
  const withBom = new Set(rows.map((r) => r.record_key));
  const noBom = keys.filter((k) => !withBom.has(k));
  if (noBom.length) warnings.push(`No BOM lines for: ${noBom.join(", ")}`);
  if (draftTemplates.size) warnings.push(`BOM template not yet approved for ${draftTemplates.size} selected asset(s) - check the BOM before issuing.`);
  if (rows.length && !lines.size) warnings.push("Everything selected is already ordered or on a draft PO.");
  return {
    lines: [...lines.values()],
    warnings,
    categoryCode: categories.size === 1 ? [...categories][0] : null,
  };
}

async function auditList({ db, params }: Ctx) {
  const limit = Math.min(int(params.limit, "Limit", { min: 1 }) ?? 200, 1000);
  return { rows: await db.query(`select * from procurement.audit order by at desc limit $1`, [limit]) };
}

// ---------------------------------------------------------------------------
// writes
// ---------------------------------------------------------------------------

async function assetPlanSave(ctx: Ctx) {
  const { db, params, user } = ctx;
  const key = reqStr(params.recordKey, "Record key");
  const exists = await one(db, `select 1 from procurement.v_register where record_key = $1`, [key]);
  if (!exists) throw new ApiError(404, "Asset not found in the register.");
  const override = date(params.needDateOverride, "Need date override");
  const onHold = Boolean(params.onHold);
  const notes = str(params.notes, 4000);
  await db.query(`
    insert into procurement.asset_plan (record_key, need_date_override, on_hold, notes, updated_by, updated_at)
    values ($1, $2::date, $3, $4, $5, now())
    on conflict (record_key) do update set need_date_override = excluded.need_date_override, on_hold = excluded.on_hold,
      notes = excluded.notes, updated_by = excluded.updated_by, updated_at = now()`,
    [key, override, onHold, notes, user.email]);
  await audit(ctx, "asset.plan", "asset", key, { needDateOverride: override, onHold, notes });
  return { ok: true };
}

async function assetConfirmBom(ctx: Ctx) {
  const { db, params, user } = ctx;
  const key = reqStr(params.recordKey, "Record key");
  const r = await one(db, `select template_status, bom_lines, lines_ordered, coverage_hash from procurement.v_requirement where record_key = $1`, [key]);
  if (!r) throw new ApiError(404, "Asset not found.");
  if (r.template_status !== "APPROVED") throw bad("Approve the BOM template before confirming this asset's order.");
  if (!(r.bom_lines > 0) || r.lines_ordered < r.bom_lines) {
    throw bad(`Only ${r.lines_ordered} of ${r.bom_lines} BOM lines are on issued purchase orders.`);
  }
  await db.query(`
    insert into procurement.asset_plan (record_key, bom_confirmed_by, bom_confirmed_at, bom_confirmed_hash, updated_by)
    values ($1, $2, now(), $3, $2)
    on conflict (record_key) do update set bom_confirmed_by = excluded.bom_confirmed_by, bom_confirmed_at = now(),
      bom_confirmed_hash = excluded.bom_confirmed_hash, updated_by = excluded.updated_by, updated_at = now()`,
    [key, user.email, r.coverage_hash]);
  await audit(ctx, "asset.bom_confirmed", "asset", key, { lines: r.bom_lines });
  return { ok: true };
}

async function assetUnconfirmBom(ctx: Ctx) {
  const key = reqStr(ctx.params.recordKey, "Record key");
  await ctx.db.query(`update procurement.asset_plan set bom_confirmed_by = null, bom_confirmed_at = null, bom_confirmed_hash = null,
                        updated_by = $2, updated_at = now() where record_key = $1`, [key, ctx.user.email]);
  await audit(ctx, "asset.bom_unconfirmed", "asset", key);
  return { ok: true };
}

async function templateSave(ctx: Ctx) {
  const { db, params, user } = ctx;
  const title = reqStr(params.title, "Title", 300);
  const assemblyKey = reqStr(params.assemblyKey, "Assembly key", 300);
  const category = str(params.categoryCode, 50);
  const drawing = str(params.drawingRef, 300);
  const notes = str(params.notes, 4000);
  const lines = list(params.lines).map((l, i) => ({
    item_code: reqStr(l.item_code, `Line ${i + 1} item code`, 100),
    description: reqStr(l.description, `Line ${i + 1} description`, 500),
    qty: num(l.qty, `Line ${i + 1} qty`, { required: true, min: 0.0001 }),
    uom: str(l.uom, 20) ?? "ea",
    lead_time_days: int(l.lead_time_days, `Line ${i + 1} lead time`, { min: 0 }),
    notes: str(l.notes, 1000),
  }));
  const codes = new Set<string>();
  for (const l of lines) {
    if (codes.has(l.item_code)) throw bad(`Item code ${l.item_code} appears twice - combine the quantities.`);
    codes.add(l.item_code);
  }
  let tid: number;
  if (params.id) {
    tid = id(params.id, "template id");
    const cur = await one(db, `select * from procurement.bom_template where id = $1`, [tid]);
    if (!cur) throw new ApiError(404, "Template not found.");
    // Any edit sends an approved template back to DRAFT for re-approval.
    await db.query(`update procurement.bom_template set title = $2, assembly_key = $3, category_code = $4, drawing_ref = $5,
                      notes = $6, status = 'DRAFT', approved_by = null, approved_at = null, updated_at = now(), updated_by = $7
                    where id = $1`, [tid, title, assemblyKey, category, drawing, notes, user.email]);
    await db.query(`delete from procurement.bom_template_line where template_id = $1`, [tid]);
  } else {
    const row = await one(db, `insert into procurement.bom_template (assembly_key, title, category_code, drawing_ref, notes, updated_by)
                                values ($1, $2, $3, $4, $5, $6) returning id`, [assemblyKey, title, category, drawing, notes, user.email]);
    tid = Number(row!.id);
  }
  for (const [i, l] of lines.entries()) {
    await db.query(`insert into procurement.bom_template_line (template_id, line_no, item_code, description, qty, uom, lead_time_days, notes)
                    values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tid, i + 1, l.item_code, l.description, l.qty, l.uom, l.lead_time_days, l.notes]);
  }
  await audit(ctx, params.id ? "template.update" : "template.create", "template", tid, { assemblyKey, lines: lines.length });
  return { id: tid };
}

async function templateApprove(ctx: Ctx) {
  const tid = id(ctx.params.id, "template id");
  const approve = ctx.params.approve !== false;
  const lines = await one(ctx.db, `select count(*)::int as n from procurement.bom_template_line where template_id = $1`, [tid]);
  if (approve && !(lines!.n > 0)) throw bad("A template needs at least one line before it can be approved.");
  await ctx.db.query(`update procurement.bom_template set status = $2,
                        approved_by = case when $2 = 'APPROVED' then $3 end,
                        approved_at = case when $2 = 'APPROVED' then now() end,
                        updated_at = now(), updated_by = $3 where id = $1`,
    [tid, approve ? "APPROVED" : "DRAFT", ctx.user.email]);
  await audit(ctx, approve ? "template.approve" : "template.unapprove", "template", tid);
  return { ok: true };
}

async function supplierSave(ctx: Ctx) {
  const { db, params } = ctx;
  const fields = [
    reqStr(params.name, "Supplier name", 200), str(params.contact_name, 200), str(params.email, 200),
    str(params.phone, 50), str(params.notes, 2000), params.active !== false,
  ];
  let sid: number;
  if (params.id) {
    sid = id(params.id, "supplier id");
    await db.query(`update procurement.supplier set name = $2, contact_name = $3, email = $4, phone = $5, notes = $6, active = $7,
                      updated_at = now() where id = $1`, [sid, ...fields]);
  } else {
    const row = await one(db, `insert into procurement.supplier (name, contact_name, email, phone, notes, active)
                                values ($1, $2, $3, $4, $5, $6) returning id`, fields);
    sid = Number(row!.id);
  }
  await audit(ctx, params.id ? "supplier.update" : "supplier.create", "supplier", sid, { name: fields[0] });
  return { id: sid };
}

async function categorySave(ctx: Ctx) {
  const { db, params, user } = ctx;
  const code = reqStr(params.code, "Code", 50).toUpperCase();
  const values = [
    code, reqStr(params.name, "Name", 200), reqStr(params.register, "Register", 100), str(params.asset_type, 100),
    str(params.material, 100), int(params.lead_time_days, "Lead time", { min: 0, required: true }),
    int(params.buffer_days, "Buffer", { min: 0, required: true }), params.active !== false,
    int(params.sort_order, "Sort order") ?? 100, str(params.notes, 2000), user.email,
  ];
  await db.query(`
    insert into procurement.category (code, name, register, asset_type, material, lead_time_days, buffer_days, active, sort_order, notes, updated_by)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    on conflict (code) do update set name = excluded.name, register = excluded.register, asset_type = excluded.asset_type,
      material = excluded.material, lead_time_days = excluded.lead_time_days, buffer_days = excluded.buffer_days,
      active = excluded.active, sort_order = excluded.sort_order, notes = excluded.notes,
      updated_by = excluded.updated_by, updated_at = now()`, values);
  await audit(ctx, "category.save", "category", code, { leadTimeDays: values[5], bufferDays: values[6], active: values[7] });
  return { ok: true };
}

async function settingSave(ctx: Ctx) {
  const key = reqStr(ctx.params.key, "Key", 100);
  const value = reqStr(ctx.params.value, "Value", 500);
  if (["lookahead_days", "forecast_weeks"].includes(key)) int(value, key, { min: 0, required: true });
  const r = await ctx.db.query(`update procurement.setting set value = $2 where key = $1 returning key`, [key, value]);
  if (!r.length) throw new ApiError(404, "Unknown setting.");
  await audit(ctx, "setting.save", "setting", key, { value });
  return { ok: true };
}

async function poSave(ctx: Ctx) {
  const { db, params, user } = ctx;
  const poNumber = reqStr(params.po_number, "PO number", 100);
  const supplierId = params.supplier_id ? id(params.supplier_id, "supplier") : null;
  const header = [poNumber, supplierId, date(params.order_date, "Order date"), date(params.expected_date, "Expected date"),
    str(params.category_code, 50), str(params.notes, 4000), user.email];
  const lines = list(params.lines).map((l, i) => {
    const n = i + 1;
    const qty = num(l.qty, `Line ${n} qty`, { required: true, min: 0.0001 })!;
    const allocations = list(l.allocations).map((a) => ({
      record_key: reqStr(a.record_key, `Line ${n} allocation asset`, 100),
      qty: num(a.qty, `Line ${n} allocation qty`, { required: true, min: 0.0001 })!,
    }));
    const allocated = allocations.reduce((s, a) => s + a.qty, 0);
    if (allocated > qty + 1e-9) throw bad(`Line ${n}: ${allocated} allocated to assets but only ${qty} ordered.`);
    const keys = new Set(allocations.map((a) => a.record_key));
    if (keys.size !== allocations.length) throw bad(`Line ${n}: an asset is allocated twice.`);
    return {
      id: l.id ? id(l.id, "line id") : null,
      item_code: reqStr(l.item_code, `Line ${n} item code`, 100),
      description: reqStr(l.description, `Line ${n} description`, 500),
      qty, uom: str(l.uom, 20) ?? "ea",
      unit_cost: num(l.unit_cost, `Line ${n} unit cost`, { min: 0 }),
      required_by: date(l.required_by, `Line ${n} required by`),
      notes: str(l.notes, 1000),
      allocations,
    };
  });
  if (!lines.length) throw bad("Add at least one line.");

  let pid: number;
  if (params.id) {
    pid = id(params.id, "PO id");
    const cur = await one(db, `select status from procurement.purchase_order where id = $1`, [pid]);
    if (!cur) throw new ApiError(404, "Purchase order not found.");
    if (cur.status === "CANCELLED" || cur.status === "RECEIVED") throw bad(`A ${cur.status.toLowerCase()} PO can't be edited.`);
    await db.query(`update procurement.purchase_order set po_number = $2, supplier_id = $3, order_date = $4::date, expected_date = $5::date,
                      category_code = $6, notes = $7, updated_by = $8, updated_at = now() where id = $1`, [pid, ...header]);
    const existing = await db.query(`select id, qty_received from procurement.po_line where po_id = $1`, [pid]);
    const keep = new Set(lines.filter((l) => l.id).map((l) => String(l.id)));
    for (const e of existing) {
      if (keep.has(String(e.id))) continue;
      if (Number(e.qty_received) > 0) throw bad("A line that has deliveries against it can't be removed.");
      await db.query(`delete from procurement.po_line where id = $1`, [e.id]);
    }
    const known = new Map(existing.map((e) => [String(e.id), e]));
    for (const l of lines) {
      if (l.id && !known.has(String(l.id))) throw bad("A line does not belong to this PO.");
      if (l.id && Number(known.get(String(l.id))!.qty_received) > l.qty) throw bad(`${l.item_code}: qty is below what has already been received.`);
    }
  } else {
    try {
      const row = await one(db, `insert into procurement.purchase_order (po_number, supplier_id, order_date, expected_date, category_code, notes, created_by, updated_by)
                                  values ($1, $2, $3::date, $4::date, $5, $6, $7, $7) returning id`, header);
      pid = Number(row!.id);
    } catch (err) {
      if (/duplicate|unique/i.test(String((err as Error).message))) throw bad(`PO number ${poNumber} already exists.`);
      throw err;
    }
  }

  for (const [i, l] of lines.entries()) {
    let lineId: number;
    if (l.id) {
      lineId = l.id;
      await db.query(`update procurement.po_line set line_no = $2, item_code = $3, description = $4, qty = $5, uom = $6,
                        unit_cost = $7, required_by = $8::date, notes = $9 where id = $1`,
        [lineId, i + 1, l.item_code, l.description, l.qty, l.uom, l.unit_cost, l.required_by, l.notes]);
      await db.query(`delete from procurement.po_allocation where po_line_id = $1`, [lineId]);
    } else {
      const row = await one(db, `insert into procurement.po_line (po_id, line_no, item_code, description, qty, uom, unit_cost, required_by, notes)
                                  values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9) returning id`,
        [pid, i + 1, l.item_code, l.description, l.qty, l.uom, l.unit_cost, l.required_by, l.notes]);
      lineId = Number(row!.id);
    }
    for (const a of l.allocations) {
      await db.query(`insert into procurement.po_allocation (po_line_id, record_key, qty) values ($1, $2, $3)`, [lineId, a.record_key, a.qty]);
    }
  }
  await audit(ctx, params.id ? "po.update" : "po.create", "po", pid, {
    poNumber, lines: lines.length, assets: new Set(lines.flatMap((l) => l.allocations.map((a) => a.record_key))).size,
  });
  return { id: pid };
}

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["DRAFT", "CANCELLED"],
  PART_RECEIVED: [],
  RECEIVED: [],
  CANCELLED: ["DRAFT"],
};

async function poSetStatus(ctx: Ctx) {
  const { db, params, user } = ctx;
  const pid = id(params.id, "PO id");
  const to = reqStr(params.status, "Status");
  const po = await one(db, `select * from procurement.purchase_order where id = $1`, [pid]);
  if (!po) throw new ApiError(404, "Purchase order not found.");
  if (!(TRANSITIONS[po.status] || []).includes(to)) throw bad(`Can't move a PO from ${po.status} to ${to}.`);
  if (to === "ISSUED") {
    if (!po.supplier_id) throw bad("Pick a supplier before issuing the PO.");
    const n = await one(db, `select count(*)::int as n from procurement.po_line where po_id = $1`, [pid]);
    if (!(n!.n > 0)) throw bad("The PO has no lines.");
  }
  if (to === "DRAFT" || to === "CANCELLED") {
    const rec = await one(db, `select coalesce(sum(qty_received), 0)::float8 as q from procurement.po_line where po_id = $1`, [pid]);
    if (Number(rec!.q) > 0) throw bad("This PO has deliveries recorded against it.");
  }
  await db.query(`update procurement.purchase_order set status = $2,
                    order_date = case when $2 = 'ISSUED' then coalesce(order_date, current_date) else order_date end,
                    updated_by = $3, updated_at = now() where id = $1`, [pid, to, user.email]);
  await audit(ctx, "po.status", "po", pid, { from: po.status, to });
  return { ok: true };
}

async function poReceive(ctx: Ctx) {
  const { db, params, user } = ctx;
  const pid = id(params.id, "PO id");
  const po = await one(db, `select * from procurement.purchase_order where id = $1`, [pid]);
  if (!po) throw new ApiError(404, "Purchase order not found.");
  if (!["ISSUED", "PART_RECEIVED"].includes(po.status)) throw bad("Deliveries can only be recorded against an issued PO.");
  const receivedDate = date(params.received_date, "Received date");
  const docket = str(params.docket_no, 100);
  const notes = str(params.notes, 2000);
  const lines = list(params.lines)
    .map((l) => ({ po_line_id: id(l.po_line_id, "line"), qty: num(l.qty, "Received qty") ?? 0 }))
    .filter((l) => l.qty !== 0);
  if (!lines.length) throw bad("Enter a received quantity on at least one line.");
  for (const l of lines) {
    const line = await one(db, `select * from procurement.po_line where id = $1 and po_id = $2`, [l.po_line_id, pid]);
    if (!line) throw bad("A line does not belong to this PO.");
    const total = Number(line.qty_received) + l.qty;
    if (total < 0) throw bad(`${line.item_code}: can't reverse more than has been received.`);
    if (total > Number(line.qty) + 1e-9) throw bad(`${line.item_code}: ${total} would exceed the ${line.qty} ordered.`);
    await db.query(`insert into procurement.receipt (po_line_id, qty, received_date, docket_no, received_by, notes)
                    values ($1, $2, coalesce($3::date, current_date), $4, $5, $6)`, [l.po_line_id, l.qty, receivedDate, docket, user.email, notes]);
    await db.query(`update procurement.po_line set qty_received = $2 where id = $1`, [l.po_line_id, total]);
  }
  const s = await one(db, `select bool_and(qty_received >= qty) as all_in, bool_or(qty_received > 0) as any_in
                             from procurement.po_line where po_id = $1`, [pid]);
  const status = s!.all_in ? "RECEIVED" : s!.any_in ? "PART_RECEIVED" : "ISSUED";
  await db.query(`update procurement.purchase_order set status = $2, updated_by = $3, updated_at = now() where id = $1`, [pid, status, user.email]);
  await audit(ctx, "po.receive", "po", pid, { docket, lines: lines.length, status });
  return { ok: true, status };
}

async function poDelete(ctx: Ctx) {
  const pid = id(ctx.params.id, "PO id");
  const po = await one(ctx.db, `select status, po_number from procurement.purchase_order where id = $1`, [pid]);
  if (!po) throw new ApiError(404, "Purchase order not found.");
  if (po.status !== "DRAFT") throw bad("Only draft POs can be deleted - cancel it instead.");
  await ctx.db.query(`delete from procurement.purchase_order where id = $1`, [pid]);
  await audit(ctx, "po.delete", "po", pid, { poNumber: po.po_number });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

const ACTIONS: Record<string, { perm: Perm; write?: boolean; fn: (ctx: Ctx) => Promise<unknown> }> = {
  "lookups": { perm: "view", fn: lookups },
  "dashboard": { perm: "view", fn: dashboard },
  "requirements": { perm: "view", fn: requirements },
  "asset.get": { perm: "view", fn: assetGet },
  "asset.plan.save": { perm: "edit", write: true, fn: assetPlanSave },
  "asset.confirmBom": { perm: "edit", write: true, fn: assetConfirmBom },
  "asset.unconfirmBom": { perm: "edit", write: true, fn: assetUnconfirmBom },
  "templates.list": { perm: "view", fn: templatesList },
  "template.get": { perm: "view", fn: templateGet },
  "template.save": { perm: "edit", write: true, fn: templateSave },
  "template.approve": { perm: "edit", write: true, fn: templateApprove },
  "suppliers.list": { perm: "view", fn: suppliersList },
  "supplier.save": { perm: "edit", write: true, fn: supplierSave },
  "category.save": { perm: "admin", write: true, fn: categorySave },
  "setting.save": { perm: "admin", write: true, fn: settingSave },
  "pos.list": { perm: "view", fn: posList },
  "po.get": { perm: "view", fn: poGet },
  "po.draftFromAssets": { perm: "view", fn: poDraftFromAssets },
  "po.save": { perm: "edit", write: true, fn: poSave },
  "po.setStatus": { perm: "edit", write: true, fn: poSetStatus },
  "po.receive": { perm: "receive", write: true, fn: poReceive },
  "po.delete": { perm: "edit", write: true, fn: poDelete },
  "audit.list": { perm: "view", fn: auditList },
};

export function actionInfo(action: string) {
  return ACTIONS[action] ?? null;
}

export async function handle(db: Db, user: User, action: string, params: Row = {}) {
  if (action === "me") return { user, permissions: permissionsFor(user.role) };
  const entry = ACTIONS[action];
  if (!entry) throw new ApiError(404, `Unknown action: ${action}`);
  if (!PERMS[entry.perm].includes(user.role)) throw new ApiError(403, "Your role doesn't have access to do that.");
  return entry.fn({ db, user, params: params && typeof params === "object" ? params : {} });
}
