// Checks supabase/setup.sql before anyone runs it on the real database.
//
//   npm run verify:db
//
// PGlite is Postgres itself compiled to WebAssembly, so this is the real engine
// — real DDL, real triggers, real row level security — with nothing to install
// beyond npm and nothing left running afterwards.
//
// It loads the production schema from prisma/migrations, applies setup.sql
// twice (it is advertised as safe to re-run), then makes every insert the app
// makes, with no id and no updatedAt, exactly as the app sends them.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// Paths are relative to this file, so it runs from anywhere.
const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");

const db = new PGlite();
let failed = false;

async function step(label, sql) {
  try {
    await db.exec(sql);
    console.log(`PASS  ${label}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL  ${label}`);
    console.log(`      ${String(e.message).split("\n")[0]}`);
  }
}

// Supabase supplies these; a bare Postgres needs stand-ins.
await step("stand-ins for what Supabase provides", `
  create schema if not exists auth;
  create or replace function auth.jwt() returns jsonb
    language sql stable as $fn$
      select current_setting('request.jwt.claims', true)::jsonb
    $fn$;
  create role anon nologin;
  create role authenticated nologin;
`);

// The real production schema, straight from the migrations that built it.
await step(
  "load the real schema from prisma/migrations",
  read("../../prisma/migrations/20260926063511_init/migration.sql") +
    read("../../prisma/migrations/20260926144318_add_monthly_post_target/migration.sql"),
);

// The file the user is about to run.
await step("apply supabase/setup.sql", read("setup.sql"));

// And again — it is advertised as safe to re-run.
await step("apply supabase/setup.sql a SECOND time", read("setup.sql"));

// Every insert the app actually makes, with no id and no updatedAt.
const inserts = [
  ["create an agency", `insert into "Agency"(name, slug) values ('Crownx','crownx')`],
  [
    "create a client",
    `insert into "Client"("agencyId", name, "monthlyTarget", retainer, services)
     select id, 'Enhance', 10, 25000, 'Reels' from "Agency" limit 1`,
  ],
  [
    "invite a cameraman",
    `insert into "Member"("agencyId", name, role, email)
     select id, 'Rahul', 'cameraman', 'rahul@x.com' from "Agency" limit 1`,
  ],
  [
    "plan a video (with referenceUrl)",
    `insert into "ContentItem"("agencyId","clientId",ref,title,"monthKey","referenceUrl")
     select a.id, c.id, 1, 'Test video', '2026-10', 'https://example.com/r'
     from "Agency" a, "Client" c limit 1`,
  ],
  [
    "log an activity event",
    `insert into "ContentEvent"("contentId", kind, message)
     select id, 'note', 'hello' from "ContentItem" limit 1`,
  ],
  [
    "approve a payout",
    `insert into "Payout"("agencyId","memberId","monthKey","payType",deliveries,rate,salary,amount)
     select a.id, m.id, '2026-10', 'per_task', 3, 500, 0, 1500
     from "Agency" a, "Member" m limit 1`,
  ],
];
for (const [label, sql] of inserts) await step(label, sql);

// Checks that need a result, not just an absence of errors.
async function expect(label, sql, want) {
  try {
    const { rows } = await db.query(sql);
    const got = Object.values(rows[0])[0];
    const ok = String(got) === String(want);
    if (!ok) failed = true;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${got}, want ${want})`}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL  ${label}\n      ${String(e.message).split("\n")[0]}`);
  }
}

await expect("every row got a real id", `select count(*) from "Client" where id is null or id = ''`, 0);
await expect("referenceUrl column exists and stored", `select count(*) from "ContentItem" where "referenceUrl" is not null`, 1);
await expect("row level security is on", `select count(*) from pg_tables where schemaname='public' and rowsecurity = false`, 0);
await expect("policies installed", `select count(*) > 10 from pg_policies where schemaname='public'`, true);

// updatedAt must advance on update, not sit at creation time.
await db.exec(`create temp table t as select "updatedAt" as before from "Client" limit 1`);
await db.exec(`update "Client" set name = 'Enhance Media'`);
await expect(
  "updatedAt advances on update",
  `select (select "updatedAt" from "Client" limit 1) > (select before from t)`,
  true,
);

// ---- voice over: the new columns, and what the voice over person may do ------
await expect(
  "the voice over foreign key is named the way PostgREST will look for it",
  `select count(*) from pg_constraint where conname = 'ContentItem_voiceoverId_fkey'`,
  1,
);
await expect(
  "the old five-argument visibility function is gone",
  `select count(*) from pg_proc where proname = 'app_can_see_item' and pronargs = 5`,
  0,
);
await expect(
  "a new video needs a shoot and no voice over until someone says otherwise",
  `select "shootNeeded" and not "voNeeded" from "ContentItem" limit 1`,
  true,
);

await db.exec(`
  insert into "Member"("agencyId", name, role, email)
    select id, 'Priya', 'voiceover', 'priya@x.com' from "Agency" limit 1;
  insert into "Member"("agencyId", name, role, email)
    select id, 'Sanjo', 'editor', 'sanjo@x.com' from "Agency" limit 1;
  -- Fixture only: no one is signed in here, so the guards would refuse it.
  alter table "ContentItem" disable trigger user;
  update "ContentItem" set stage = 'shooting', "voNeeded" = true,
    "voiceoverId" = (select id from "Member" where email = 'priya@x.com');
  alter table "ContentItem" enable trigger user;
  grant usage on schema public to authenticated;
  grant select, update on all tables in schema public to authenticated;
`);

async function as(email, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"email":"${email}"}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec(`reset role`);
  }
}
async function asFails(label, email, sql, fragment) {
  try {
    await as(email, sql);
    failed = true;
    console.log(`FAIL  ${label}  (it was allowed)`);
  } catch (e) {
    const ok = String(e.message).includes(fragment);
    if (!ok) failed = true;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${String(e.message).split("\n")[0]})`}`);
  }
}

await expect(
  "the voice over person sees the video they are assigned",
  `select count(*) from "ContentItem"`,
  1,
); // run as the superuser: baseline, so the next lines mean something
{
  const seen = (await as("priya@x.com", `select count(*)::int as n from "ContentItem"`)).rows[0].n;
  const ok = seen === 1;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  the voice over person can open their video${ok ? "" : `  (sees ${seen})`}`);
}
{
  const seen = (await as("sanjo@x.com", `select count(*)::int as n from "ContentItem"`)).rows[0].n;
  const ok = seen === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  an editor not on that video cannot${ok ? "" : `  (sees ${seen})`}`);
}
await asFails(
  "the voice over person cannot assign themselves to other work",
  "priya@x.com",
  `update "ContentItem" set "voiceoverId" = (select id from "Member" where email = 'sanjo@x.com')`,
  "Only the CEO or a manager can assign people",
);
await asFails(
  "the voice over person cannot decide a shoot is not needed",
  "priya@x.com",
  `update "ContentItem" set "shootNeeded" = false`,
  "Only the CEO or a manager can decide whether a shoot is needed",
);
await as(
  "priya@x.com",
  `update "ContentItem" set "voCompletedAt" = now(), "voUrl" = 'https://example.com/vo'`,
);
console.log("PASS  the voice over person can upload their own part");
await as("priya@x.com", `update "ContentItem" set stage = 'footage_review'`);
console.log("PASS  the voice over person can move the video off the shoot stage");

console.log();
console.log(failed ? "RESULT: FAILURES ABOVE" : "RESULT: setup.sql is good");
process.exit(failed ? 1 : 0);
