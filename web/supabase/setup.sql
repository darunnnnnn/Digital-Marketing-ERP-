-- Agency OS — the whole database setup, in one file.
--
-- Run this once in the Supabase SQL editor. It is safe to run again at any
-- time: every statement either replaces what is there or checks first, so
-- re-running it changes nothing and fixes anything half-applied.
--
-- It does four things, in an order that matters:
--
--   1. adds the columns the app expects
--   2. gives the database its own way to fill in ids and timestamps, which
--      Prisma used to do in JavaScript before it was removed
--   3. turns on row level security and installs the permission rules
--   4. adds the two functions the invite page needs
--
-- The whole thing runs as one transaction, so a failure anywhere leaves the
-- database exactly as it was rather than half-configured. A warning that a
-- transaction is already in progress is harmless.

begin;

-- =========================================================================
-- 1. Columns
-- =========================================================================

alter table "ContentItem" add column if not exists "referenceUrl" text;

-- Every role a person holds, for the small-agency case where one person writes,
-- shoots and edits. Empty means "just the one in role", so existing rows need
-- no backfill. role stays the primary one, and is still what authority reads.
alter table "Member" add column if not exists roles text[] not null default '{}';

-- =========================================================================
-- 2. Defaults that Prisma used to supply
-- =========================================================================

alter table "Agency"      alter column id set default gen_random_uuid()::text;
alter table "Client"      alter column id set default gen_random_uuid()::text;
alter table "Member"      alter column id set default gen_random_uuid()::text;
alter table "ContentItem" alter column id set default gen_random_uuid()::text;
alter table "Payout"      alter column id set default gen_random_uuid()::text;
alter table "ContentEvent" alter column id set default gen_random_uuid()::text;

-- "Session" is deliberately excluded: its id is the SHA-256 of a cookie value,
-- supplied on purpose rather than random — and the app's row level security
-- already blocks all access to that table regardless.

-- Same root cause, a second place it bites: @updatedAt was also a Prisma-only
-- behaviour, set in JavaScript rather than stored as a real rule in the
-- database. Prisma set it on insert AND on update, so both halves are needed:
--
--   insert — the column is NOT NULL with no default, so creating a client or a
--            video fails outright with a not-null violation.
--   update — without a trigger the value freezes at creation time forever,
--            which is what "Recent content" sorts by, so that half goes quietly
--            wrong rather than erroring.
--
-- Checked against prisma/migrations rather than guessed: "id" and "updatedAt"
-- are the only NOT NULL columns in the whole schema with no database default.
-- Everything else the app supplies itself on insert.
alter table "Client"      alter column "updatedAt" set default now();
alter table "ContentItem" alter column "updatedAt" set default now();

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists client_set_updated_at on "Client";
create trigger client_set_updated_at
  before update on "Client"
  for each row execute function set_updated_at();

drop trigger if exists content_set_updated_at on "ContentItem";
create trigger content_set_updated_at
  before update on "ContentItem"
  for each row execute function set_updated_at();

-- =========================================================================
-- 3. Row level security
-- =========================================================================

-- The Member row for whoever is signed in, matched by their auth email.
--
-- STABLE so Postgres evaluates it once per statement, not once per row.
-- SECURITY DEFINER matters for a second reason: the function is owned by the
-- role that owns the tables, and a table's owner is exempt from its own row
-- policies. Without that, reading "Member" here would re-trigger the policy on
-- "Member", which needs this function — straight into infinite recursion.
-- Wrapped in a transaction on purpose: if any statement below fails, the whole
-- thing is undone. Without it, a failure partway could leave tables with row
-- level security switched on but no policies attached — which reads as "the app
-- suddenly shows nothing". If your SQL editor says a transaction is already in
-- progress, that warning is harmless.

create or replace function app_member()
returns "Member"
language sql
stable
security definer
set search_path = public
as $$
  select m.* from "Member" m
  where lower(m.email) = lower(auth.jwt() ->> 'email')
    and m.active
  limit 1
$$;

create or replace function app_member_id() returns text
language sql stable security definer set search_path = public as $$
  select (app_member()).id
$$;

create or replace function app_agency_id() returns text
language sql stable security definer set search_path = public as $$
  select (app_member())."agencyId"
$$;

create or replace function app_role() returns text
language sql stable security definer set search_path = public as $$
  select (app_member()).role
$$;

create or replace function app_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select app_role() in ('ceo', 'manager')
$$;

create or replace function app_is_ceo() returns boolean
language sql stable security definer set search_path = public as $$
  select app_role() = 'ceo'
$$;

