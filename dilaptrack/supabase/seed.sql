-- Demo data for local development (`npx supabase db reset`). Not used in production.
insert into public.lots (lot_number, address, landholder, landholder_contact, chainage, assigned_engineer, notes) values
  ('LOT-001', '12 Riverside Drive, Example', 'J & K Smith', '0400 111 222', '0+120', 'Alex Nguyen', 'Dog on property - call ahead.'),
  ('LOT-002', '14 Riverside Drive, Example', 'Example Holdings Pty Ltd', 'property@example.com', '0+310', 'Alex Nguyen', null),
  ('LOT-003', '2 Quarry Road, Example', 'M Patel', '0400 333 444', '0+760', 'Sam Taylor', 'Shared driveway with LOT-004.'),
  ('LOT-004', '4 Quarry Road, Example', 'R Jones', null, '1+020', 'Sam Taylor', null),
  ('LOT-005', 'Rural lot, Ridge Road', 'Ridge Farming Co', '07 5555 0000', '1+880', 'Alex Nguyen', 'Livestock - close all gates.'),
  ('LOT-006', 'Rural lot, Ridge Road (east)', 'Ridge Farming Co', '07 5555 0000', '2+450', null, null);

update public.surveys s set status = 'complete', survey_date = current_date - 120, surveyor = 'Alex Nguyen',
  notes = 'Minor existing cracking to driveway. Fences in fair condition.'
from public.lots l where l.id = s.lot_id and s.survey_type = 'pre_construction' and l.lot_number in ('LOT-001', 'LOT-002', 'LOT-003', 'LOT-005');

update public.surveys s set status = 'scheduled', survey_date = current_date + 7, surveyor = 'Sam Taylor'
from public.lots l where l.id = s.lot_id and s.survey_type = 'pre_construction' and l.lot_number = 'LOT-004';

update public.surveys s set status = 'complete', survey_date = current_date - 10, surveyor = 'Alex Nguyen',
  notes = 'New crack observed in driveway near gate.'
from public.lots l where l.id = s.lot_id and s.survey_type = 'post_construction' and l.lot_number in ('LOT-001', 'LOT-002');

insert into public.defects (lot_id, description, priority, status, assigned_to, due_date)
select id, 'New crack in driveway slab near front gate (approx. 1.2 m)', 'high', 'open', 'Civil subcontractor', current_date + 14
from public.lots where lot_number = 'LOT-001';
insert into public.defects (lot_id, description, priority, status, assigned_to, due_date)
select id, 'Boundary fence post leaning after excavation', 'medium', 'closed', 'Alex Nguyen', current_date - 5
from public.lots where lot_number = 'LOT-002';

insert into public.reinstatement_items (lot_id, required_works, status, completion_date, landholder_accepted, landholder_accepted_date)
select id, 'Replace 2 fence posts and re-tension wire along northern boundary', 'complete', current_date - 3, true, current_date - 2
from public.lots where lot_number = 'LOT-002';
insert into public.reinstatement_items (lot_id, required_works, status)
select id, 'Topsoil and reseed 150 m2 of disturbed pasture', 'in_progress'
from public.lots where lot_number = 'LOT-005';

update public.lots set landholder_signoff_date = current_date - 1, landholder_signoff_name = 'Example Holdings Pty Ltd'
where lot_number = 'LOT-002';
