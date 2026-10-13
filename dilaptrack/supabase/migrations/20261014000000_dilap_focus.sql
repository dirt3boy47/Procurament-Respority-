-- DilapTrack: focus on dilapidation surveys.
--
--   * Removes the defects and reinstatement registers (tables, triggers, file folders).
--   * Adds a landholder (landowner) registry; each lot links to a landholder.
--     Existing free-text landholder names/contacts on lots are moved into the registry.
--   * Close-out now needs: pre-construction survey complete, post-construction
--     survey complete, and landholder acceptance recorded.

-- ---------------------------------------------------------------------------
-- Remove defects and reinstatement
-- ---------------------------------------------------------------------------

drop view public.lot_overview;

-- Files that belonged to defects / reinstatement items (rows only; the storage
-- objects are left in place under <lot>/defects and <lot>/reinstatement).
delete from public.attachments where category in ('defects', 'reinstatement');
alter table public.attachments drop column defect_id, drop column reinstatement_id;

drop table public.defects;
drop table public.reinstatement_items;
drop type public.defect_priority;
drop type public.defect_status;
drop type public.reinstatement_status;

-- File folders are now Pre-Construction, Post-Construction and Closeout.
alter table public.attachments alter column category type text;
drop type public.file_category;
create type public.file_category as enum ('pre_construction', 'post_construction', 'closeout');
alter table public.attachments
  alter column category type public.file_category using category::public.file_category;

create or replace function public.check_attachment_links()
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
  return new;
end
$$;

-- Completion timestamp for surveys only now.
create or replace function public.stamp_completion()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.completed_at := case when new.status = 'complete' then coalesce(old.completed_at, now()) end;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Landholder registry
-- ---------------------------------------------------------------------------

create table public.landholders (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (btrim(name) <> ''),
  phone          text,
  email          text,
  postal_address text,
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id) on delete set null
);

-- One entry per landholder name (ignoring case and surrounding spaces).
create unique index landholders_name_key on public.landholders (lower(name));

create function public.normalise_landholder()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  return new;
end
$$;

create trigger landholders_normalise before insert or update on public.landholders
  for each row execute function public.normalise_landholder();
create trigger landholders_updated before update on public.landholders
  for each row execute function public.set_updated();
create trigger landholders_audit after insert or update or delete on public.landholders
  for each row execute function public.audit_change();

alter table public.landholders enable row level security;

create policy "landholders: view" on public.landholders for select to authenticated
  using ((select public.can_view()));
create policy "landholders: create" on public.landholders for insert to authenticated
  with check ((select public.can_edit_records()));
create policy "landholders: update" on public.landholders for update to authenticated
  using ((select public.can_edit_records())) with check ((select public.can_edit_records()));
create policy "landholders: delete" on public.landholders for delete to authenticated
  using ((select public.can_manage()));

revoke all on public.landholders from anon, authenticated;
grant select, insert, update, delete on public.landholders to authenticated;

-- Move existing free-text landholders on lots into the registry.
alter table public.lots add column landholder_id uuid references public.landholders (id) on delete restrict;
create index lots_landholder_idx on public.lots (landholder_id);

insert into public.landholders (name, phone, email)
select distinct on (lower(btrim(regexp_replace(landholder, '\s+', ' ', 'g'))))
  landholder,
  case when landholder_contact !~ '@' then nullif(btrim(landholder_contact), '') end,
  case when landholder_contact ~ '@' then btrim(landholder_contact) end
from public.lots
where coalesce(btrim(landholder), '') <> ''
order by lower(btrim(regexp_replace(landholder, '\s+', ' ', 'g'))), updated_at desc, lot_number
on conflict do nothing;

update public.lots l set landholder_id = h.id
from public.landholders h
where lower(btrim(regexp_replace(l.landholder, '\s+', ' ', 'g'))) = lower(h.name);

alter table public.lots drop column landholder, drop column landholder_contact;

-- ---------------------------------------------------------------------------
-- Lot progress and close-out
-- ---------------------------------------------------------------------------