-- Creative roles only ever see videos they are assigned to.
--
-- Takes the columns one by one rather than a whole row: passing "Table".* into a
-- function expands to a list of arguments, not to a single composite value, so
-- the row form would not match this signature.
create or replace function app_can_see_item(
  p_agency_id text,
  p_scriptwriter_id text,
  p_cameraman_id text,
  p_editor_id text,
  p_publisher_id text
) returns boolean
language sql stable security definer set search_path = public as $$
  select p_agency_id = app_agency_id()
     and (
       app_is_manager()
       or app_member_id() in (
         p_scriptwriter_id, p_cameraman_id, p_editor_id, p_publisher_id
       )
     )
$$;

-- ----------------------------------------------------------------- tables --

alter table "Agency"       enable row level security;
alter table "Client"       enable row level security;
alter table "Member"       enable row level security;
alter table "ContentItem"  enable row level security;
alter table "ContentEvent" enable row level security;
alter table "Payout"       enable row level security;
alter table "Session"      enable row level security;

-- Agency: everyone signed in reads their own; nobody edits it from the app.
drop policy if exists agency_read on "Agency";
create policy agency_read on "Agency" for select
  using (id = app_agency_id());

-- Client: the whole team's work hangs off these, but only managers change them.
drop policy if exists client_read on "Client";
create policy client_read on "Client" for select
  using ("agencyId" = app_agency_id());

drop policy if exists client_write on "Client";
create policy client_write on "Client" for all
  using ("agencyId" = app_agency_id() and app_is_manager())
  with check ("agencyId" = app_agency_id() and app_is_manager());

-- Member: the team is visible to everyone (assignee names appear all over the
-- app), but only the CEO can add people, change roles or deactivate anyone.
drop policy if exists member_read on "Member";
create policy member_read on "Member" for select
  using ("agencyId" = app_agency_id());

drop policy if exists member_write on "Member";
create policy member_write on "Member" for all
  using ("agencyId" = app_agency_id() and app_is_ceo())
  with check ("agencyId" = app_agency_id() and app_is_ceo());

-- Everyone may stamp their own last sign-in, and nothing else about themselves.
-- app_member() reads the row as it was before this statement, so requiring
-- role and roles to match it is how "you may not promote yourself" is expressed.
drop policy if exists member_touch_self on "Member";
create policy member_touch_self on "Member" for update
  using (id = app_member_id())
  with check (
    id = app_member_id()
    and role = app_role()
    and roles = (app_member()).roles
    and "agencyId" = app_agency_id()
  );

-- ContentItem: creatives see and edit only what is assigned to them. Which
-- stage transitions they may make is checked by the trigger below, because a
-- policy alone cannot compare the old stage with the new one.
drop policy if exists content_read on "ContentItem";
create policy content_read on "ContentItem" for select
  using (app_can_see_item(
    "agencyId", "scriptwriterId", "cameramanId", "editorId", "publisherId"
  ));

drop policy if exists content_insert on "ContentItem";
create policy content_insert on "ContentItem" for insert
  with check ("agencyId" = app_agency_id() and app_is_manager());

drop policy if exists content_update on "ContentItem";
create policy content_update on "ContentItem" for update
  using (app_can_see_item(
    "agencyId", "scriptwriterId", "cameramanId", "editorId", "publisherId"
  ))
  with check ("agencyId" = app_agency_id());

drop policy if exists content_delete on "ContentItem";
create policy content_delete on "ContentItem" for delete
  using ("agencyId" = app_agency_id() and app_is_manager());

-- ContentEvent: readable with its video; anyone who can see a video can add a
-- note to it. Never editable or deletable — it is the audit trail, and the way
-- to guarantee that is to grant no policy for update or delete at all.
drop policy if exists event_read on "ContentEvent";
create policy event_read on "ContentEvent" for select
  using (exists (
    select 1 from "ContentItem" c
    where c.id = "ContentEvent"."contentId"
      and app_can_see_item(
        c."agencyId", c."scriptwriterId", c."cameramanId", c."editorId", c."publisherId"
      )
  ));

drop policy if exists event_insert on "ContentEvent";
create policy event_insert on "ContentEvent" for insert
  with check (exists (
    select 1 from "ContentItem" c
    where c.id = "ContentEvent"."contentId"
      and app_can_see_item(
        c."agencyId", c."scriptwriterId", c."cameramanId", c."editorId", c."publisherId"
      )
  ));

-- Payout: money is the CEO's alone, to read and to change.
drop policy if exists payout_all on "Payout";
create policy payout_all on "Payout" for all
  using ("agencyId" = app_agency_id() and app_is_ceo())
  with check ("agencyId" = app_agency_id() and app_is_ceo());

