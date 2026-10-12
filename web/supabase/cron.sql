-- The clock behind the scheduled mail. Run this once, after setup.sql, with
-- the two placeholders filled in.
--
-- It is a file of its own rather than part of setup.sql for two reasons: it
-- carries secrets, so it is not something to keep filled in anywhere; and it
-- needs two Postgres extensions that only a hosted Supabase project has, which
-- would make `npm run verify:db` fail on a database that is otherwise fine.
--
-- Replace both before running:
--
--   <PROJECT-REF>  your Supabase project ref, from the dashboard URL
--   <SWEEP-KEY>    the same long random string you set as the SWEEP_KEY secret
--                  on the function (npx supabase secrets set SWEEP_KEY=…)
--
-- pg_cron schedules it; pg_net is what lets Postgres make the HTTP call. Both
-- are on the Supabase extensions list and need no configuration beyond this.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Hourly, on the hour. Escalation is measured in hours — "a day late" has to
-- become "two days late" within an hour of it being true, or the ladder is a
-- day behind the thing it is reporting. The three daily digests are a day's
-- news, not an hour's, and the function itself holds them back until the pass
-- whose UTC hour matches its DIGEST_HOUR secret (3 by default, 09:00 IST).
--
-- The schedule is in UTC, as pg_cron always is. Which hour counts as the start
-- of the agency's day is the function's business, not this file's — see its
-- SWEEP_TZ and DIGEST_HOUR secrets.
select cron.unschedule('agency-os-sweep')
 where exists (select 1 from cron.job where jobname = 'agency-os-sweep');

select cron.schedule(
  'agency-os-sweep',
  '0 * * * *',
  $$
    select net.http_post(
      url := 'https://<PROJECT-REF>.supabase.co/functions/v1/sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sweep-key', '<SWEEP-KEY>'
      ),
      timeout_milliseconds := 60000
    );
  $$
);

-- The ledger only has to remember long enough that a reminder isn't repeated,
-- and every key it holds is tied to a deadline, a stage or a day that is long
-- past by then. Weekly, on Sunday.
select cron.unschedule('agency-os-prune-maillog')
 where exists (select 1 from cron.job where jobname = 'agency-os-prune-maillog');

select cron.schedule(
  'agency-os-prune-maillog',
  '0 4 * * 0',
  $$ delete from "MailLog" where "sentAt" < now() - interval '90 days' $$
);

-- What is scheduled, and how the last few runs went:
--
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--
-- To try the daily mails without waiting for tomorrow morning, call the
-- function directly with ?digests=1:
--
--   curl -X POST 'https://<PROJECT-REF>.supabase.co/functions/v1/sweep?digests=1' \
--     -H 'x-sweep-key: <SWEEP-KEY>'
