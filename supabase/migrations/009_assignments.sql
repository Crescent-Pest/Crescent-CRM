-- Crescent CRM — assignable follow-ups
--
-- NOT YET APPLIED to the live Supabase project. Run this ONCE in the SQL
-- editor of the shared Crescent project, after 006_visit_notes.sql. Until it
-- is applied the app keeps working off tech_id (assignment queries fall back).
--
-- action_items.tech_id keeps meaning "who recorded the note"; assigned_to is
-- who has to do the work. Existing rows are backfilled to tech_id so nothing
-- disappears from anyone's list.
--
-- RLS: 006's action_items policies gate insert/update on
-- public.is_active_staff() with no per-row owner check, so any active staff
-- member can already create or edit an item assigned to someone else. No
-- policy change is needed here.

alter table public.action_items
  add column assigned_to uuid references public.profiles (id);

update public.action_items set assigned_to = tech_id;

create index action_items_assigned_idx
  on public.action_items (assigned_to, status);
