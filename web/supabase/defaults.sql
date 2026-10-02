-- Fixes "null value in column id violates not-null constraint".
--
-- The old app used Prisma, which generated each row's id in JavaScript before
-- saving — cuid(), a function with no equivalent inside Postgres itself. Prisma
-- is gone, so nothing generates an id anymore, and every insert from the new
-- app leaves it blank. These tables never had their own way to make one.
--
-- gen_random_uuid() is built into Postgres itself (13+, no extension needed)
-- and now generates the id automatically on every insert, the same way it
-- always should have at the database level. The ::text cast matches the
-- existing column type, so nothing else about these tables changes.
--
-- Safe to run more than once.

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
-- behaviour, set in JavaScript on every update rather than stored as a real
-- rule in the database. Without it, "updatedAt" silently freezes at creation
-- time forever once Prisma stops touching these rows — which is what feeds
-- "Recent content" on the client page, so the order would quietly go wrong
-- rather than error, hours or weeks from now. Fixed the same way the id was:
-- a database-level rule standing in for what Prisma used to do in code.
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
