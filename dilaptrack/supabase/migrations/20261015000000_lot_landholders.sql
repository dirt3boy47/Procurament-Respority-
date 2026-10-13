-- DilapTrack: several landholders per lot, restoration hold points, issued reports.
--
--   * lot_landholders: a lot can have many landholders, each with a role (road
--     authority, owner, adjacent resident, occupier, other) and the property it
--     relates to (e.g. "12 Gowrie Rd").
--   * Written owner acceptance is a HOLD POINT only where there was damage to
--     that landholder's property: tick "restoration required" on the link and the
--     lot can't close until that landholder's acceptance is recorded.
--   * Files can be tagged to the landholder they relate to.
--   * issued_reports: condition reports produced on request (e.g. for the
--     Principal), saved against the lot and landholder - also after close-out.
--
-- Written without DROP statements so it can be applied safely to a live project.
-- The old single landholder on lots (lots.landholder_id, lots.landholder_signoff_*)
-- is copied into lot_landholders and no longer used.

-- ---------------------------------------------------------------------------
-- Lot landholders
-- ---------------------------------------------------------------------------

create type public.landholder_role as enum ('road_authority', 'owner', 'adjacent_resident', 'occupier', 'other');

create table public.lot_landholders (
  id                     uuid primary key default gen_random_uuid(),
  lot_id                 uuid not null references public.lots (id) on delete cascade,
  landholder_id          uuid not null references public.landholders (id) on delete restrict,
  role                   public.landholder_role not null default 'owner',
  property               text,
  -- Damage to this landholder's property that needs restoring: makes written acceptance a hold point.
  restoration_required   boolean not null default false,
  damage_notes           text,
  acceptance_date        date,
  acceptance_name        text,
  acceptance_notes       text,
  created_at             timestamptz not null default now(),
  created_by             uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.profiles (id) on delete set null,
  unique (lot_id, landholder_id),
  constraint lot_landholders_acceptance_needs_name
    check (acceptance_date is null or coalesce(btrim(acceptance_name), '') <> '')
);

create index lot_landholders_landholder_idx on public.lot_landholders (landholder_id);

create trigger lot_landholders_updated before update on public.lot_landholders
  for each row execute function public.set_updated();
create trigger lot_landholders_guard before insert or update on public.lot_landholders
  for each row execute function public.guard_lot_children();
create trigger lot_landholders_guard_delete before delete on public.lot_landholders
  for each row execute function public.guard_lot_children_delete();
create trigger lot_landholders_audit after insert or update or delete on public.lot_landholders
  for each row execute function public.audit_change();

-- Recording written acceptance (and the hold point flag) is for project managers.
create function public.protect_acceptance()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.can_manage() and (
       tg_op = 'INSERT' and (new.acceptance_date is not null)
    or tg_op = 'UPDATE' and (new.acceptance_date is distinct from old.acceptance_date
                             or new.acceptance_name is distinct from old.acceptance_name
                             or new.acceptance_notes is distinct from old.acceptance_notes)) then
    raise exception 'Only administrators and project managers can record landholder acceptance' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger lot_landholders_protect_acceptance before insert or update on public.lot_landholders
  for each row execute function public.protect_acceptance();

alter table public.lot_landholders enable row level security;

create policy "lot landholders: view" on public.lot_landholders for select to authenticated
  using ((select public.can_view()));
create policy "lot landholders: create" on public.lot_landholders for insert to authenticated
  with check ((select public.can_edit_records()));
create policy "lot landholders: update" on public.lot_landholders for update to authenticated
  using ((select public.can_edit_records())) with check ((select public.can_edit_records()));
create policy "lot landholders: delete" on public.lot_landholders for delete to authenticated
  using ((select public.can_manage()));

revoke all on public.lot_landholders from anon, authenticated;
grant select, insert, update, delete on public.lot_landholders to authenticated;

-- Copy each lot's single landholder (and its sign-off) across. A recorded
-- sign-off is kept as an acceptance against that landholder.
insert into public.lot_landholders (lot_id, landholder_id, role, acceptance_date, acceptance_name, acceptance_notes)
select l.id, l.landholder_id, 'owner', l.landholder_signoff_date,
       case when l.landholder_signoff_date is not null then coalesce(nullif(btrim(l.landholder_signoff_name), ''), h.name) end,
       l.landholder_signoff_notes
from public.lots l
join public.landholders h on h.id = l.landholder_id
on conflict (lot_id, landholder_id) do nothing;

-- The old column would block deleting a landholder that is no longer linked.
update public.lots set landholder_id = null where landholder_id is not null;
comment on column public.lots.landholder_id is 'Deprecated: use lot_landholders.';
comment on column public.lots.landholder_signoff_date is 'Deprecated: acceptance is recorded per landholder in lot_landholders.';

-- ---------------------------------------------------------------------------
-- Files tagged to a landholder; issued reports
-- ---------------------------------------------------------------------------

alter type public.file_category add value if not exists 'reports';

alter table public.attachments
  add column landholder_id uuid references public.landholders (id) on delete set null;