-- Session: left over from the old server-side login. Nobody reads it now.
drop policy if exists session_none on "Session";
create policy session_none on "Session" for select using (false);

-- ------------------------------------------------- stage transition rules --

-- The three CEO gates, and "each person presses only their own button".
-- A policy can see either the old row or the new row, never both, so the
-- comparison lives in a trigger.
create or replace function app_check_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text := app_role();
  me text := app_member_id();
begin
  if new.stage is not distinct from old.stage then
    return new; -- an ordinary edit, not a move
  end if;

  if r = 'ceo' then
    return new; -- the CEO may move anything, including dragging on the board
  end if;

  -- Approving, and sending back from a gate, is the CEO's alone.
  if old.stage in ('script_review', 'footage_review', 'edit_review') then
    raise exception 'Only the CEO can approve at this stage';
  end if;

  if r = 'manager' then
    return new;
  end if;

  -- Creative roles may only move the video off their own step.
  if (old.stage = 'scripting'  and old."scriptwriterId" = me)
  or (old.stage = 'shooting'   and old."cameramanId"    = me)
  or (old.stage = 'editing'    and old."editorId"       = me)
  or (old.stage = 'ready'      and old."publisherId"    = me) then
    return new;
  end if;

  raise exception 'You cannot move this video from %', old.stage;
end;
$$;

drop trigger if exists content_stage_guard on "ContentItem";
create trigger content_stage_guard
  before update on "ContentItem"
  for each row execute function app_check_stage_change();

-- Assignments and deadlines are managers' decisions.
create or replace function app_check_content_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if app_is_manager() then
    return new;
  end if;

  if new."scriptwriterId" is distinct from old."scriptwriterId"
  or new."cameramanId"    is distinct from old."cameramanId"
  or new."editorId"       is distinct from old."editorId"
  or new."publisherId"    is distinct from old."publisherId" then
    raise exception 'Only the CEO or a manager can assign people';
  end if;

  if new."scriptDue"         is distinct from old."scriptDue"
  or new."scriptApprovalDue" is distinct from old."scriptApprovalDue"
  or new."shootDue"          is distinct from old."shootDue"
  or new."editDue"           is distinct from old."editDue"
  or new."finalApprovalDue"  is distinct from old."finalApprovalDue"
  or new."publishDue"        is distinct from old."publishDue" then
    raise exception 'Only the CEO or a manager can change deadlines';
  end if;

  return new;
end;
$$;

drop trigger if exists content_field_guard on "ContentItem";
create trigger content_field_guard
  before update on "ContentItem"
  for each row execute function app_check_content_fields();

-- =========================================================================
-- 4. Invite links
-- =========================================================================

-- Who an invite is for. Returns nothing at all for a token that is wrong,
-- expired, already used, or belongs to a deactivated person — one answer for
-- every kind of failure, so this can't be used to fish for valid tokens.
create or replace function app_invite(token_hash text)
returns table (name text, email text, role text, agency text)
language sql
stable
security definer
set search_path = public
as $$
  select m.name, m.email, m.role, a.name
  from "Member" m
  join "Agency" a on a.id = m."agencyId"
  where m."inviteTokenHash" = token_hash
    and m.active
    and m."inviteExpires" is not null
    and m."inviteExpires" > now()
  limit 1
$$;

-- Spends the invite, once the Supabase Auth account exists. Returns true only
-- if this call was the one that used it, so a replayed link does nothing.
create or replace function app_claim_invite(token_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hit int;
begin
  update "Member"
     set "inviteTokenHash" = null,
         "inviteExpires" = null
   where "inviteTokenHash" = token_hash
     and active
     and "inviteExpires" is not null
     and "inviteExpires" > now();

  get diagnostics hit = row_count;
  return hit > 0;
end;
$$;

-- Both are callable without a session; that is the point of an invite link.
grant execute on function app_invite(text) to anon, authenticated;
grant execute on function app_claim_invite(text) to anon, authenticated;

-- Issuing an invite is a CEO action and goes through the normal policies, so it
-- needs no function of its own: the team page writes "inviteTokenHash" and
-- "inviteExpires" on the Member row like any other field.

-- =========================================================================
-- Tell the API layer to re-read the schema.
-- =========================================================================
--
-- Supabase serves the database through PostgREST, which keeps its own picture
-- of the schema in memory. Without this, a column added above is real in the
-- database but still unknown to the API, and the app fails with "could not
-- find the column ... in the schema cache" until the cache happens to refresh.

notify pgrst, 'reload schema';

commit;
