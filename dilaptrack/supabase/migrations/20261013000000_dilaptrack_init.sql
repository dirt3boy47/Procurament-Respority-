-- DilapTrack — initial schema.
--
-- Tables:      profiles, lots, surveys, defects, reinstatement_items,
--              attachments, audit_log
-- View:        lot_overview (lot + close-out progress, used by the register,
--              dashboard and reports)
-- Storage:     private bucket `lot-files`, organised as
--              <lot>/<pre-construction|post-construction|defects|reinstatement|closeout>/<file>
--
-- Security model (enforced by Row Level Security, not just the UI):
--   admin            everything, incl. user management
--   project_manager  view and manage all records (lots, import, close-out, deletes)
--   site_engineer    view; create/update surveys, defects, reinstatement; upload files
--   read_only        view only
-- New sign-ups are inactive (no access) until an administrator activates them.
-- The very first account created becomes an active administrator.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'project_manager', 'site_engineer', 'read_only');
create type public.lot_status as enum ('not_started', 'in_progress', 'on_hold', 'closed');
create type public.survey_type as enum ('pre_construction', 'post_construction');
create type public.survey_status as enum ('not_started', 'scheduled', 'in_progress', 'complete');
create type public.defect_priority as enum ('low', 'medium', 'high', 'critical');
create type public.defect_status as enum ('open', 'in_progress', 'closed');
create type public.reinstatement_status as enum ('not_started', 'in_progress', 'complete');
create type public.file_category as enum ('pre_construction', 'post_construction', 'defects', 'reinstatement', 'closeout');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null default '',
  full_name  text not null default '',
  role       public.app_role not null default 'read_only',
  active     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Role helpers used by every policy. SECURITY DEFINER so they can read
-- profiles without recursing through its own policies.
create function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active
$$;

create function public.can_view()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.current_app_role() is not null
$$;

create function public.can_edit_records()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('admin', 'project_manager', 'site_engineer'), false)
$$;

create function public.can_manage()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('admin', 'project_manager'), false)
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

-- Create a profile for every new auth user. The first user is the admin.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  is_first boolean;
begin
  lock table public.profiles in share row exclusive mode;
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    case when is_first then 'admin'::public.app_role else 'read_only'::public.app_role end,
    is_first
  );
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only administrators may change roles / activation. Requests made with the
-- service role (no auth.uid()) — e.g. the invite action — are allowed.
create function public.protect_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.active is distinct from old.active
          or new.email is distinct from old.email or new.id is distinct from old.id) then
    raise exception 'Only administrators can change roles or account status' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile();

-- Never leave the project without an active administrator.
create function public.keep_an_admin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where role = 'admin' and active) then
    raise exception 'There must be at least one active administrator' using errcode = '23514';
  end if;
  return null;
end
$$;

create constraint trigger profiles_keep_an_admin
  after update or delete on public.profiles
  deferrable initially immediate
  for each row execute function public.keep_an_admin();

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at / updated_by
-- ---------------------------------------------------------------------------

create function public.set_updated()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end
$$;

-- Chainage as entered ("12+345", "CH 12345.5", "12345") -> metres, for sorting.
create function public.parse_chainage(txt text)
returns numeric
language plpgsql immutable set search_path = ''
as $$
declare
  s text;
  parts text[];
begin
  if txt is null then
    return null;
  end if;
  s := regexp_replace(txt, '[^0-9.+]', '', 'g');
  if s ~ '^\d+(\.\d+)?\+\d+(\.\d+)?$' then
    parts := string_to_array(s, '+');
    return parts[1]::numeric * 1000 + parts[2]::numeric;
  elsif s ~ '^\d+(\.\d+)?$' then
    return s::numeric;
  end if;
  return null;
end
$$;

-- ---------------------------------------------------------------------------
-- Lots
-- ---------------------------------------------------------------------------

create table public.lots (
  id                       uuid primary key default gen_random_uuid(),
  lot_number               text not null check (btrim(lot_number) <> ''),
  address                  text,
  landholder               text,
  landholder_contact       text,
  chainage                 text,
  chainage_m               numeric generated always as (public.parse_chainage(chainage)) stored,
  status                   public.lot_status not null default 'not_started',
  assigned_engineer        text,
  notes                    text,
  -- Close-out: final landholder acceptance of the property's condition.
  landholder_signoff_date  date,
  landholder_signoff_name  text,
  landholder_signoff_notes text,
  closed_at                timestamptz,
  closed_by                uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  created_by               uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles (id) on delete set null
);