create view public.lot_overview
with (security_invoker = true)
as
select
  l.*,
  h.name                               as landholder_name,
  h.phone                              as landholder_phone,
  h.email                              as landholder_email,
  coalesce(pre.status, 'not_started')  as pre_survey_status,
  pre.survey_date                      as pre_survey_date,
  pre.surveyor                         as pre_surveyor,
  coalesce(post.status, 'not_started') as post_survey_status,
  post.survey_date                     as post_survey_date,
  post.surveyor                        as post_surveyor,
  coalesce(f.file_count, 0)            as file_count,
  coalesce(pre.status = 'complete', false)
    and coalesce(post.status = 'complete', false)
    and l.landholder_signoff_date is not null as ready_to_close
from public.lots l
left join public.landholders h on h.id = l.landholder_id
left join public.surveys pre  on pre.lot_id = l.id and pre.survey_type = 'pre_construction'
left join public.surveys post on post.lot_id = l.id and post.survey_type = 'post_construction'
left join lateral (
  select count(*)::int as file_count from public.attachments a where a.lot_id = l.id
) f on true;

revoke all on public.lot_overview from anon, authenticated;
grant select on public.lot_overview to authenticated;

create or replace function public.lot_closeout_blockers(p_lot_id uuid)
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
  if sign_off is null then
    blockers := array_append(blockers, 'Landholder acceptance has not been recorded');
  end if;
  return blockers;
end
$$;

-- ---------------------------------------------------------------------------
-- Lot import: landholders are matched by name, or added to the registry
-- ---------------------------------------------------------------------------

drop function public.import_lots(jsonb);

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
      btrim(r ->> 'lot_number')                                                              as lot_number,
      nullif(btrim(r ->> 'address'), '')                                                     as address,
      nullif(btrim(regexp_replace(coalesce(r ->> 'landholder', ''), '\s+', ' ', 'g')), '')   as landholder,
      nullif(btrim(r ->> 'landholder_contact'), '')                                          as landholder_contact,
      nullif(btrim(r ->> 'chainage'), '')                                                    as chainage,
      coalesce(nullif(btrim(r ->> 'status'), ''), 'not_started')::public.lot_status          as status,
      nullif(btrim(r ->> 'assigned_engineer'), '')                                           as assigned_engineer,
      nullif(btrim(r ->> 'notes'), '')                                                       as notes
    from jsonb_array_elements(p_rows) r
  ),
  -- Landholders not yet in the registry (the first contact given for each name wins).
  new_landholders as (
    insert into public.landholders (name, phone, email)
    select distinct on (lower(landholder))
      landholder,
      case when landholder_contact !~ '@' then landholder_contact end,
      case when landholder_contact ~ '@' then landholder_contact end
    from input
    where landholder is not null
    order by lower(landholder)
    on conflict ((lower(name))) do nothing
    returning id, name
  ),
  all_landholders as (
    select id, name from public.landholders
    union all
    select id, name from new_landholders
  ),
  ins as (
    insert into public.lots (lot_number, address, landholder_id, chainage, status, assigned_engineer, notes)
    select i.lot_number, i.address, h.id, i.chainage, i.status, i.assigned_engineer, i.notes
    from input i
    left join all_landholders h on lower(h.name) = lower(i.landholder)
    where coalesce(i.lot_number, '') <> ''
    on conflict ((lower(lot_number))) do nothing
    returning lot_number
  )
  select jsonb_build_object(
    'inserted', (select count(*) from ins),
    'new_landholders', (select count(*) from new_landholders),
    'skipped', coalesce((
      select jsonb_agg(i.lot_number order by i.lot_number)
      from input i
      where not exists (select 1 from ins where lower(ins.lot_number) = lower(i.lot_number))
    ), '[]'::jsonb)
  ) into result;

  return result;
end
$$;

revoke execute on function public.import_lots(jsonb) from public, anon;
grant execute on function public.import_lots(jsonb) to authenticated;
revoke execute on function public.normalise_landholder() from public, anon;
