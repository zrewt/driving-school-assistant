-- =====================================================================
-- Initial schema for the AI Missed-Call Assistant
--
-- Tables: schools, school_info, calls, leads, school_users
-- Row Level Security (RLS): a logged-in user can only see rows for the
-- schools they belong to (through school_users). The webhook and cron
-- jobs use the service role key, which bypasses RLS, on the server only.
-- =====================================================================

-- gen_random_uuid() is built into Postgres 13+ (Supabase uses 15+)

-- ---------------------------------------------------------------------
-- Helper: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- E.164 phone format: + then 8 to 15 digits, e.g. +14165550123
-- (used in the CHECK constraints below)

-- ---------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------
create table public.schools (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) > 0),
  -- The number our Retell agent answers on. Calls are matched to a school
  -- by this number. Nullable so a new school can sign up before buying one.
  ai_phone_number  text unique check (ai_phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  admin_phone      text check (admin_phone ~ '^\+[1-9][0-9]{7,14}$'),
  owner_phone      text check (owner_phone ~ '^\+[1-9][0-9]{7,14}$'),
  timezone         text not null default 'America/Toronto',
  -- { "mon": { "closed": false, "open": "09:00", "close": "18:00" }, ... }
  business_hours   jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- school_info (one row per school)
-- ---------------------------------------------------------------------
create table public.school_info (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null unique references public.schools(id) on delete cascade,
  -- [ { "name": "...", "price": 895, "details": "..." } ]
  packages     jsonb not null default '[]'::jsonb,
  -- [ { "question": "...", "answer": "..." } ]
  faqs         jsonb not null default '[]'::jsonb,
  extra_notes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger school_info_set_updated_at
  before update on public.school_info
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- calls (one row per Retell call)
-- ---------------------------------------------------------------------
create table public.calls (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  retell_call_id    text not null unique,   -- idempotency key for the webhook
  from_number       text,
  to_number         text,
  started_at        timestamptz,
  duration_seconds  integer,
  transcript        text,
  recording_url     text,
  summary           text,
  created_at        timestamptz not null default now()
);

create index calls_school_created_idx on public.calls (school_id, created_at desc);

-- ---------------------------------------------------------------------
-- leads (at most one lead per call)
-- ---------------------------------------------------------------------
create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  call_id             uuid unique references public.calls(id) on delete cascade,
  name                text,
  phone               text,
  licence_level       text not null default 'unknown'
                        check (licence_level in ('G1', 'G2', 'G', 'none', 'unknown')),
  package_interest    text,
  preferred_times     text,
  pickup_area         text,
  questions_asked     text,
  needs_owner         boolean not null default false,
  status              text not null default 'new'
                        check (status in ('new', 'called_back', 'booked', 'not_interested')),
  -- Set when the SMS was sent, so a retried webhook never texts twice.
  admin_notified_at   timestamptz,
  caller_notified_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index leads_school_created_idx on public.leads (school_id, created_at desc);
create index leads_school_status_idx  on public.leads (school_id, status);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- school_users (who can see which school)
-- ---------------------------------------------------------------------
create table public.school_users (
  user_id     uuid not null references auth.users(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  role        text not null default 'admin' check (role in ('owner', 'admin')),
  created_at  timestamptz not null default now(),
  primary key (user_id, school_id)
);

create index school_users_school_idx on public.school_users (school_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================

-- Returns true if the logged-in user belongs to the given school.
-- SECURITY DEFINER lets it read school_users without hitting RLS loops.
create or replace function public.is_school_member(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_users
    where school_id = p_school_id and user_id = auth.uid()
  );
$$;

alter table public.schools      enable row level security;
alter table public.school_info  enable row level security;
alter table public.calls        enable row level security;
alter table public.leads        enable row level security;
alter table public.school_users enable row level security;

-- schools: members can read and edit their school
create policy "members read their school" on public.schools
  for select to authenticated using (public.is_school_member(id));
create policy "members update their school" on public.schools
  for update to authenticated
  using (public.is_school_member(id)) with check (public.is_school_member(id));

-- school_info: members can read, create and edit
create policy "members read school info" on public.school_info
  for select to authenticated using (public.is_school_member(school_id));
create policy "members insert school info" on public.school_info
  for insert to authenticated with check (public.is_school_member(school_id));
create policy "members update school info" on public.school_info
  for update to authenticated
  using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));

-- calls: read only (only the webhook, using the service role, writes calls)
create policy "members read calls" on public.calls
  for select to authenticated using (public.is_school_member(school_id));

-- leads: members can read and update (only the status column, see grants below)
create policy "members read leads" on public.leads
  for select to authenticated using (public.is_school_member(school_id));
create policy "members update leads" on public.leads
  for update to authenticated
  using (public.is_school_member(school_id)) with check (public.is_school_member(school_id));

-- school_users: a user can see their own memberships
create policy "users read own memberships" on public.school_users
  for select to authenticated using (user_id = auth.uid());

-- Column-level safety: dashboard users may only change a lead's status.
revoke update on public.leads from authenticated;
grant update (status) on public.leads to authenticated;

-- Anonymous (logged-out) visitors get nothing.
revoke all on public.schools, public.school_info, public.calls, public.leads, public.school_users from anon;

-- =====================================================================
-- create_school: used by the "create your school" form.
-- Creates the school + empty school_info and links the current user as
-- owner, all in one transaction.
-- =====================================================================
create or replace function public.create_school(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in';
  end if;

  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'School name is required';
  end if;

  insert into public.schools (name, business_hours)
  values (
    trim(p_name),
    '{
      "mon": {"closed": false, "open": "09:00", "close": "18:00"},
      "tue": {"closed": false, "open": "09:00", "close": "18:00"},
      "wed": {"closed": false, "open": "09:00", "close": "18:00"},
      "thu": {"closed": false, "open": "09:00", "close": "18:00"},
      "fri": {"closed": false, "open": "09:00", "close": "18:00"},
      "sat": {"closed": false, "open": "10:00", "close": "16:00"},
      "sun": {"closed": true,  "open": "10:00", "close": "16:00"}
    }'::jsonb
  )
  returning id into v_school_id;

  insert into public.school_info (school_id) values (v_school_id);

  insert into public.school_users (user_id, school_id, role)
  values (auth.uid(), v_school_id, 'owner');

  return v_school_id;
end;
$$;

revoke all on function public.create_school(text) from public, anon;
grant execute on function public.create_school(text) to authenticated;