-- Lot numbers are unique regardless of case or surrounding spaces.
create unique index lots_lot_number_key on public.lots (lower(lot_number));
create index lots_chainage_idx on public.lots (chainage_m);

create function public.normalise_lot()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.lot_number := btrim(new.lot_number);
  return new;
end
$$;

create trigger lots_normalise before insert or update on public.lots
  for each row execute function public.normalise_lot();
create trigger lots_updated before update on public.lots
  for each row execute function public.set_updated();

-- ---------------------------------------------------------------------------
-- Surveys (exactly one pre- and one post-construction survey per lot)
-- ---------------------------------------------------------------------------

create table public.surveys (
  id           uuid primary key default gen_random_uuid(),
  lot_id       uuid not null references public.lots (id) on delete cascade,
  survey_type  public.survey_type not null,
  status       public.survey_status not null default 'not_started',
  survey_date  date,
  surveyor     text,
  notes        text,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id) on delete set null,
  unique (lot_id, survey_type),
  constraint surveys_complete_needs_details
    check (status <> 'complete' or (survey_date is not null and coalesce(btrim(surveyor), '') <> ''))
);

create trigger surveys_updated before update on public.surveys
  for each row execute function public.set_updated();

create function public.create_lot_surveys()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.surveys (lot_id, survey_type)
  values (new.id, 'pre_construction'), (new.id, 'post_construction');
  return null;
end
$$;

create trigger lots_create_surveys after insert on public.lots
  for each row execute function public.create_lot_surveys();

-- ---------------------------------------------------------------------------
-- Defects
-- ---------------------------------------------------------------------------

