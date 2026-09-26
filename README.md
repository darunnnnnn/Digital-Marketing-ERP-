# Agency OS

An operating system for digital marketing, creative and content-production agencies.
Plan → Script → Approve → Shoot → Upload → Edit → Review → Publish → Report.

## Stack

- **Next.js 15** (App Router, Server Actions) + TypeScript
- **Tailwind CSS v4** with a light/dark design system
- **Prisma + SQLite** (swap the datasource to Postgres for multi-tenant deployment)

## Getting started

```bash
npm install
npm run setup   # creates the database and seeds demo data
npm run dev     # http://localhost:3000
```

### Demo sign-ins

Every demo account uses the password **`demo1234`**. Local development only.

| Role | Email |
| --- | --- |
| CEO | `ceo@demo.test` |
| Social media manager | `manager@demo.test` |
| Scriptwriter | `writer@demo.test` |
| Cameraman | `camera@demo.test` |
| Editor | `editor@demo.test` |
| Posting | `posting@demo.test` |

Verification builds can run beside `npm run dev` without touching its cache:
`NEXT_DIST_DIR=.next-verify npx next build`

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run db:push` | Sync the Prisma schema to SQLite |
| `npm run db:seed` | Reset and reseed demo data |
| `npm run db:studio` | Browse the database |

## Phase status

| Phase | Feature | Status |
| --- | --- | --- |
| 1 | Client management | **Done** |
| 2 | Content pipeline (board, stage flow, the Video #047 record) | **Done** |
| 3 | Role dashboards (CEO, scriptwriter, cameraman, editor, posting) | Planned |
| 4 | Team performance + payouts | **Done** |
| 5 | Monthly agency reports | Planned |
| 6 | Logins, roles, team invites | **Done** |

### Phase 1 — Client management

- Client list with live search, status tabs and month-to-date progress per card
- Create / edit / delete clients, with server-side validation
- Client detail: progress ring against the monthly target, pipeline breakdown by
  stage, contact details, notes, recent content
- Six accent colours so clients stay visually distinct
- Light and dark themes, persisted per browser

### Phase 2 — Content pipeline

- Kanban board across eight stages, including two CEO approvals, with drag and drop
- List view, plus filters by client, assignee, overdue, and a live search
- Plan a whole week at once: paste one idea per line, each becomes its own video
- The central record for every video — brief, script, shoot, edit and posting
  panels, four role assignments, links, and an append-only activity log
- Stage actions that stamp the right dates, and a *send back* that counts a
  revision and records why

## Two different apps, by role

**CEO and social media manager** get the agency view: the board across all nine
stages, filters, clients, and the hand-off dialogs.

**Scriptwriter, cameraman, editor and posting** never see the board. `/content`
is their own queue — what is assigned to them, when it is due, most urgent first
— and a video page that shows only their step: what they were given (the idea,
the approved script, the footage link), one form for their own work, and a
button to send it on. No columns, no filters, no other people's work.

Which panel each role owns lives in `lib/my-work.ts`.

## Logins and roles

- **Sign-in** is email and password. Passwords are hashed with scrypt; sessions
  are random tokens in an httpOnly cookie, stored in the database only as a
  SHA-256 hash. Deactivating someone signs them out everywhere at once.
- **No self sign-up.** The CEO invites people from **Team**. The invite is a
  one-use link that expires in 7 days; the same flow resets a password.
- **Permissions live in `lib/permissions.ts`** and every server action checks
  them before touching data. The UI reads the same rules only to hide buttons.

| | CEO | Manager | Creative roles |
| --- | --- | --- | --- |
| See videos | all | all | only ones assigned to them |
| Approve scripts & final videos | ✓ | | |
| Plan, assign, set deadlines | ✓ | ✓ | |
| Press their own stage's button | ✓ | ✓ | ✓ |
| Drag on the board | ✓ | | |
| Clients | ✓ | ✓ | |
| Team | ✓ | | |

## Team performance (CEO)

**Team** lists everyone with this month's deliveries, on-time rate and anything
overdue now. Click a name for their profile, one month at a time:

- **Delivered:** the step their role owns (scripts written, footage uploaded,
  edits submitted, videos posted; approvals for the CEO)
- **On time / late:** each delivery compared with that step's deadline, with
  average and worst delay
- **On their desk now:** open work, most overdue first
- **Sent back:** revisions requested on their step
- **By client:** where their month went

Everything is derived from the timestamps the pipeline records; nothing is
entered by hand. Logic lives in `lib/performance.ts`.

## Payouts (CEO)

Each person has a pay type (set from **Payouts → Pay settings**):

| Pay type | Earns |
| --- | --- |
| Per task | rate × deliveries |
| Salary | fixed monthly amount |
| Hybrid | salary + rate × deliveries |

Deliveries are the same counts shown on team profiles. A month is a **running
total** until the CEO approves it. **Approving freezes** the delivery count,
rates and any bonus or deduction (a reason is required), so later rate changes
never rewrite history. An approval can be reopened until it is **marked paid**;
paid months are locked. **Export CSV** gives the month for accounting.
People with no pay set up are listed separately as not on payroll.

Logic: `lib/pay-rules.ts` (pure, used in the browser too) and `lib/payouts.ts`.

## Design system

**Evergreen & mist.** Frosted white cards over a softly tinted page, an icon-rail
sidebar, bold sans headings, pill buttons.

| Token | Use |
| --- | --- |
| `stone` | redefined as a cool mist grey — text, borders, quiet surfaces |
| `brand` | deep evergreen — navigation, primary actions, progress, approvals |
| `red` | signal only — overdue, or about to be deleted |

Two utilities in `app/globals.css` carry every surface: `surface` (the frosted
card) and `surface-sm` (solid tiles inside cards and on the board). Both colour
scales live in the same file.

## The flow

The CEO hands work on at three gates. Approving is never just approving: it also
picks the next person and sets their deadline, so nothing sits unassigned.

```
CEO plans N scripts for a writer, with a deadline
        -> Scripting        writer writes (and names) each script
        -> Script review    CEO approves + assigns cameraman + shoot deadline
        -> Shooting         cameraman shoots, uploads footage
        -> Footage review   CEO approves + assigns editor + edit deadline
        -> Editing          editor cuts, submits
        -> Final review     CEO approves + assigns posting + posting deadline
        -> Ready to post    caption, schedule, publish
        -> Published        counts toward the client's monthly target
