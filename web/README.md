# Agency OS

React 19 · Vite 8 · React Router 7 · plain CSS · Supabase

Same app, same screens, same rules as before. What changed is where the work
happens: there is no server of our own any more. The browser talks to Postgres
directly, and Postgres decides what each person may read or write.

## Running it

```bash
npm install
cp .env.example .env      # then paste your anon key into it
npm run dev               # http://localhost:3000
```

Two values, both from **Supabase → Project Settings → API**:

| Variable                  | Where it comes from    |
| ------------------------- | ---------------------- |
| `VITE_SUPABASE_URL`       | Project URL            |
| `VITE_SUPABASE_ANON_KEY`  | `anon` `public` key    |

The anon key ships to the browser on purpose. It is not a secret and it does not
grant access on its own — see below.

```bash
npm run typecheck   # tsc, no emit
npm run build       # typecheck, then build to dist/
npm run preview     # serve dist/ locally
```

## Set the database up once

Run `supabase/setup.sql` in the Supabase SQL editor. One file, safe to run
again at any time — it adds the columns the app expects, gives the database its
own way to fill in ids and timestamps, turns on row level security with the
permission rules, and adds the two functions the invite page needs.

`policies.sql` and `invites.sql` are the same content split by subject, kept for
reading. `setup.sql` is the one to run.

Before running it on a real database, check it:

```bash
npm run verify:db
```

That loads the production schema from `prisma/migrations` into a throwaway
Postgres, applies `setup.sql` twice, and then makes every insert the app makes.
PGlite is Postgres itself compiled to WebAssembly, so it is the real engine —
real triggers, real row level security — with nothing to install beyond npm,
no Docker, and nothing left running afterwards.

Then in **Authentication → Providers → Email**, decide whether you want email
confirmation. With it on, someone who accepts an invite has to click a link in
their inbox before they can sign in; with it off, they are in straight away.

### Passwords have to be set again

The old build stored its own password hashes. Sign-in is Supabase Auth's job
now, and there is no way to hand it those old hashes. Everyone sets a password
once, from a link emailed to them (Team → the person → **Send reset**). Nothing
else moves: the same `Member` row keeps their role, their assignments, their
history and their pay.

For the two CEO accounts, create them in **Authentication → Users → Add user**
with the same email addresses their `Member` rows already use. Matching is by
email, so they pick up their existing records immediately.

## Email notifications

Mail goes out from two places, and every mail from either one carries a button
that opens the exact thing it is about — the video, your queue, the client whose
month is empty. That is enforced rather than remembered: both senders build
their mail with `page()` in `supabase/functions/_shared/mail.ts`, which takes
the link as a required argument, so a new kind of mail cannot be written without
saying where it goes.

**`notify` sends on a click.** Four moments: work being **assigned**, work being
**submitted** for review, an approval, and a request for changes. Nobody is ever
mailed about something they did themselves.

