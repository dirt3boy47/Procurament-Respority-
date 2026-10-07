-- T2W Procurement planner — initial schema.
--
-- Isolation from the works-tracking app (db-t2w):
--   * Everything this app owns lives in its own schema, `procurement`.
--   * The asset register and programme are read through views in this schema.
--     Nothing here writes to, alters, or adds foreign keys onto `public` tables,
--     so the works app's imports, resets and backups are unaffected.
--   * The API runs each request as the `procurement_app` role, which has no
--     privileges on `public` at all — the database itself refuses any write
--     from this app outside the `procurement` schema.
--   * The schema is not exposed through the Supabase Data API (PostgREST);
--     anon / authenticated get no access.

create schema if not exists procurement;
revoke all on schema procurement from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema procurement from anon, authenticated';
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'procurement_app') then
    create role procurement_app nologin;
  end if;
end $$;
grant procurement_app to postgres;
grant usage on schema procurement to procurement_app;

-- ---------------------------------------------------------------------------
-- Settings and procurement categories (lead times)
-- ---------------------------------------------------------------------------

create table procurement.setting (
  key         text primary key,
  value       text not null,
  description text
);

insert into procurement.setting (key, value, description) values
  ('lookahead_days', '21', 'Assets whose order-by date falls within this many days are flagged "Order now".'),
  ('forecast_weeks', '26', 'Number of weeks shown on the order forecast.');

create table procurement.category (
  code           text primary key,
  name           text not null,
  register       text not null,            -- matches tblasset."Register"
  asset_type     text,                     -- matches tblasset."Asset Type" (null = any)
  material       text,                     -- matches tblasset."Fitting Material" (null = any)
  lead_time_days integer not null default 56 check (lead_time_days >= 0),
  buffer_days    integer not null default 7  check (buffer_days >= 0),
  active         boolean not null default true,
  sort_order     integer not null default 100,
  notes          text,
  updated_at     timestamptz not null default now(),
  updated_by     text
);

insert into procurement.category (code, name, register, asset_type, material, lead_time_days, buffer_days, active, sort_order, notes) values
  ('AV',        'Air valve assemblies',          'Valve', 'AV',  null,   84, 14, true,  10, 'Lead time is a placeholder - confirm with supplier.'),
  ('SCV',       'Scour valve assemblies',        'Valve', 'SCV', null,   84, 14, true,  20, 'Lead time is a placeholder - confirm with supplier.'),
  ('IV',        'Isolation valve assemblies',    'Valve', 'IV',  null,  112, 14, true,  30, 'Lead time is a placeholder - confirm with supplier.'),
  ('PIG',       'Pigging stations',              'Valve', 'PIG', null,  112, 14, true,  40, 'Lead time is a placeholder - confirm with supplier.'),
  ('BEND-DICL', 'DICL bends',                    'Bend',  null,  'DICL', 42,  7, true,  50, 'Lead time is a placeholder - confirm with supplier.'),
  ('BEND-MSCL', 'MSCL fabricated bends',         'Bend',  null,  'MSCL', 56,  7, true,  60, 'Lead time is a placeholder - confirm with fabricator.'),
  ('TB',        'Thrust blocks (precast/reo)',   'Thrust Block', null, null, 14, 7, false, 70, 'Inactive by default - enable if thrust block materials are procured per block.');

-- ---------------------------------------------------------------------------
-- Read-only views over the works app's data (owned by postgres).
-- ---------------------------------------------------------------------------

create view procurement.v_register as
select
  a."Record Key"               as record_key,
  a."Asset ID"                 as asset_id,
  a."Pipeline Section"         as section,
  a."Register"                 as register,
  a."Asset Type"               as asset_type,
  a."Chainage Start (m)"       as chainage,
  a."Valve Arrangement Type"   as valve_arrangement_type,
  a."Valve Assembly Group"     as valve_assembly_group,
  a."Valve Arrangement"        as valve_arrangement,
  a."Branch / Tee Size"        as tee_size,
  a."Air Valve"                as air_valve,
  a."Scour Valve"              as scour_valve,
  a."Fitting Type"             as fitting_type,
  a."Fitting Material"         as fitting_material,
  a."Fitting DN (mm)"          as fitting_dn,
  a."Type of Bend"             as bend_angle,
  a."Bend Rate Class"          as bend_class,
  a."Thrust Block Category"    as tb_category,
  a."Utility Description"      as utility_description,
  a."Side"                     as side,
  coalesce(a."Location Drawing Ref", a."Drawing (Start)") as drawing,
  a."Installed"                as installed,
  a."Complete"                 as complete,
  -- One BOM template per assembly key.
  regexp_replace(trim(case
    when a."Register" = 'Valve' then
      coalesce(a."Valve Arrangement Type", a."Asset Type") || ' | ' || coalesce(a."Branch / Tee Size", '?')
    when a."Register" = 'Bend' then
      coalesce(a."Fitting Material", '?') || ' DN' || coalesce(a."Fitting DN (mm)"::text, '?') || ' ' ||
      coalesce(a."Type of Bend", '?') || ' ' || coalesce(a."Asset Type", '')
    when a."Register" = 'Thrust Block' then
      'TB ' || coalesce(a."Utility Description", '?') || ' | ' || coalesce(a."Fitting Type", '?') ||
      coalesce(' DN' || a."Fitting DN (mm)"::text, '')
    else coalesce(a."Register", '?') || ' | ' || coalesce(a."Asset Type", '?')
  end), '\s+', ' ', 'g') as assembly_key
