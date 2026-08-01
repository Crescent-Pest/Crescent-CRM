-- Sample data for development/demo. Safe to skip in production.
-- Jobs are seeded unassigned since staff profiles depend on real auth users.

insert into public.customers (id, type, first_name, last_name, company_name, email, phone, source) values
  ('11111111-1111-1111-1111-111111111101', 'residential', 'Margaret', 'Holloway', '', 'mholloway@example.com', '843-555-0141', 'referral'),
  ('11111111-1111-1111-1111-111111111102', 'residential', 'Derek', 'Sanford', '', 'dsanford@example.com', '843-555-0177', 'google'),
  ('11111111-1111-1111-1111-111111111103', 'commercial', '', '', 'Palmetto Diner Group', 'ops@palmettodiner.example.com', '843-555-0128', 'walk-in');

insert into public.properties (id, customer_id, label, address_line1, city, state, zip, access_notes) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'Home', '412 Wando Creek Ln', 'Mount Pleasant', 'SC', '29464', 'Gate code 4412, friendly lab in yard'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 'Home', '78 Sycamore Ave', 'Charleston', 'SC', '29407', null),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103', 'Diner - Downtown', '155 King St', 'Charleston', 'SC', '29401', 'Service before 10am open, use rear entrance');

insert into public.service_plans (id, property_id, name, frequency, price_cents, start_date) values
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 'Quarterly Pest Control', 'quarterly', 12900, current_date - interval '90 days'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222203', 'Monthly Commercial Service', 'monthly', 22500, current_date - interval '60 days');

insert into public.jobs (property_id, service_plan_id, title, scheduled_date, window_start, window_end, status) values
  ('22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', 'Quarterly service', current_date + 1, '09:00', '11:00', 'scheduled'),
  ('22222222-2222-2222-2222-222222222202', null, 'Initial inspection', current_date + 2, '13:00', '15:00', 'scheduled'),
  ('22222222-2222-2222-2222-222222222203', '33333333-3333-3333-3333-333333333302', 'Monthly commercial service', current_date - 7, '07:00', '09:00', 'completed');

update public.jobs set completed_at = now() - interval '7 days',
  completion_notes = 'Serviced kitchen and storage. Replaced two bait stations.'
  where status = 'completed';

insert into public.customer_notes (customer_id, body) values
  ('11111111-1111-1111-1111-111111111101', 'Called about ants in kitchen — scheduled follow-up.'),
  ('11111111-1111-1111-1111-111111111103', 'Manager asked for invoice copies going to ops@ email.');