The browser can't send it — that would mean shipping an API key to every
signed-in device — so it asks the edge function, which looks up the recipients
itself and hands the mail to [Resend](https://resend.com). The browser names an
event and an assignment slot ("whoever is the editor on this video"); it never
names a person and never carries an address.

**`invite` sends when someone joins.** Adding a team member, or resetting their
password, emails them a one-time link to choose it themselves. The token is
minted, hashed and mailed entirely inside the function, so the only plaintext
copy that exists is the one in their inbox — the browser that asked for the
invite never sees it. The database still stores nothing but the SHA-256. If the
mail can't be sent, the link comes back in the response instead and the UI
offers it to be copied, because someone locked out of the app is a worse problem
than a token on a screen.

**`sweep` sends on a clock.** See the next section.

Deploy all three once:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy notify
npx supabase functions deploy invite
npx supabase functions deploy sweep
```

Then set the secrets, either with the CLI or in **Edge Functions → Secrets** in
the dashboard:

| Secret           | What it is                                                     |
| ---------------- | -------------------------------------------------------------- |
| `RESEND_API_KEY` | from resend.com → API Keys                                      |
| `EMAIL_FROM`     | `Agency OS <no-reply@yourdomain.com>` — a verified sender        |
| `APP_URL`        | where the app is hosted, for the link in every mail             |
| `SWEEP_KEY`      | any long random string — the only way to call `sweep`           |
| `SWEEP_TZ`       | optional, the agency's timezone. Default `Asia/Kolkata`         |
| `DIGEST_HOUR`    | optional, UTC hour for the daily mails. Default 3 (09:00 IST)   |

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx \
  EMAIL_FROM="Agency OS <no-reply@yourdomain.com>" \
  APP_URL=https://your-app.vercel.app \
  SWEEP_KEY="$(openssl rand -hex 32)"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase itself
and don't need setting.

## Deadlines, stalls and digests

`supabase/functions/sweep` is the part that chases work without anyone asking
it to. It runs every hour over each agency's open board and does five things:

- **Escalates a missed deadline.** Under a day late, the person who owes it
  hears about it. Over a day, their manager is on the mail too. Over two days,
  it is the CEO's to unblock. Each rung fires once, and moving the deadline
  starts the ladder again rather than swallowing the next nudge.
- **Flags work that hasn't moved in three days**, deadline or no deadline —
  the stall a date-based check can never catch, because the video never had a
  date to miss. Measured from `ContentItem.stageSince`, which the database sets
  on a real stage change and leaves alone on an ordinary edit.
- **Mails each person their day** — what of theirs is late, what is due today,
  each line linking to that video. An empty digest is never sent.
- **Mails managers where the board is jammed** — which stage holds the most
  work, how much is late, how much is stalled, what has sat longest.
- **Warns when a client's next month is still empty**, three days before their
  cycle starts.

The hourly pass is for the escalations: "a day late" has to become "two days
late" within an hour of it being true. The three digests are a day's news, so
the function holds them until the pass whose UTC hour matches `DIGEST_HOUR`.

Lateness is counted in whole days, in the timezone named by `SWEEP_TZ`, because
that is what the board counts. The board calls a deadline late the moment the
local day turns over; a sweep working in UTC would disagree with it for five and
a half hours every night from India — a card reading "1d late" with no mail sent
yet. Both measure the end of a day the same way instead. If you are selling this
to an agency outside India, `SWEEP_TZ` is the one secret that has to change.

Set the schedule once, after `setup.sql`: fill the two placeholders in
`supabase/cron.sql` and run it. It uses `pg_cron` and `pg_net`, so Postgres
itself calls the function — there is nothing else to host and nothing to keep
awake.

To try the daily mails without waiting for tomorrow morning:

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/sweep?digests=1' \
  -H 'x-sweep-key: <your-sweep-key>'
```

**A reminder is never sent twice.** Every mail the sweep sends claims a row in
`MailLog` before it goes out, keyed to what it was about — the deadline it was
measured against, the stage a video was stuck in, the day a digest covered. Two
overlapping runs, or one retried cron job, lose the race rather than the
reader's attention. The sweep writes that table as the service role; nobody
signed in can, which `npm run verify:db` checks.

So the hourly beat is a *check*, not a send. One late video produces three mails
over its whole life — one per rung of the ladder — and the other twenty-one
checks that day find the key taken and do nothing. Only the digests recur, once
a day, and only while something is late or due.

**Mail goes out one at a time, 600ms apart.** Resend's default plan allows two
requests a second and refuses the rest rather than queueing them, so a sweep
that fired a whole morning's mail at once would lose some of it — which is
exactly what the first live run did, sending ten and dropping four. A run sends
at most 60 mails; a bigger backlog spreads over the next few hourly passes,
which the ledger makes automatic.

**A failed send hands its key back.** Claiming first is what stops duplicates,
but it also means a send that fails has spent its key — and a reminder nobody
will ever retry is worse than the duplicate the key was guarding against. So a
failure deletes the row and the next pass tries again: at-most-once for mail
that arrives, keep-trying for mail that doesn't.

**A domain has to be verified before anyone but you gets mail.** Until one is,
`EMAIL_FROM` falls back to Resend's shared `onboarding@resend.dev` sender, which
only ever delivers to the address that owns the Resend account — useful for
testing, useless for the team. Add your domain in Resend → Domains, add the DNS
records it asks for, then point `EMAIL_FROM` at it.

Mail is sent without the app waiting on it. If Resend is down or a key is wrong,
the action still goes through and the failure is a line in the console — a video
that moved is a video that moved.

## Where the security lives

The old build checked permissions on the server before every query. There is no
server here, so a check in this code can be edited away in devtools. The rules
therefore live in the database:

- **`supabase/policies.sql`** — who may see which rows. Creatives see only the
  videos they are assigned to; clients and content are scoped to one agency;
  payouts are the CEO's alone.
- **Two triggers in the same file** — the three CEO gates, and "each person only
  moves their own step". These are triggers rather than policies because a policy
  sees either the old row or the new row, never both, and the rule is about the
  change itself.

`src/lib/permissions.ts` is still here and still used — but only to decide which
buttons to draw. Hiding a button is a courtesy; the database is the rule.

## Layout

```
src/
  index.css          design tokens — colours, spacing, radii, shared classes
  lib/               all the logic, no framework in it
    pipeline.ts      the nine stages, the three CEO gates, late/soon/stuck
    schedule.ts      the four-week deadline cycle
    permissions.ts   who may do what (for the UI)
    queries.ts       every read and write
    notify.ts        asks the edge function to email whoever a change concerns
    performance.ts   per-person delivery, measured from stage timestamps
    payouts.ts       monthly pay
    use-async.ts     loading state for a page's own fetch
  components/ui/     Button, Field, Modal, Toast… one .tsx and one .css each
  pages/             one folder per section, page CSS beside the page
supabase/
  setup.sql          the SQL to run once
  cron.sql           the hourly schedule, once the placeholders are filled in
  functions/
    _shared/mail.ts  the one email layout — and the link every mail carries
    notify/          mail sent the moment someone moves a video
    invite/          mail that gets a new person their password
    sweep/           mail sent on a clock: escalations, stalls, digests
```

Every component and page keeps its stylesheet next to it and imports it. There
is no build step for CSS beyond what Vite does, and no class-name framework to
learn — the tokens in `index.css` are the whole system.

## Deploying

Vercel, as a static site. `vercel.json` sets the build and, importantly, rewrites
every path to `index.html` so that opening `/clients/abc` directly works instead
of 404ing. Set the same two environment variables in the Vercel project.

The bundle is about 84 KB gzipped and there is nothing to cold-start, which is
the part of the old setup that made the app feel slow.
