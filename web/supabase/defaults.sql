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