from public.tblasset a;

create view procurement.v_activity as
select activity_id, activity_name, area, work_package, pipeline_section as section,
       chainage_display, planned_start, planned_finish, physical_percent_complete
from public.app_schedule_activity;

create view procurement.v_activity_link as
select activity_id, record_key from public.app_schedule_activity_asset;

create view procurement.v_user as
select user_id, email, full_name, role, active from public.app_profiles;

-- ---------------------------------------------------------------------------
-- Procurement data owned by this app
-- ---------------------------------------------------------------------------

create table procurement.bom_template (
  id            bigserial primary key,
  assembly_key  text not null unique,
  category_code text references procurement.category(code) on update cascade on delete set null,
  title         text not null,
  status        text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED')),
  drawing_ref   text,
  notes         text,
  approved_by   text,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text
);

create table procurement.bom_template_line (
  id             bigserial primary key,
  template_id    bigint not null references procurement.bom_template(id) on delete cascade,
  line_no        integer not null,
  item_code      text not null,
  description    text not null,
  qty            numeric not null default 1 check (qty > 0),
  uom            text not null default 'ea',
  lead_time_days integer check (lead_time_days >= 0),   -- overrides the category lead time
  notes          text,
  unique (template_id, item_code)
);

create table procurement.supplier (
  id           bigserial primary key,
  name         text not null unique,
  contact_name text,
  email        text,
  phone        text,
  notes        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table procurement.purchase_order (
  id            bigserial primary key,
  po_number     text not null unique,
  supplier_id   bigint references procurement.supplier(id),
  status        text not null default 'DRAFT'
                check (status in ('DRAFT', 'ISSUED', 'PART_RECEIVED', 'RECEIVED', 'CANCELLED')),
  order_date    date,
  expected_date date,
  category_code text references procurement.category(code) on update cascade on delete set null,
  notes         text,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text
);

create table procurement.po_line (
  id           bigserial primary key,
  po_id        bigint not null references procurement.purchase_order(id) on delete cascade,
  line_no      integer not null,
  item_code    text not null,
  description  text not null,
  qty          numeric not null check (qty > 0),
  uom          text not null default 'ea',
  unit_cost    numeric check (unit_cost >= 0),
  qty_received numeric not null default 0 check (qty_received >= 0),
  required_by  date,
  notes        text
);
create index po_line_po_idx on procurement.po_line(po_id);

-- Which register assets a PO line was bought for. record_key deliberately has
-- no foreign key into public.tblasset so the works app can never be blocked.
create table procurement.po_allocation (
  id         bigserial primary key,
  po_line_id bigint not null references procurement.po_line(id) on delete cascade,
  record_key text not null,
  qty        numeric not null check (qty > 0),
  unique (po_line_id, record_key)
);
create index po_allocation_record_idx on procurement.po_allocation(record_key);

create table procurement.receipt (
  id            bigserial primary key,
  po_line_id    bigint not null references procurement.po_line(id) on delete cascade,
  qty           numeric not null check (qty <> 0),
  received_date date not null default current_date,
  docket_no     text,
  received_by   text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table procurement.asset_plan (
  record_key         text primary key,
  need_date_override date,
  on_hold            boolean not null default false,
  notes              text,
  bom_confirmed_by   text,
  bom_confirmed_at   timestamptz,
  bom_confirmed_hash text,
  updated_by         text,
  updated_at         timestamptz not null default now()
);

create table procurement.audit (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  user_email text,
  action     text not null,
  entity     text,
  entity_id  text,
  details    jsonb not null default '{}'::jsonb
);
create index audit_at_idx on procurement.audit(at desc);

-- ---------------------------------------------------------------------------
-- Requirement views: when each asset is needed, when to order, what's covered
-- ---------------------------------------------------------------------------

-- Assets in an active procurement category, with the earliest programme date
-- of any linked activity as the default "needed on site" date.
create view procurement.v_asset_need as
with need as (
  select l.record_key,
         min(a.planned_start) as programme_need_date,
         (array_agg(a.activity_id order by a.planned_start nulls last))[1] as need_activity_id
    from procurement.v_activity_link l
    join procurement.v_activity a on a.activity_id = l.activity_id
   group by l.record_key
)
select r.*,
       c.code as category_code, c.name as category_name,
       c.lead_time_days, c.buffer_days, c.sort_order as category_sort,
       n.programme_need_date, n.need_activity_id,
       p.need_date_override, coalesce(p.on_hold, false) as on_hold, p.notes as plan_notes,
       p.bom_confirmed_by, p.bom_confirmed_at, p.bom_confirmed_hash,
       coalesce(p.need_date_override, n.programme_need_date) as need_date
  from procurement.v_register r
  join lateral (
    select c.* from procurement.category c
     where c.active and c.register = r.register
       and (c.asset_type is null or c.asset_type = r.asset_type)
       and (c.material  is null or c.material  = r.fitting_material)
     order by c.sort_order limit 1
  ) c on true
  left join need n on n.record_key = r.record_key
  left join procurement.asset_plan p on p.record_key = r.record_key;

-- One row per asset per BOM line: required vs drafted vs ordered vs received.
create view procurement.v_asset_bom as
select n.record_key, t.id as template_id, t.status as template_status,
       tl.id as template_line_id, tl.line_no, tl.item_code, tl.description, tl.uom,
       tl.qty as required_qty,
       coalesce(tl.lead_time_days, n.lead_time_days) as lead_time_days,
       coalesce(o.drafted_qty, 0)  as drafted_qty,
       coalesce(o.ordered_qty, 0)  as ordered_qty,
       coalesce(o.received_qty, 0) as received_qty,
       o.po_numbers
  from procurement.v_asset_need n
  join procurement.bom_template t on t.assembly_key = n.assembly_key
  join procurement.bom_template_line tl on tl.template_id = t.id
  left join lateral (
    select sum(pa.qty) filter (where po.status = 'DRAFT') as drafted_qty,
           sum(pa.qty) filter (where po.status in ('ISSUED', 'PART_RECEIVED', 'RECEIVED')) as ordered_qty,
           sum(pa.qty * least(1, pl.qty_received / pl.qty))
             filter (where po.status in ('ISSUED', 'PART_RECEIVED', 'RECEIVED')) as received_qty,
           string_agg(distinct po.po_number, ', ') filter (where po.status <> 'CANCELLED') as po_numbers
      from procurement.po_allocation pa
      join procurement.po_line pl on pl.id = pa.po_line_id
      join procurement.purchase_order po on po.id = pl.po_id
     where pa.record_key = n.record_key and pl.item_code = tl.item_code
  ) o on true;

-- The order schedule: one row per asset with order-by date and status.
create view procurement.v_requirement as
with bom as (
  select record_key,
         count(*)                                         as bom_lines,
         max(lead_time_days)                              as bom_lead_days,
         count(*) filter (where ordered_qty  >= required_qty) as lines_ordered,
         count(*) filter (where received_qty >= required_qty - 0.0001) as lines_received,
         count(*) filter (where ordered_qty > 0 or drafted_qty > 0) as lines_touched,
         count(*) filter (where drafted_qty > 0)          as lines_drafted,
         string_agg(distinct po_numbers, ', ')            as po_numbers,
         md5(string_agg(item_code || ':' || required_qty || ':' || ordered_qty, '|' order by item_code)) as coverage_hash
    from procurement.v_asset_bom
   group by record_key
),
cfg as (
  select coalesce((select value::int from procurement.setting where key = 'lookahead_days'), 21) as lookahead_days
)
select n.*,
       t.id as template_id, t.status as template_status,
       coalesce(b.bom_lines, 0) as bom_lines,
       coalesce(b.lines_ordered, 0) as lines_ordered,
       coalesce(b.lines_received, 0) as lines_received,
       coalesce(b.lines_drafted, 0) as lines_drafted,
       b.po_numbers, b.coverage_hash,
       coalesce(b.bom_lead_days, n.lead_time_days) as effective_lead_days,
       (n.need_date - coalesce(b.bom_lead_days, n.lead_time_days) - n.buffer_days) as order_by_date,
       case
         when upper(coalesce(n.installed, '')) in ('YES', 'Y', 'TRUE')
           or upper(coalesce(n.complete, '')) in ('YES', 'Y', 'TRUE')       then 'INSTALLED'
         when n.on_hold                                                     then 'ON_HOLD'
         when t.id is null or coalesce(b.bom_lines, 0) = 0                   then 'NO_BOM'
         when b.lines_received = b.bom_lines                                then 'RECEIVED'
         when b.lines_ordered = b.bom_lines                                 then 'ORDERED'
         when b.lines_touched > 0                                           then 'PART_ORDERED'
         when n.need_date is null                                           then 'NO_DATE'
         when (n.need_date - coalesce(b.bom_lead_days, n.lead_time_days) - n.buffer_days) < current_date
                                                                            then 'OVERDUE'
         when (n.need_date - coalesce(b.bom_lead_days, n.lead_time_days) - n.buffer_days)
              <= current_date + cfg.lookahead_days                          then 'ORDER_NOW'
         else 'PLANNED'
       end as status,
       (n.bom_confirmed_at is not null and n.bom_confirmed_hash = b.coverage_hash) as bom_confirmed,
       (n.bom_confirmed_at is not null and n.bom_confirmed_hash is distinct from b.coverage_hash) as bom_confirmation_stale
  from procurement.v_asset_need n
  cross join cfg
  left join procurement.bom_template t on t.assembly_key = n.assembly_key
  left join bom b on b.record_key = n.record_key;

-- ---------------------------------------------------------------------------
-- Starter BOM templates (DRAFT) - one per assembly found in the register.
-- Lines come only from register fields; the full component list must be
-- completed from the standard drawings and approved before ordering.
-- ---------------------------------------------------------------------------

insert into procurement.bom_template (assembly_key, category_code, title, status, notes, updated_by)
select distinct on (n.assembly_key) n.assembly_key, n.category_code, n.assembly_key, 'DRAFT',
       'Auto-created from the asset register. Complete the component list from the standard drawing, then approve.',
       'system'
  from procurement.v_asset_need n
 order by n.assembly_key;

insert into procurement.bom_template_line (template_id, line_no, item_code, description, qty, uom)
select t.id, 1,
       case when r.register = 'Valve' then 'TEE-' || replace(coalesce(r.tee_size, 'TBC'), ' ', '')
            when r.register = 'Bend'  then 'BEND-' || coalesce(r.fitting_material, 'TBC') || '-' || coalesce(r.fitting_dn::text, 'TBC')
                                           || '-' || replace(coalesce(r.bend_angle, 'TBC'), '°', '')
            else 'ITEM-' || t.id end,
       case when r.register = 'Valve' then 'Branch tee ' || coalesce(r.tee_size, '(size TBC)')
            when r.register = 'Bend'  then coalesce(r.fitting_material, '') || ' bend DN' || coalesce(r.fitting_dn::text, '?')
                                           || ' x ' || coalesce(r.bend_angle, '?') || coalesce(' (' || r.bend_class || ')', '')
            else t.title end,
       1, 'ea'
  from procurement.bom_template t
  join lateral (select * from procurement.v_asset_need n where n.assembly_key = t.assembly_key limit 1) r on true;

insert into procurement.bom_template_line (template_id, line_no, item_code, description, qty, uom)
select t.id, 2,
       'ASSY-' || trim(both '-' from upper(regexp_replace(coalesce(r.valve_assembly_group, r.asset_type), '[^A-Za-z0-9]+', '-', 'g'))),
       coalesce(r.valve_assembly_group, r.asset_type) || ' - pit / valve set per standard drawing (expand into components)',
       1, 'set'
  from procurement.bom_template t
  join lateral (select * from procurement.v_asset_need n where n.assembly_key = t.assembly_key limit 1) r on true
 where r.register = 'Valve';

-- ---------------------------------------------------------------------------
-- Privileges: procurement_app may read/write the procurement schema only.
-- ---------------------------------------------------------------------------

grant select on all tables in schema procurement to procurement_app;
grant insert, update, delete on
  procurement.setting, procurement.category, procurement.bom_template, procurement.bom_template_line,
  procurement.supplier, procurement.purchase_order, procurement.po_line, procurement.po_allocation,
  procurement.receipt, procurement.asset_plan, procurement.audit
  to procurement_app;
grant usage, select on all sequences in schema procurement to procurement_app;

-- RLS on as a backstop: only procurement_app (and the owner) can touch rows.
do $$
declare t text;
begin
  foreach t in array array['setting','category','bom_template','bom_template_line','supplier',
                           'purchase_order','po_line','po_allocation','receipt','asset_plan','audit'] loop
    execute format('alter table procurement.%I enable row level security', t);
    execute format('create policy procurement_app_all on procurement.%I for all to procurement_app using (true) with check (true)', t);
  end loop;
end $$;