create table public.defects (
  id          uuid primary key default gen_random_uuid(),
  ref         bigint generated always as identity,
  lot_id      uuid not null references public.lots (id) on delete cascade,
  description text not null check (btrim(description) <> ''),
  priority    public.defect_priority not null default 'medium',
  status      public.defect_status not null default 'open',
  assigned_to text,
  due_date    date,
  notes       text,
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

create index defects_lot_idx on public.defects (lot_id);
create index defects_status_idx on public.defects (status);

create trigger defects_updated before update on public.defects
  for each row execute function public.set_updated();

-- ---------------------------------------------------------------------------
-- Reinstatement items
-- ---------------------------------------------------------------------------

create table public.reinstatement_items (
  id                       uuid primary key default gen_random_uuid(),
  ref                      bigint generated always as identity,
  lot_id                   uuid not null references public.lots (id) on delete cascade,
  required_works           text not null check (btrim(required_works) <> ''),
  status                   public.reinstatement_status not null default 'not_started',
  completion_date          date,
  landholder_accepted      boolean not null default false,
  landholder_accepted_date date,
  notes                    text,
  created_at               timestamptz not null default now(),
  created_by               uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles (id) on delete set null,
  constraint reinstatement_complete_needs_date
    check (status <> 'complete' or completion_date is not null)
);

create index reinstatement_lot_idx on public.reinstatement_items (lot_id);

create trigger reinstatement_updated before update on public.reinstatement_items
  for each row execute function public.set_updated();

-- ---------------------------------------------------------------------------
-- Attachments (metadata for files in the `lot-files` storage bucket)
-- ---------------------------------------------------------------------------

create table public.attachments (
  id               uuid primary key default gen_random_uuid(),
  lot_id           uuid not null references public.lots (id) on delete cascade,
  category         public.file_category not null,
  survey_id        uuid references public.surveys (id) on delete cascade,
  defect_id        uuid references public.defects (id) on delete cascade,
  reinstatement_id uuid references public.reinstatement_items (id) on delete cascade,
  storage_path     text not null unique,
  preview_path     text,
  file_name        text not null,
  mime_type        text,
  size_bytes       bigint,
  kind             text generated always as (
                     case
                       when mime_type like 'image/%' then 'photo'
                       when mime_type like 'video/%' then 'video'
                       else 'document'
                     end) stored,
  caption          text,
  uploaded_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index attachments_lot_idx on public.attachments (lot_id, category);
create index attachments_defect_idx on public.attachments (defect_id) where defect_id is not null;
create index attachments_reinstatement_idx on public.attachments (reinstatement_id) where reinstatement_id is not null;
create index attachments_survey_idx on public.attachments (survey_id) where survey_id is not null;

-- A file linked to a survey/defect/reinstatement item must belong to the
-- same lot and sit in the matching folder.
create function public.check_attachment_links()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  stype public.survey_type;
begin
  if new.survey_id is not null then
    select s.survey_type into stype from public.surveys s where s.id = new.survey_id and s.lot_id = new.lot_id;
    if stype is null or new.category::text <> stype::text then
      raise exception 'Survey file must be in the matching survey folder of the same lot' using errcode = '23514';
    end if;
  end if;
  if new.defect_id is not null and (new.category <> 'defects'
     or not exists (select 1 from public.defects d where d.id = new.defect_id and d.lot_id = new.lot_id)) then
    raise exception 'Defect photo must be in the Defects folder of the same lot' using errcode = '23514';
  end if;
  if new.reinstatement_id is not null and (new.category <> 'reinstatement'
     or not exists (select 1 from public.reinstatement_items r where r.id = new.reinstatement_id and r.lot_id = new.lot_id)) then
    raise exception 'Reinstatement photo must be in the Reinstatement folder of the same lot' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger attachments_check_links before insert or update on public.attachments
  for each row execute function public.check_attachment_links();

-- ---------------------------------------------------------------------------
-- Lot progress and close-out rules
-- ---------------------------------------------------------------------------

create view public.lot_overview
with (security_invoker = true)
as
select
  l.*,
  coalesce(pre.status, 'not_started')  as pre_survey_status,
  pre.survey_date                      as pre_survey_date,
  coalesce(post.status, 'not_started') as post_survey_status,
  post.survey_date                     as post_survey_date,
  coalesce(d.open_count, 0)            as open_defects,
  coalesce(d.total_count, 0)           as total_defects,
  coalesce(r.open_count, 0)            as open_reinstatement,
  coalesce(r.total_count, 0)           as total_reinstatement,
  coalesce(pre.status = 'complete', false)
    and coalesce(post.status = 'complete', false)
    and coalesce(d.open_count, 0) = 0
    and coalesce(r.open_count, 0) = 0
    and l.landholder_signoff_date is not null as ready_to_close
from public.lots l
left join public.surveys pre  on pre.lot_id = l.id and pre.survey_type = 'pre_construction'
left join public.surveys post on post.lot_id = l.id and post.survey_type = 'post_construction'
left join lateral (
  select count(*) filter (where status <> 'closed')::int as open_count, count(*)::int as total_count
  from public.defects where lot_id = l.id
) d on true
left join lateral (
  select count(*) filter (where status <> 'complete')::int as open_count, count(*)::int as total_count
  from public.reinstatement_items where lot_id = l.id
) r on true;

-- Lists the unmet close-out conditions for a lot (empty = can be closed).
create function public.lot_closeout_blockers(p_lot_id uuid)
returns text[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  blockers text[] := array[]::text[];
  sign_off date;
begin
  select landholder_signoff_date into sign_off from public.lots where id = p_lot_id;
  if not exists (select 1 from public.surveys where lot_id = p_lot_id and survey_type = 'pre_construction' and status = 'complete') then
    blockers := array_append(blockers, 'Pre-construction survey is not complete');
  end if;
  if not exists (select 1 from public.surveys where lot_id = p_lot_id and survey_type = 'post_construction' and status = 'complete') then
    blockers := array_append(blockers, 'Post-construction survey is not complete');
  end if;
  if exists (select 1 from public.defects where lot_id = p_lot_id and status <> 'closed') then
    blockers := array_append(blockers, 'There are open defects');
  end if;
  if exists (select 1 from public.reinstatement_items where lot_id = p_lot_id and status <> 'complete') then
    blockers := array_append(blockers, 'Reinstatement works are not complete');
  end if;
  if sign_off is null then
    blockers := array_append(blockers, 'Landholder acceptance has not been recorded');
  end if;
  return blockers;
end
$$;

create function public.enforce_lot_closeout()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  blockers text[];
begin
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    if tg_op = 'INSERT' then
      raise exception 'A new lot cannot be created as closed' using errcode = '23514';
    end if;
    blockers := public.lot_closeout_blockers(new.id);
    if cardinality(blockers) > 0 then
      raise exception 'Lot % cannot be closed: %', new.lot_number, array_to_string(blockers, '; ')
        using errcode = '23514';
    end if;
    new.closed_at := now();
    new.closed_by := auth.uid();
  elsif new.status <> 'closed' then
    new.closed_at := null;
    new.closed_by := null;
  end if;
  return new;
end
$$;

create trigger lots_enforce_closeout before insert or update on public.lots
  for each row execute function public.enforce_lot_closeout();

-- Records on a closed lot are frozen; reopen the lot to change them.
-- Also moves a lot from "Not started" to "In progress" once work is recorded.
create function public.guard_lot_children()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  lot record;
begin
  select id, lot_number, status into lot from public.lots where id = new.lot_id;
  if lot.status = 'closed' then
    raise exception 'Lot % is closed. Reopen it before changing its records.', lot.lot_number using errcode = '23514';
  end if;
  if lot.status = 'not_started'
     and (tg_table_name <> 'surveys' or to_jsonb(new) ->> 'status' <> 'not_started') then
    update public.lots set status = 'in_progress' where id = lot.id;
  end if;
  return new;
end
$$;

create trigger surveys_guard before update on public.surveys
  for each row execute function public.guard_lot_children();
create trigger defects_guard before insert or update on public.defects
  for each row execute function public.guard_lot_children();
create trigger reinstatement_guard before insert or update on public.reinstatement_items
  for each row execute function public.guard_lot_children();
create trigger attachments_guard before insert or update on public.attachments
  for each row execute function public.guard_lot_children();

-- Deleting a record of a closed lot is refused too. Deletes cascading from a
-- lot being deleted run as nested triggers (depth > 1) and are allowed.
create function public.guard_lot_children_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  lot record;
begin
  if pg_trigger_depth() = 1 then
    select lot_number, status into lot from public.lots where id = old.lot_id;
    if lot.status = 'closed' then
      raise exception 'Lot % is closed. Reopen it before changing its records.', lot.lot_number using errcode = '23514';
    end if;
  end if;
  return old;
end
$$;

create trigger defects_guard_delete before delete on public.defects
  for each row execute function public.guard_lot_children_delete();
create trigger reinstatement_guard_delete before delete on public.reinstatement_items
  for each row execute function public.guard_lot_children_delete();
create trigger attachments_guard_delete before delete on public.attachments
  for each row execute function public.guard_lot_children_delete();

-- Survey / defect completion timestamps.
create function public.stamp_completion()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_table_name = 'surveys' then
    new.completed_at := case when new.status = 'complete' then coalesce(old.completed_at, now()) end;
  elsif tg_table_name = 'defects' then
    if new.status = 'closed' then
      new.closed_at := coalesce(case when tg_op = 'UPDATE' then old.closed_at end, now());
    else
      new.closed_at := null;
    end if;
  end if;
  return new;
end
$$;

create trigger surveys_stamp before update on public.surveys
  for each row execute function public.stamp_completion();
create trigger defects_stamp before insert or update on public.defects
  for each row execute function public.stamp_completion();

-- ---------------------------------------------------------------------------
-- Lot import (all-or-nothing, skips lot numbers that already exist)
-- ---------------------------------------------------------------------------

create function public.import_lots(p_rows jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.can_manage() then
    raise exception 'Only administrators and project managers can import lots' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected an array of lots' using errcode = '22023';
  end if;

  with input as (
    select
      btrim(r ->> 'lot_number')                              as lot_number,
      nullif(btrim(r ->> 'address'), '')                     as address,
      nullif(btrim(r ->> 'landholder'), '')                  as landholder,
      nullif(btrim(r ->> 'landholder_contact'), '')          as landholder_contact,
      nullif(btrim(r ->> 'chainage'), '')                    as chainage,
      coalesce(nullif(btrim(r ->> 'status'), ''), 'not_started')::public.lot_status as status,
      nullif(btrim(r ->> 'assigned_engineer'), '')           as assigned_engineer,
      nullif(btrim(r ->> 'notes'), '')                       as notes
    from jsonb_array_elements(p_rows) r
  ),
  ins as (
    insert into public.lots (lot_number, address, landholder, landholder_contact, chainage, status, assigned_engineer, notes)
    select lot_number, address, landholder, landholder_contact, chainage, status, assigned_engineer, notes
    from input
    where coalesce(lot_number, '') <> ''
    on conflict ((lower(lot_number))) do nothing
    returning lot_number
  )
  select jsonb_build_object(
    'inserted', (select count(*) from ins),
    'skipped', coalesce((
      select jsonb_agg(i.lot_number order by i.lot_number)
      from input i
      where not exists (select 1 from ins where lower(ins.lot_number) = lower(i.lot_number))
    ), '[]'::jsonb)
  ) into result;

  return result;
end
$$;

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id             bigint generated always as identity primary key,
  table_name     text not null,
  record_id      uuid,
  lot_id         uuid,           -- no FK: history outlives deleted lots
  action         text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields text[],
  old_data       jsonb,
  new_data       jsonb,
  actor_id       uuid,
  actor_name     text,
  created_at     timestamptz not null default now()
);

create index audit_log_lot_idx on public.audit_log (lot_id, created_at desc);
create index audit_log_created_idx on public.audit_log (created_at desc);

create function public.audit_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  ignored constant text[] := array['updated_at', 'updated_by', 'chainage_m', 'kind', 'completed_at', 'closed_at'];
  old_j jsonb;
  new_j jsonb;
  full_j jsonb;
  fields text[];
  actor uuid := auth.uid();
begin
  if tg_op in ('UPDATE', 'DELETE') then old_j := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then new_j := to_jsonb(new); end if;
  full_j := coalesce(new_j, old_j);

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into fields
    from jsonb_each(new_j) n
    where n.value is distinct from old_j -> n.key and n.key <> all (ignored);
    if fields is null then
      return null;  -- nothing meaningful changed
    end if;
    select jsonb_object_agg(k, old_j -> k), jsonb_object_agg(k, new_j -> k)
      into old_j, new_j
    from unnest(fields) k;
  end if;

  insert into public.audit_log (table_name, record_id, lot_id, action, changed_fields, old_data, new_data, actor_id, actor_name)
  values (
    tg_table_name,
    (full_j ->> 'id')::uuid,
    case when tg_table_name = 'lots' then (full_j ->> 'id')::uuid else (full_j ->> 'lot_id')::uuid end,
    tg_op,
    fields,
    old_j,
    new_j,
    actor,
    (select nullif(p.full_name, '') from public.profiles p where p.id = actor)
  );
  return null;
end
$$;

create trigger lots_audit after insert or update or delete on public.lots
  for each row execute function public.audit_change();
create trigger surveys_audit after update on public.surveys
  for each row execute function public.audit_change();
create trigger defects_audit after insert or update or delete on public.defects
  for each row execute function public.audit_change();
create trigger reinstatement_audit after insert or update or delete on public.reinstatement_items
  for each row execute function public.audit_change();
create trigger attachments_audit after insert or update or delete on public.attachments
  for each row execute function public.audit_change();
create trigger profiles_audit after update on public.profiles
  for each row execute function public.audit_change();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.lots                enable row level security;
alter table public.surveys             enable row level security;
alter table public.defects             enable row level security;
alter table public.reinstatement_items enable row level security;
alter table public.attachments         enable row level security;
alter table public.audit_log           enable row level security;

-- Profiles: team members see each other; you always see yourself.
create policy "profiles: view" on public.profiles for select to authenticated
  using ((select public.can_view()) or id = (select auth.uid()));
create policy "profiles: update own name or admin" on public.profiles for update to authenticated
  using ((select public.is_admin()) or id = (select auth.uid()))
  with check ((select public.is_admin()) or id = (select auth.uid()));

-- Lots: managers maintain the register.
create policy "lots: view" on public.lots for select to authenticated
  using ((select public.can_view()));
create policy "lots: create" on public.lots for insert to authenticated
  with check ((select public.can_manage()));
create policy "lots: update" on public.lots for update to authenticated
  using ((select public.can_manage())) with check ((select public.can_manage()));
create policy "lots: delete" on public.lots for delete to authenticated
  using ((select public.can_manage()));

-- Surveys: rows are created with the lot; engineers fill them in.
create policy "surveys: view" on public.surveys for select to authenticated
  using ((select public.can_view()));
create policy "surveys: update" on public.surveys for update to authenticated
  using ((select public.can_edit_records())) with check ((select public.can_edit_records()));

-- Defects and reinstatement: engineers create and update; managers delete.
create policy "defects: view" on public.defects for select to authenticated
  using ((select public.can_view()));
create policy "defects: create" on public.defects for insert to authenticated
  with check ((select public.can_edit_records()));
create policy "defects: update" on public.defects for update to authenticated
  using ((select public.can_edit_records())) with check ((select public.can_edit_records()));
create policy "defects: delete" on public.defects for delete to authenticated
  using ((select public.can_manage()));

create policy "reinstatement: view" on public.reinstatement_items for select to authenticated
  using ((select public.can_view()));
create policy "reinstatement: create" on public.reinstatement_items for insert to authenticated
  with check ((select public.can_edit_records()));
create policy "reinstatement: update" on public.reinstatement_items for update to authenticated
  using ((select public.can_edit_records())) with check ((select public.can_edit_records()));
create policy "reinstatement: delete" on public.reinstatement_items for delete to authenticated
  using ((select public.can_manage()));

-- Attachments: engineers upload; uploader or a manager may delete.
create policy "attachments: view" on public.attachments for select to authenticated
  using ((select public.can_view()));
create policy "attachments: create" on public.attachments for insert to authenticated
  with check ((select public.can_edit_records()) and uploaded_by = (select auth.uid()));
create policy "attachments: update caption" on public.attachments for update to authenticated
  using ((select public.can_edit_records())) with check ((select public.can_edit_records()));
create policy "attachments: delete" on public.attachments for delete to authenticated
  using ((select public.can_manage()) or ((select public.can_edit_records()) and uploaded_by = (select auth.uid())));

-- Audit log: read-only for the team; written only by the audit trigger.
create policy "audit: view" on public.audit_log for select to authenticated
  using ((select public.can_view()));

-- ---------------------------------------------------------------------------
-- Grants (anon gets nothing; the audit log is append-only via the trigger)
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.lots, public.surveys, public.defects,
  public.reinstatement_items, public.attachments, public.audit_log, public.lot_overview from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.lots, public.defects, public.reinstatement_items, public.attachments to authenticated;
grant select, update on public.surveys to authenticated;
grant select on public.audit_log, public.lot_overview to authenticated;

revoke execute on function
  public.handle_new_user(), public.protect_profile(), public.keep_an_admin(), public.set_updated(),
  public.normalise_lot(), public.create_lot_surveys(), public.check_attachment_links(),
  public.enforce_lot_closeout(), public.guard_lot_children(), public.guard_lot_children_delete(),
  public.stamp_completion(), public.audit_change(),
  public.import_lots(jsonb), public.lot_closeout_blockers(uuid)
from public, anon;
grant execute on function public.import_lots(jsonb), public.lot_closeout_blockers(uuid) to authenticated;
-- Role helpers are used by policies for signed-in users; anonymous callers don't need them.
revoke execute on function public.current_app_role(), public.can_view(), public.can_edit_records(),
  public.can_manage(), public.is_admin() from public, anon;
grant execute on function public.current_app_role(), public.can_view(), public.can_edit_records(),
  public.can_manage(), public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for photos, videos and documents
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('lot-files', 'lot-files', false)
on conflict (id) do nothing;

create policy "lot-files: view" on storage.objects for select to authenticated
  using (bucket_id = 'lot-files' and (select public.can_view()));
create policy "lot-files: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'lot-files' and (select public.can_edit_records()));
create policy "lot-files: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lot-files'
         and ((select public.can_manage()) or ((select public.can_edit_records()) and owner_id = (select auth.uid())::text)));
