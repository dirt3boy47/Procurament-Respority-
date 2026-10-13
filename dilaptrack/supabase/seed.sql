-- Minimal data for local development (`npx supabase db reset`). Not used in production.
-- For a fuller set with photos and documents, sign in as an administrator and use
-- Users -> Demo data -> Load demo data.
insert into public.landholders (name, phone, email) values
  ('J & K Smith', '0400 111 222', null),
  ('Example Holdings Pty Ltd', null, 'property@example.com'),
  ('M Patel', '0400 333 444', null),
  ('Ridge Farming Co', '07 5555 0000', 'office@ridgefarming.example');

insert into public.lots (lot_number, address, landholder_id, chainage, assigned_engineer, notes)
select v.lot_number, v.address, h.id, v.chainage, v.engineer, v.notes
from (values
  ('LOT-001', '12 Riverside Drive, Example', 'J & K Smith', '0+120', 'Alex Nguyen', 'Dog on property - call ahead.'),
  ('LOT-002', '14 Riverside Drive, Example', 'Example Holdings Pty Ltd', '0+310', 'Alex Nguyen', null),
  ('LOT-003', '2 Quarry Road, Example', 'M Patel', '0+760', 'Sam Taylor', null),
  ('LOT-004', 'Rural lot, Ridge Road', 'Ridge Farming Co', '1+880', 'Alex Nguyen', 'Livestock - close all gates.'),
  ('LOT-005', 'Rural lot, Ridge Road (east)', 'Ridge Farming Co', '2+450', null, null)
) as v(lot_number, address, owner, chainage, engineer, notes)
left join public.landholders h on h.name = v.owner;

update public.surveys s set status = 'complete', survey_date = current_date - 120, surveyor = 'Alex Nguyen',
  notes = 'Minor existing cracking to driveway. Fences in fair condition.'
from public.lots l where l.id = s.lot_id and s.survey_type = 'pre_construction' and l.lot_number in ('LOT-001', 'LOT-002', 'LOT-004');

update public.surveys s set status = 'scheduled', survey_date = current_date + 7, surveyor = 'Sam Taylor'
from public.lots l where l.id = s.lot_id and s.survey_type = 'pre_construction' and l.lot_number = 'LOT-003';

update public.surveys s set status = 'complete', survey_date = current_date - 10, surveyor = 'Alex Nguyen',
  notes = 'No new damage observed.'
from public.lots l where l.id = s.lot_id and s.survey_type = 'post_construction' and l.lot_number in ('LOT-001', 'LOT-002');

update public.lots set landholder_signoff_date = current_date - 1, landholder_signoff_name = 'Example Holdings Pty Ltd'
where lot_number = 'LOT-002';