create index attachments_landholder_idx on public.attachments (landholder_id) where landholder_id is not null;

create table public.issued_reports (
  id             uuid primary key default gen_random_uuid(),
  lot_id         uuid not null references public.lots (id) on delete cascade,
  landholder_id  uuid references public.landholders (id) on delete set null,
  attachment_id  uuid not null references public.attachments (id) on delete cascade,
  title          text not null check (btrim(title) <> ''),
  issued_to      text,
  notes          text,
  photo_count    int not null default 0,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null
);

create index issued_reports_lot_idx on public.issued_reports (lot_id, created_at desc);
create index issued_reports_landholder_idx on public.issued_reports (landholder_id) where landholder_id is not null;

create trigger issued_reports_audit after insert or update or delete on public.issued_reports
  for each row execute function public.audit_change();

alter table public.issued_reports enable row level security;

create policy "issued reports: view" on public.issued_reports for select to authenticated
  using ((select public.can_view()));
create policy "issued reports: create" on public.issued_reports for insert to authenticated
  with check ((select public.can_edit_records()));
create policy "issued reports: delete" on public.issued_reports for delete to authenticated
  using ((select public.can_manage()));

revoke all on public.issued_reports from anon, authenticated;
grant select, insert, delete on public.issued_reports to authenticated;

-- Closed lots stay frozen, except that reports can still be issued on request.
create or replace function public.guard_lot_children()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  lot record;
begin
  select id, lot_number, status into lot from public.lots where id = new.lot_id;
  if lot.status = 'closed' then
    if tg_table_name = 'attachments' and tg_op = 'INSERT' and to_jsonb(new) ->> 'category' = 'reports' then
      return new;
    end if;
    raise exception 'Lot % is closed. Reopen it before changing its records.', lot.lot_number using errcode = '23514';
  end if;
  if lot.status = 'not_started'
     and tg_table_name in ('surveys', 'attachments')
     and (tg_table_name <> 'surveys' or to_jsonb(new) ->> 'status' <> 'not_started') then
    update public.lots set status = 'in_progress' where id = lot.id;
  end if;
  return new;
end
$$;

create or replace function public.guard_lot_children_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  lot record;
begin
  if pg_trigger_depth() = 1 then
    if tg_table_name = 'attachments' and to_jsonb(old) ->> 'category' = 'reports' then
      return old;
    end if;
    select lot_number, status into lot from public.lots where id = old.lot_id;
    if lot.status = 'closed' then
      raise exception 'Lot % is closed. Reopen it before changing its records.', lot.lot_number using errcode = '23514';
    end if;
  end if;
  return old;
end
$$;

-- ---------------------------------------------------------------------------
-- Lot progress and close-out
-- ---------------------------------------------------------------------------

-- Extends the view in place: existing columns keep their names and order.
-- landholder_id/name/phone/email now describe the lot's primary landholder.
create or replace view public.lot_overview
with (security_invoker = true)
as
select
  l.id, l.lot_number, l.address, p.landholder_id, l.chainage, l.chainage_m, l.status, l.assigned_engineer, l.notes,
  l.landholder_signoff_date, l.landholder_signoff_name, l.landholder_signoff_notes, l.closed_at, l.closed_by,
  l.created_at, l.created_by, l.updated_at, l.updated_by,
  p.name                               as landholder_name,
  p.phone                              as landholder_phone,
  p.email                              as landholder_email,
  coalesce(pre.status, 'not_started')  as pre_survey_status,
  pre.survey_date                      as pre_survey_date,
  pre.surveyor                         as pre_surveyor,
  coalesce(post.status, 'not_started') as post_survey_status,
  post.survey_date                     as post_survey_date,
  post.surveyor                        as post_surveyor,
  coalesce(f.file_count, 0)            as file_count,
  coalesce(pre.status = 'complete', false)
    and coalesce(post.status = 'complete', false)
    and coalesce(a.acceptances_outstanding, 0) = 0 as ready_to_close,
  coalesce(a.landholder_count, 0)        as landholder_count,
  a.landholder_names,
  coalesce(a.restorations, 0)            as restorations,
  coalesce(a.acceptances_outstanding, 0) as acceptances_outstanding,
  coalesce(r.report_count, 0)            as issued_report_count
from public.lots l
left join lateral (
  -- Primary landholder: road authority first, then owners, then anyone; earliest linked.
  select h.id as landholder_id, h.name, h.phone, h.email
  from public.lot_landholders x
  join public.landholders h on h.id = x.landholder_id
  where x.lot_id = l.id
  order by array_position(array['road_authority', 'owner', 'adjacent_resident', 'occupier', 'other'], x.role::text), x.created_at
  limit 1
) p on true
left join lateral (
  select
    count(*)::int as landholder_count,
    string_agg(h.name, ', ' order by array_position(array['road_authority', 'owner', 'adjacent_resident', 'occupier', 'other'], x.role::text), h.name) as landholder_names,
    count(*) filter (where x.restoration_required)::int as restorations,
    count(*) filter (where x.restoration_required and x.acceptance_date is null)::int as acceptances_outstanding
  from public.lot_landholders x
  join public.landholders h on h.id = x.landholder_id
  where x.lot_id = l.id
) a on true
left join public.surveys pre  on pre.lot_id = l.id and pre.survey_type = 'pre_construction'
left join public.surveys post on post.lot_id = l.id and post.survey_type = 'post_construction'
left join lateral (
  select count(*)::int as file_count from public.attachments x where x.lot_id = l.id
) f on true
left join lateral (
  select count(*)::int as report_count from public.issued_reports x where x.lot_id = l.id
) r on true;

