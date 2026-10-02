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

Then in **Authentication → Providers → Email**, decide whether you want email
confirmation. With it on, someone who accepts an invite has to click a link in
their inbox before they can sign in; with it off, they are in straight away.

### Passwords have to be set again

The old build stored its own password hashes. Sign-in is Supabase Auth's job
now, and there is no way to hand it those old hashes. Everyone sets a password
once, from an invite link (Team → the person → **Reset link**). Nothing else
moves: the same `Member` row keeps their role, their assignments, their history
and their pay.

For the two CEO accounts, create them in **Authentication → Users → Add user**
with the same email addresses their `Member` rows already use. Matching is by
email, so they pick up their existing records immediately.

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
    pipeline.ts      the nine stages and the three CEO gates
    schedule.ts      the four-week deadline cycle
    permissions.ts   who may do what (for the UI)
    queries.ts       every read and write
    performance.ts   per-person delivery, measured from stage timestamps
    payouts.ts       monthly pay
    use-async.ts     loading state for a page's own fetch
  components/ui/     Button, Field, Modal, Toast… one .tsx and one .css each
  pages/             one folder per section, page CSS beside the page
supabase/            the SQL to run once
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
