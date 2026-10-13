-- Minimal data for local development (`npx supabase db reset`). Not used in production.
-- For a fuller set with photos and documents, sign in as an administrator and use
-- Users -> Demo data -> Load demo data.
insert into public.landholders (name, phone, email) values
  ('J & K Smith', '0400 111 222', null),
  ('Example Holdings Pty Ltd', null, 'property@example.com'),
  ('M Patel', '0400 333 444', null),
  ('Ridge Farming Co', '07 5555 0000', 'office@ridgefarming.example'),
  ('TRC (Regional Council) - Roads', '07 5555 1000', 'roads@trc.example'),
  ('P & R Walsh', '0400 555 666', null),
  ('Emma Clarke', null, 'emma.clarke@example.com');

insert into public.lots (lot_number, address, chainage, assigned_engineer, notes)
select v.lot_number, v.address, v.chainage, v.engineer, v.notes
from (values
  ('LOT-001', '12 Riverside Drive, Example', 'J & K Smith', '0+120', 'Alex Nguyen', 'Dog on property - call ahead.'),
  ('LOT-002', '14 Riverside Drive, Example', 'Example Holdings Pty Ltd', '0+310', 'Alex Nguyen', null),
  ('LOT-003', '2 Quarry Road, Example', 'M Patel', '0+760', 'Sam Taylor', null),
  ('LOT-004', 'Rural lot, Ridge Road', 'Ridge Farming Co', '1+880', 'Alex Nguyen', 'Livestock - close all gates.'),
  ('LOT-005', 'Rural lot, Ridge Road (east)', 'Ridge Farming Co', '2+450', null, null),
  ('SL04', 'Station Street road reserve and frontages', null, '3+100', 'Sam Taylor', 'Works in TRC road reserve.')
) as v(lot_number, address, owner, chainage, engineer, notes);

-- Each lot's landholders. SL04 is a street section: the council owns the road
-- reserve, with residences alongside; only damaged properties need written acceptance.
insert into public.lot_landholders (lot_id, landholder_id, role, property, restoration_required, damage_notes)
select l.id, h.id, v.role::public.landholder_role, v.property, v.damage is not null, v.damage
from (values
  ('LOT-001', 'J & K Smith', 'owner', null, null),
  ('LOT-002', 'Example Holdings Pty Ltd', 'owner', null, 'Fence post replaced.'),
  ('LOT-003', 'M Patel', 'owner', null, null),
  ('LOT-004', 'Ridge Farming Co', 'owner', null, null),
  ('LOT-005', 'Ridge Farming Co', 'owner', null, null),
  ('SL04', 'TRC (Regional Council) - Roads', 'road_authority', 'Station Street road reserve', null),
  ('SL04', 'P & R Walsh', 'adjacent_resident', '2 Station Street', 'Front fence panel struck by plant - replaced.'),
  ('SL04', 'Emma Clarke', 'adjacent_resident', '4 Station Street', null)
) as v(lot_number, owner, role, property, damage)
join public.lots l on l.lot_number = v.lot_number
join public.landholders h on h.name = v.owner;

update public.surveys s set status = 'complete', survey_date = current_date - 120, surveyor = 'Alex Nguyen',
  notes = 'Minor existing cracking to driveway. Fences in fair condition.'
from public.lots l where l.id = s.lot_id and s.survey_type = 'pre_construction' and l.lot_number in ('LOT-001', 'LOT-002', 'LOT-004');

update public.surveys s set status = 'scheduled', survey_date = current_date + 7, surveyor = 'Sam Taylor'
from public.lots l where l.id = s.lot_id and s.survey_type = 'pre_construction' and l.lot_number = 'LOT-003';

update public.surveys s set status = 'complete', survey_date = current_date - 10, surveyor = 'Alex Nguyen',
  notes = 'No new damage observed.'
from public.lots l where l.id = s.lot_id and s.survey_type = 'post_construction' and l.lot_number in ('LOT-001', 'LOT-002');

update public.lot_landholders x set acceptance_date = current_date - 1, acceptance_name = 'Example Holdings Pty Ltd'
from public.lots l where l.id = x.lot_id and l.lot_number = 'LOT-002';