create or replace function public.lot_closeout_blockers(p_lot_id uuid)
returns text[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  blockers text[] := array[]::text[];
  waiting text;
begin
  if not exists (select 1 from public.surveys where lot_id = p_lot_id and survey_type = 'pre_construction' and status = 'complete') then
    blockers := array_append(blockers, 'Pre-construction survey is not complete');
  end if;
  if not exists (select 1 from public.surveys where lot_id = p_lot_id and survey_type = 'post_construction' and status = 'complete') then
    blockers := array_append(blockers, 'Post-construction survey is not complete');
  end if;
  select string_agg(h.name, ', ' order by h.name) into waiting
  from public.lot_landholders x
  join public.landholders h on h.id = x.landholder_id
  where x.lot_id = p_lot_id and x.restoration_required and x.acceptance_date is null;
  if waiting is not null then
    blockers := array_append(blockers, 'Written acceptance of restoration is outstanding from ' || waiting);
  end if;
  return blockers;
end
$$;

-- ---------------------------------------------------------------------------
-- Lot import: landholders (one or more, separated by ";") are linked to the lot
-- ---------------------------------------------------------------------------

create or replace function public.import_lots(p_rows jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  new_landholders int;
  linked int;
  inserted_ids uuid[];
  inserted_numbers text[];
  skipped jsonb;
begin
  if not public.can_manage() then
    raise exception 'Only administrators and project managers can import lots' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected an array of lots' using errcode = '22023';
  end if;

  -- 1. Landholders not yet in the register. "TRC; J Smith" names two; the
  --    contact column belongs to the first.
  with names as (
    select btrim(regexp_replace(n.name, '\s+', ' ', 'g')) as name,
           case when n.pos = 1 then nullif(btrim(r ->> 'landholder_contact'), '') end as contact
    from jsonb_array_elements(p_rows) r
    cross join lateral unnest(string_to_array(r ->> 'landholder', ';')) with ordinality as n(name, pos)
    where btrim(n.name) <> ''
  ), ins as (
    insert into public.landholders (name, phone, email)
    select distinct on (lower(name)) name,
           case when contact !~ '@' then contact end,
           case when contact ~ '@' then contact end
    from names
    order by lower(name), contact nulls last
    on conflict ((lower(name))) do nothing
    returning 1
  )
  select count(*) into new_landholders from ins;

  -- 2. Lots (existing lot numbers are skipped).
  with ins as (
    insert into public.lots (lot_number, address, chainage, status, assigned_engineer, notes)
    select btrim(r ->> 'lot_number'),
           nullif(btrim(r ->> 'address'), ''),
           nullif(btrim(r ->> 'chainage'), ''),
           coalesce(nullif(btrim(r ->> 'status'), ''), 'not_started')::public.lot_status,
           nullif(btrim(r ->> 'assigned_engineer'), ''),
           nullif(btrim(r ->> 'notes'), '')
    from jsonb_array_elements(p_rows) r
    where coalesce(btrim(r ->> 'lot_number'), '') <> ''
    on conflict ((lower(lot_number))) do nothing
    returning id, lot_number
  )
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(lower(lot_number)), '{}')
    into inserted_ids, inserted_numbers
  from ins;

  -- 3. Link the new lots to their landholders.
  with ins as (
    insert into public.lot_landholders (lot_id, landholder_id, role)
    select distinct l.id, h.id, 'owner'::public.landholder_role
    from jsonb_array_elements(p_rows) r
    cross join lateral unnest(string_to_array(r ->> 'landholder', ';')) as n(name)
    join public.lots l on lower(l.lot_number) = lower(btrim(r ->> 'lot_number')) and l.id = any (inserted_ids)
    join public.landholders h on lower(h.name) = lower(btrim(regexp_replace(n.name, '\s+', ' ', 'g')))
    on conflict (lot_id, landholder_id) do nothing
    returning 1
  )
  select count(*) into linked from ins;

  select coalesce(jsonb_agg(btrim(r ->> 'lot_number') order by ord), '[]'::jsonb) into skipped
  from jsonb_array_elements(p_rows) with ordinality as t(r, ord)
  where not (lower(btrim(r ->> 'lot_number')) = any (inserted_numbers));

  return jsonb_build_object(
    'inserted', cardinality(inserted_ids),
    'new_landholders', new_landholders,
    'linked', linked,
    'skipped', skipped
  );
end
$$;

revoke execute on function public.protect_acceptance() from public, anon;
