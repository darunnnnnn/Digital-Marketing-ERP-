-- Invite links, for people who are not signed in yet.
--
-- The invite page has to show who the invite is for before there is any session
-- to check, so it can't read "Member" directly — row level security blocks that,
-- by design. These two functions are the only anonymous door, and each one is
-- opened by knowing the token and nothing else.
--
-- The raw token never reaches the database: the browser hashes it (SHA-256, same
-- as the old server did) and sends only the hash, so a copy of the database, or
-- of these logs, can't be used to claim an invite.
--
-- Run once against the database, after supabase/policies.sql.

-- All-or-nothing: if anything below fails, neither function is left half-made.
-- A warning that a transaction is already in progress is harmless.
begin;

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

commit;
