-- =====================================================================
-- Explicit table permissions (GRANTs)
--
-- Newer Supabase projects do NOT automatically give the API roles access
-- to tables created in the SQL editor. Without these grants you get:
--   "permission denied for table school_users"
--
-- Two layers protect the data:
--   1. GRANTs (this file): which kinds of action a role may attempt at all.
--   2. Row Level Security policies (first migration): which ROWS it may touch.
--
-- Safe to run more than once.
-- =====================================================================

grant usage on schema public to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Logged-in dashboard users (role: authenticated). RLS still limits
-- every one of these to the schools the user belongs to.
-- ---------------------------------------------------------------------
grant select         on public.school_users to authenticated;
grant select, update on public.schools      to authenticated;
grant select, insert, update on public.school_info to authenticated;
grant select         on public.calls        to authenticated;
grant select         on public.leads        to authenticated;

-- Dashboard users may change ONLY a lead's status column.
revoke update on public.leads from authenticated;
grant update (status) on public.leads to authenticated;

-- Functions used by RLS policies and the "create your school" form.
grant execute on function public.is_school_member(uuid) to authenticated;
grant execute on function public.create_school(text)    to authenticated;

-- ---------------------------------------------------------------------
-- Server-only role used by the Retell webhook and the weekly cron job.
-- It skips RLS, but it still needs table permissions.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on
  public.schools, public.school_info, public.calls, public.leads, public.school_users
  to service_role;

-- Logged-out visitors (role: anon) get nothing.
revoke all on
  public.schools, public.school_info, public.calls, public.leads, public.school_users
  from anon;