```

Planning takes either a list of ideas, or **just a number** of scripts — the
writer then proposes and names each one.

The CEO also chooses how far ahead to schedule:

- **Script only** (default) — set the writer and their deadline. Everything
  downstream stays blank and is decided at each gate. The CEO's own script
  review is dated the day after the script is due.
- **Whole cycle** — set all six deadlines now, and optionally assign the
  cameraman, editor and posting person up front. The gates still require CEO
  approval; they just arrive pre-filled.

Any gate can be sent back instead ("Request changes", "Send back to reshoot"),
which returns the video a stage, clears that step's completion stamp, and counts
a revision.

### Deadlines

Planning fills in a default four-week schedule from the Monday the cycle starts:

| Week | Step | Owner | Default |
| --- | --- | --- | --- |
| 1 | Script written | Scriptwriter | Thursday |
| 1 | Script approved | CEO | Friday |
| 2 | Shot & footage uploaded | Cameraman | Friday |
| 3 | Edit complete | Editor | Friday |
| 4 | Final video approved | CEO | Tuesday |
| 4 | Posted | Posting team | Friday |

Those are only defaults: the CEO confirms or changes each deadline at the gate
that hands the work on, and any date can be edited on the video itself. The
board shows each video's *current* step deadline. A video counts toward the
month it is posted in. Rules live in `lib/schedule.ts` and `lib/pipeline.ts`.

## Logins and roles

- **Sign-in** is email and password. Passwords are hashed with scrypt; sessions
  are random tokens in an httpOnly cookie, stored in the database only as a
  SHA-256 hash. Deactivating someone signs them out everywhere at once.
- **No self sign-up.** The CEO invites people from **Team**. The invite is a
  one-use link that expires in 7 days; the same flow resets a password.
- **Permissions live in `lib/permissions.ts`** and every server action checks
  them before touching data. The UI reads the same rules only to hide buttons.

| | CEO | Manager | Creative roles |
| --- | --- | --- | --- |
| See videos | all | all | only ones assigned to them |
| Approve scripts & final videos | ✓ | | |
| Plan, assign, set deadlines | ✓ | ✓ | |
| Press their own stage's button | ✓ | ✓ | ✓ |
| Drag on the board | ✓ | | |
| Clients | ✓ | ✓ | |
| Team | ✓ | | |

## Team performance (CEO)

**Team** lists everyone with this month's deliveries, on-time rate and anything
overdue now. Click a name for their profile, one month at a time:

- **Delivered:** the step their role owns (scripts written, footage uploaded,
  edits submitted, videos posted; approvals for the CEO)
- **On time / late:** each delivery compared with that step's deadline, with
  average and worst delay
- **On their desk now:** open work, most overdue first
- **Sent back:** revisions requested on their step
- **By client:** where their month went

Everything is derived from the timestamps the pipeline records; nothing is
entered by hand. Logic lives in `lib/performance.ts`.

## Payouts (CEO)

Each person has a pay type (set from **Payouts → Pay settings**):

| Pay type | Earns |
| --- | --- |
| Per task | rate × deliveries |
| Salary | fixed monthly amount |
| Hybrid | salary + rate × deliveries |

Deliveries are the same counts shown on team profiles. A month is a **running
total** until the CEO approves it. **Approving freezes** the delivery count,
rates and any bonus or deduction (a reason is required), so later rate changes
never rewrite history. An approval can be reopened until it is **marked paid**;
paid months are locked. **Export CSV** gives the month for accounting.
People with no pay set up are listed separately as not on payroll.

Logic: `lib/pay-rules.ts` (pure, used in the browser too) and `lib/payouts.ts`.

## Design system

**Evergreen & mist.** Frosted white cards over a softly tinted page, an icon-rail
sidebar, bold sans headings, pill buttons.

| Token | Use |
| --- | --- |
| `stone` | redefined as a cool mist grey — text, borders, quiet surfaces |
| `brand` | deep evergreen — navigation, primary actions, progress, approvals |
| `red` | signal only — overdue, or about to be deleted |

Two utilities in `app/globals.css` carry every surface: `surface` (the frosted
card) and `surface-sm` (solid tiles inside cards and on the board). Both colour
scales live in the same file.

## The four-week cycle

Every video is scheduled from the Monday its cycle starts:

| Week | Step | Owner | Default deadline |
| --- | --- | --- | --- |
| 1 | Script written | Scriptwriter | Thursday |
| 1 | Script approved | CEO | Friday |
| 2 | Shot & footage uploaded | Cameraman | Friday |
| 3 | Edit complete | Editor | Friday |
| 4 | Final video approved | CEO | Tuesday |
| 4 | Posted | Posting team | Friday |

Deadlines are ordinary dates afterwards and can be moved per video. The board
shows each video's *current* step deadline; the video page shows all six with
done / late / upcoming status. A video counts toward the month it is posted in.
Rules live in `lib/schedule.ts`.

## Moving to a real database (Supabase)

Development uses SQLite (`prisma/dev.db`, a file). For real use, switch to
Supabase Postgres. Footage and images stay as Drive links, so no file storage
is needed — only the database.

1. **Create a Supabase project.** Save the database password it asks you to set.
2. **Copy two connection strings** from *Project Settings -> Database -> Connect*:
   - **Transaction pooler** (port 6543) — what the app uses.
   - **Session pooler** (port 5432) — what migrations use.
3. **Put them in `.env` first** (switching the schema before this gives a P1012 error):
   ```
   DATABASE_PROVIDER="postgresql"
   DATABASE_URL="postgresql://…:6543/postgres?pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://…:5432/postgres"
   ```
4. **Switch Prisma over:** `npm run use:postgres` (`npm run use:sqlite` goes back).
5. **Create the tables:** `npm run db:migrate -- --name init`, or `npm run db:deploy` when hosted.
6. **Create your agency and CEO login** — the demo seed is not for real data:
   ```bash
   npm run bootstrap -- "Your Agency" "Your Name" you@agency.com "a-strong-password"
   ```
   Then sign in and invite the team from **Team**.

`DATABASE_PROVIDER` keeps search case-insensitive on Postgres, matching SQLite
(`lib/search.ts`). `npm run db:seed` deletes everything, so it refuses to run
against any database that isn't local (`prisma/guard.ts`).

## Project layout

```
app/
  clients/            list, detail, edit, server actions
  content/            board, the per-video record, server actions
components/
  ui/                 design-system primitives
  clients/            client cards, form, toolbar, dialogs
  content/            board, cards, stage rail, panels, timeline
  app-shell.tsx       sidebar + top bar
lib/
  db.ts               Prisma singleton
  agency.ts           current workspace (auth lands in a later phase)
  pipeline.ts         the seven stages, their owners, colours and transitions
  content-ops.ts      every pipeline mutation, free of framework imports
  stats.ts            month-to-date content aggregates
  theme.ts            accent + status palettes
prisma/
  schema.prisma       Agency, Client, Member, ContentItem, ContentEvent
  seed.ts             demo agency: six clients, nine people, 45 videos
```

## Notes on the data model

`lib/pipeline.ts` is the single source of truth for the seven stages. Board
columns, badges, stage buttons and the progress rail all read from it, so adding
or renaming a stage is a one-file change.

`lib/content-ops.ts` holds every mutation with no Next.js imports, and the server
actions are thin wrappers over it. That keeps the pipeline rules testable on
their own, without a running server.

Calendar dates (due, shoot, scheduled) are stored at **midday UTC**. Local
midnight would slip to the previous day once stored and read back wrong from
another timezone.

`Member` exists so pipeline assignments are real people rather than free text.
Full team management and payouts build on it in later phases.

Every query is scoped by `agencyId`, so adding auth and true multi-tenancy later
is a small change rather than a rewrite.
