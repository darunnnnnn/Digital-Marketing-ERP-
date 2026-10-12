/**
 * Everything Agency OS says without being asked.
 *
 * `notify` mails on a click — someone assigned work, someone approved it. This
 * one runs on a clock instead, and its whole job is the mail nobody is around
 * to send: the deadline that passed at the weekend, the video that has sat in
 * one stage since Tuesday, the morning list of what is actually on your desk.
 *
 * It does five things, in one pass over each agency's open work:
 *
 *   1. escalates a missed deadline — the person, then their manager, then the CEO
 *   2. flags work that has not moved in three days, deadline or no deadline
 *   3. mails each person their own day: what is late, what is due today
 *   4. mails managers where the pipeline is actually jammed
 *   5. warns when a client's next month has no videos planned for it yet
 *
 * Scheduled hourly (see the cron block in supabase/setup.sql), because an
 * escalation measured in hours needs to be looked at in hours. The three
 * digests are a day's news, not an hour's, so they only go out on the pass
 * where the UTC hour matches DIGEST_HOUR — one schedule, two cadences.
 *
 * Nothing here can be triggered from the browser: it answers only to a request
 * carrying SWEEP_KEY, which only the database's cron job holds.
 *
 * Secrets, on top of the three in ../_shared/mail.ts:
 *   SWEEP_KEY     any long random string, also pasted into the cron job
 *   DIGEST_HOUR   optional, UTC hour for the daily mails. Default 3 (09:00 IST).
 *
 * Deploy:  npx supabase functions deploy sweep
 */

import { insertIfNew, read, remove } from "../_shared/db.ts";
import {
  CORS,
  RESEND_API_KEY,
  dateLabel,
  page,
  plural,
  refLabel,
  send,
} from "../_shared/mail.ts";
import type { Item as MailItem } from "../_shared/mail.ts";

const SWEEP_KEY = Deno.env.get("SWEEP_KEY");
const DIGEST_HOUR = Number(Deno.env.get("DIGEST_HOUR") ?? "3");

/**
 * The agency's own timezone, which is what decides when a day ends.
 *
 * This matters more than it looks. The board calls a deadline late the moment
 * the local day turns over, because it does its date maths in the browser's
 * timezone. A sweep working in UTC would disagree with it for five and a half
 * hours every night from India — the board showing "1d late" while no mail had
 * gone out yet. So the sweep is told which timezone the agency keeps, and
 * measures the end of a day the same way the board does.
 */
const TZ = Deno.env.get("SWEEP_TZ") ?? "Asia/Kolkata";

/** How long a video may sit in one stage before it counts as stuck. */
const STUCK_HOURS = 72;

/** A client's next month should have videos planned this many days out. */
const CYCLE_WARNING_DAYS = 3;

/**
 * The gap between sends. Resend's default plan allows two requests a second,
 * and going over it doesn't queue the extras — it refuses them. 600ms keeps
 * comfortably under with room for a slow response.
 */
const SEND_GAP_MS = 600;

/**
 * The most mail one pass will send. At the gap above this is about 36 seconds,
 * well inside the minute the cron job allows it. A backlog bigger than this
 * isn't dropped, just spread over the next few hourly passes — which the
 * ledger makes automatic, since it already knows what has gone out.
 */
const MAX_PER_RUN = 60;

// ------------------------------------------------------------------ the work

/**
 * Which deadline a video is working against while it sits in a stage. The three
 * CEO gates have none of their own: each keeps counting against the step it is
 * reviewing, so a video held up in review still reads as late. Kept in step
 * with STAGE_DEADLINE in src/lib/schedule.ts — the board and the mail have to
 * agree about what "late" means or the mail is wrong.
 */
const STAGE_DUE: Record<string, DueField | null> = {
  planned: "scriptDue",
  scripting: "scriptDue",
  script_review: "scriptDue",
  shooting: "shootDue",
  footage_review: "shootDue",
  editing: "editDue",
  edit_review: "editDue",
  ready: "publishDue",
  published: null,
};

type DueField = "scriptDue" | "shootDue" | "editDue" | "publishDue" | "voDue";

/** What to call the step a video is on, in a subject line. */
const STAGE_STEP: Record<string, string> = {
  planned: "Planning",
  scripting: "Script",
  script_review: "Script review",
  shooting: "Shoot",
  footage_review: "Footage review",
  editing: "Edit",
  edit_review: "Final review",
  ready: "Posting",
};

const GATES = ["script_review", "footage_review", "edit_review"];

type Member = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

type Client = {
  id: string;
  name: string;
  status: string;
  monthlyPostTarget: number;
  monthlyTarget: number;
};

type Item = {
  id: string;
  clientId: string;
  ref: number;
  title: string;
  stage: string;
  monthKey: string;
  stageSince: string | null;
  scriptDue: string | null;
  shootDue: string | null;
  editDue: string | null;
  publishDue: string | null;
  voDue: string | null;
  voCompletedAt: string | null;
  shootNeeded: boolean;
  voNeeded: boolean;
  scriptwriterId: string | null;
  cameramanId: string | null;
  voiceoverId: string | null;
  editorId: string | null;
  publisherId: string | null;
  Client: { name: string } | null;
};

const ITEM_COLUMNS = [
  "id",
  "clientId",
  "ref",
  "title",
  "stage",
  "monthKey",
  "stageSince",
  "scriptDue",
  "shootDue",
  "editDue",
  "publishDue",
  "voDue",
  "voCompletedAt",
  "shootNeeded",
  "voNeeded",
  "scriptwriterId",
  "cameramanId",
  "voiceoverId",
  "editorId",
  "publisherId",
  "Client(name)",
].join(",");

/**
 * The deadline this video is actually running against. Mirrors `deadlineFor` in
 * src/lib/schedule.ts: a video with no shoot is on the shoot stage waiting for
 * the voice over alone, so it runs to that date instead.
 */
function dueField(item: Item): DueField | null {
  if (item.stage === "shooting" && !item.shootNeeded && item.voNeeded) return "voDue";
  return STAGE_DUE[item.stage] ?? null;
}

/**
 * Whose desk the video is on right now. The CEO's gates belong to the CEO; a
 * shoot stage can hold two people at once, the cameraman and the voice over,
 * and only the ones who still owe something are counted.
 */
function holders(item: Item, team: Member[]): Member[] {
  if (GATES.includes(item.stage)) return team.filter((m) => m.role === "ceo");

  // Nobody is assigned to a planned video yet — it is the managers' to move on.
  if (item.stage === "planned") return team.filter((m) => m.role === "manager" || m.role === "ceo");

  const ids: (string | null)[] = [];
  if (item.stage === "shooting") {
    if (item.shootNeeded) ids.push(item.cameramanId);
    if (item.voNeeded && !item.voCompletedAt) ids.push(item.voiceoverId);
  } else if (item.stage === "scripting") ids.push(item.scriptwriterId);
  else if (item.stage === "editing") ids.push(item.editorId);
  else if (item.stage === "ready") ids.push(item.publisherId);

  return team.filter((m) => ids.includes(m.id));
}

function hoursSince(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

/**
 * Lateness is counted in whole days, not hours.
 *
 * The ladder reads as "0–24h, then 24–48h, then beyond", and in a product where
 * every deadline is a calendar date that is the same thing as "a day late, then
 * two, then more" — with one difference that matters: days are what the board
 * already shows and what people already say. Counting them instead of hours is
 * what keeps a mail saying "2 days late" next to a card saying "2d late",
 * rather than the two drifting apart by an afternoon.
 */

/** A calendar day as a day number, so two of them can simply be subtracted. */
function dayNumber(year: number, month: number, day: number) {
  return Date.UTC(year, month, day) / 86_400_000;
}

/**
 * Today, in the agency's timezone. `en-CA` is the one locale that formats as
 * YYYY-MM-DD, which is why it is used here and nowhere else in the app.
 */
function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = parts.split("-").map(Number);
  return dayNumber(y, m - 1, d);
}

/**
 * The day a deadline falls on. Deadlines are calendar dates pinned to midday
 * UTC, so their day is read back in UTC — the same thing `formatCalendar` does
 * in the app, and the reason a date chosen in one timezone reads back as the
 * day that was chosen in every other.
 */
function dueDay(due: string | null) {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  return dayNumber(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole days past the deadline, or null if it isn't past yet. */
function daysLate(due: string | null) {
  const day = dueDay(due);
  if (day === null) return null;
  const late = today() - day;
  return late > 0 ? late : null;
}

/** Days until the deadline. Negative once it's past, 0 on the day itself. */
function daysUntil(due: string | null) {
  const day = dueDay(due);
  return day === null ? null : day - today();
}

/** Which local day a digest covers, so "once a day" means the agency's day. */
function dayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthKeyOf(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// --------------------------------------------------------------------- mail

/**
 * One mail, claimed before it is sent — and the claim handed back if the send
 * fails.
 *
 * The ledger row goes in first, so two overlapping runs can never both mail the
 * same reminder: one of them loses the race and stops. But claiming first means
 * a send that fails has already spent its key, and a reminder nobody will ever
 * retry is worse than the duplicate the key was protecting against. So a
 * failure deletes the row again and the next pass picks it up.
 *
 * The result is at-most-once for mail that arrives, and keep-trying for mail
 * that doesn't — which is what a rate limit, a blip at Resend or a cold start
 * actually needs. It was a real failure that put this here: the first live run
 * sent ten and lost four to Resend's rate limit, and without this those four
 * would have stayed lost for good.
 */
async function once(
  agencyId: string,
  kind: string,
  key: string,
  to: string,
  subject: string,
  html: string,
) {
  const claimed = await insertIfNew("MailLog", { agencyId, kind, key });
  if (!claimed) return false;

  try {
    await send(to, subject, html);
    return true;
  } catch (e) {
    await remove(
      "MailLog",
      `kind=eq.${encodeURIComponent(kind)}&key=eq.${encodeURIComponent(key)}`,
    );
    throw e;
  }
}

type Job = { kind: string; key: string; to: string; subject: string; html: string };

// ------------------------------------------------------------------ the pass

/** 1. A missed deadline, escalating as it ages. */
function escalations(items: Item[], team: Member[]): Job[] {
  const managers = team.filter((m) => m.role === "manager");
  const ceos = team.filter((m) => m.role === "ceo");
  const jobs: Job[] = [];

  for (const item of items) {
    const field = dueField(item);
    const due = field ? item[field] : null;
    const late = daysLate(due);
    if (!due || late === null) continue;

    const level = late === 1 ? 1 : late === 2 ? 2 : 3;
    const step = STAGE_STEP[item.stage] ?? "Work";
    const who = holders(item, team);

    // Level by level: the person, then the person and their manager, then the
    // CEO. Each level is a different set of people and a different sentence,
    // because "you're a day behind" and "this has been late for two days" are
    // not the same message.
    const to =
      level === 1 ? who : level === 2 ? [...who, ...managers] : [...who, ...managers, ...ceos];

    const behind = `${plural(late, "day")} late`;

    const lead =
      level === 1
        ? `The ${step.toLowerCase()} deadline passed yesterday. Nothing is blocked yet, but it is slipping.`
        : level === 2
          ? `This has been late for two days and has not moved. Managers are on this mail too.`
          : `This is ${plural(late, "day")} late. It is now the CEO's to unblock.`;

    const html = page({
      heading: level === 3 ? `Still late: ${step.toLowerCase()}` : `${step} is past its deadline`,
      lead,
      lines: [
        { label: "Video", value: `${refLabel(item.ref)} ${item.title}` },
        { label: "Client", value: item.Client?.name ?? "—" },
        { label: "Step", value: step },
        { label: "Was due", value: dateLabel(due) ?? "—" },
        { label: "Behind by", value: behind },
      ],
      action: { label: "Open it in Agency OS", path: `content/${item.id}` },
      because: "Sent by Agency OS because this step is past its deadline.",
    });

    for (const m of dedupe(to)) {
      if (!m.email) continue;
      jobs.push({
        kind: "late",
        // The deadline is part of the key, so moving the date starts the ladder
        // again rather than silently swallowing the next nudge.
        key: `${item.id}:${field}:${due}:${level}:${m.id}`,
        to: m.email,
        subject: `${behind} — ${refLabel(item.ref)} ${item.title}`,
        html,
      });
    }
  }

  return jobs;
}

/** 2. Work that has not moved in three days. */
function stuck(items: Item[], team: Member[]): Job[] {
  const managers = team.filter((m) => m.role === "manager" || m.role === "ceo");
  const jobs: Job[] = [];

  for (const item of items) {
    const sitting = hoursSince(item.stageSince);
    if (sitting === null || sitting < STUCK_HOURS) continue;

    // A video that is already being escalated is already being chased. This
    // exists for the other kind of stall — the one with no deadline to miss,
    // which no amount of deadline checking would ever catch.
    const field = dueField(item);
    if (field && daysLate(item[field]) !== null) continue;

    const step = STAGE_STEP[item.stage] ?? "Work";
    const days = Math.floor(sitting / 24);
    const stillDue = field ? dateLabel(item[field]) : null;
    const html = page({
      heading: `Nothing has moved in ${plural(days, "day")}`,
      lead: stillDue
        ? `This video has been sitting on ${step.toLowerCase()} since then. Its deadline hasn't passed yet, so nothing else is flagging it.`
        : `This video has been sitting on ${step.toLowerCase()} since then, with no deadline on it to flag it.`,
      lines: [
        { label: "Video", value: `${refLabel(item.ref)} ${item.title}` },
        { label: "Client", value: item.Client?.name ?? "—" },
        { label: "Stage", value: step },
        { label: "Sitting since", value: dateLabel(item.stageSince) ?? "—" },
        ...(stillDue ? [{ label: "Due", value: stillDue }] : []),
      ],
      action: { label: "Open it in Agency OS", path: `content/${item.id}` },
      because: `Sent by Agency OS because this video hasn't moved in ${STUCK_HOURS} hours.`,
    });

    for (const m of dedupe([...holders(item, team), ...managers])) {
      if (!m.email) continue;
      jobs.push({
        kind: "stuck",
        // Keyed to the stage it is stuck in, so moving it on and getting stuck
        // again is a new thing to say rather than a repeat.
        key: `${item.id}:${item.stageSince}:${m.id}`,
        to: m.email,
        subject: `Not moved in ${plural(days, "day")} — ${refLabel(item.ref)} ${item.title}`,
        html,
      });
    }
  }

  return jobs;
}

/** 3. One person's day. */
function deskDigests(items: Item[], team: Member[]): Job[] {
  const today = dayKey();
  const jobs: Job[] = [];

  for (const m of team) {
    if (!m.email) continue;

    const mine = items.filter((i) => holders(i, team).some((h) => h.id === m.id));
    const rows = mine
      .map((i) => {
        const field = dueField(i);
        return { item: i, days: daysUntil(field ? i[field] : null) };
      })
      .filter((r) => r.days !== null && r.days <= 0)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

    // An empty digest is a mail that teaches people to ignore digests.
    if (rows.length === 0) continue;

    const late = rows.filter((r) => (r.days ?? 0) < 0).length;
    const due = rows.length - late;

    const list: MailItem[] = rows.map((r) => ({
      text: `${refLabel(r.item.ref)} ${r.item.title}`,
      meta: [
        r.item.Client?.name,
        STAGE_STEP[r.item.stage],
        (r.days ?? 0) < 0 ? `${plural(-(r.days ?? 0), "day")} late` : "due today",
      ]
        .filter(Boolean)
        .join(" · "),
      path: `content/${r.item.id}`,
    }));

    const parts = [
      late > 0 ? `${plural(late, "video")} late` : null,
      due > 0 ? `${plural(due, "video")} due today` : null,
    ].filter(Boolean);

    jobs.push({
      kind: "desk",
      key: `${m.id}:${today}`,
      to: m.email,
      subject: `Your day: ${parts.join(", ")}`,
      html: page({
        heading: "What's on your desk",
        lead: `${parts.join(" and ")}. Everything else can wait.`,
        items: list,
        action: { label: "Open your work", path: "content" },
        because: "Sent by Agency OS once a day, when something of yours is due or late.",
      }),
    });
  }

  return jobs;
}

/** 4. Where the pipeline is jammed. */
function bottleneck(items: Item[], team: Member[]): Job[] {
  const today = dayKey();
  const managers = team.filter((m) => m.role === "ceo" || m.role === "manager");
  if (managers.length === 0) return [];

  const lateItems = items.filter((i) => {
    const field = dueField(i);
    return field ? daysLate(i[field]) !== null : false;
  });
  const stuckItems = items.filter((i) => (hoursSince(i.stageSince) ?? 0) >= STUCK_HOURS);
  const waiting = items.filter((i) => GATES.includes(i.stage));

  // Nothing late, nothing stalled, nothing waiting on an approval is a good
  // day, and a good day does not need an email about it.
  if (lateItems.length === 0 && stuckItems.length === 0 && waiting.length === 0) return [];

  // Which stage is holding the most work — the one sentence a manager actually
  // acts on.
  const perStage = new Map<string, number>();
  for (const i of items) perStage.set(i.stage, (perStage.get(i.stage) ?? 0) + 1);
  const worst = [...perStage.entries()].sort((a, b) => b[1] - a[1])[0];

  const oldest = [...items]
    .sort((a, b) => (hoursSince(b.stageSince) ?? 0) - (hoursSince(a.stageSince) ?? 0))
    .slice(0, 5)
    .map((i): MailItem => {
      const sitting = Math.floor((hoursSince(i.stageSince) ?? 0) / 24);
      return {
        text: `${refLabel(i.ref)} ${i.title}`,
        meta: [
          i.Client?.name,
          STAGE_STEP[i.stage],
          sitting > 0 ? `${plural(sitting, "day")} in this stage` : "moved today",
        ]
          .filter(Boolean)
          .join(" · "),
        path: `content/${i.id}`,
      };
    });

  const html = page({
    heading: "Where the pipeline is today",
    lead: worst
      ? `${STAGE_STEP[worst[0]] ?? worst[0]} is holding the most work — ${plural(worst[1], "video")}.`
      : "Here is how the board stands.",
    lines: [
      { label: "Past deadline", value: String(lateItems.length) },
      { label: `Not moved in ${STUCK_HOURS}h`, value: String(stuckItems.length) },
      { label: "Waiting on approval", value: String(waiting.length) },
      { label: "In flight", value: String(items.length) },
    ],
    items: oldest,
    action: { label: "Open the pipeline", path: "content?overdue=1" },
    because: "Sent by Agency OS once a day to whoever runs the board.",
  });

  return managers
    .filter((m) => m.email)
    .map((m) => ({
      kind: "bottleneck",
      key: `${m.id}:${today}`,
      to: m.email!,
      subject: `Pipeline: ${plural(lateItems.length, "video")} late, ${waiting.length} waiting on you`,
      html,
    }));
}

/** 5. A client whose next month has nothing planned in it yet. */
function cycleReminders(
  clients: Client[],
  planned: Map<string, number>,
  team: Member[],
  monthKey: string,
  startsIn: number,
): Job[] {
  if (startsIn > CYCLE_WARNING_DAYS || startsIn < 0) return [];

  const managers = team.filter((m) => (m.role === "ceo" || m.role === "manager") && m.email);
  if (managers.length === 0) return [];

  const jobs: Job[] = [];
  for (const client of clients) {
    if (client.status !== "active") continue;

    const target = client.monthlyPostTarget || client.monthlyTarget;
    if (target <= 0) continue;
    if ((planned.get(client.id) ?? 0) > 0) continue;

    const html = page({
      heading: `${client.name} has nothing planned for next month`,
      lead: `Their cycle starts in ${plural(startsIn, "day")} and the board has no videos on it for that month yet.`,
      lines: [
        { label: "Client", value: client.name },
        { label: "Month", value: monthKey },
        { label: "They expect", value: `${plural(target, "video")} a month` },
        { label: "Planned so far", value: "0" },
      ],
      action: { label: "Plan their month", path: `clients/${client.id}` },
      because: "Sent by Agency OS because a client's month is about to start empty.",
    });

    for (const m of managers) {
      jobs.push({
        kind: "cycle",
        key: `${client.id}:${monthKey}:${m.id}`,
        to: m.email!,
        subject: `Plan ${client.name}'s ${monthKey} — nothing on the board yet`,
        html,
      });
    }
  }

  return jobs;
}

function dedupe(members: Member[]) {
  return [...new Map(members.map((m) => [m.id, m])).values()];
}

// --------------------------------------------------------------------- main

async function sweepAgency(agencyId: string, withDigests: boolean) {
  const [team, clients, items] = await Promise.all([
    read<Member>(`Member?agencyId=eq.${agencyId}&active=is.true&select=id,name,email,role`),
    read<Client>(
      `Client?agencyId=eq.${agencyId}&select=id,name,status,monthlyPostTarget,monthlyTarget`,
    ),
    read<Item>(`ContentItem?agencyId=eq.${agencyId}&stage=neq.published&select=${ITEM_COLUMNS}`),
  ]);

  const jobs: Job[] = [...escalations(items, team), ...stuck(items, team)];

  if (withDigests) {
    jobs.push(...deskDigests(items, team), ...bottleneck(items, team));

    // Next month, and how much of it is already on the board. Counted over
    // every stage including published, because a month with work already
    // posted in it plainly isn't an empty month.
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const monthKey = monthKeyOf(nextMonth);
    const startsIn = Math.round((nextMonth.getTime() - Date.now()) / 86_400_000);

    if (startsIn <= CYCLE_WARNING_DAYS) {
      const rows = await read<{ clientId: string }>(
        `ContentItem?agencyId=eq.${agencyId}&monthKey=eq.${monthKey}&select=clientId`,
      );
      const planned = new Map<string, number>();
      for (const r of rows) planned.set(r.clientId, (planned.get(r.clientId) ?? 0) + 1);
      jobs.push(...cycleReminders(clients, planned, team, monthKey, startsIn));
    }
  }

  // One at a time, with a gap. Resend allows two requests a second on the
  // default plan, and firing a whole morning's mail at once gets most of it
  // through and the rest thrown away — which is exactly what happened on the
  // first live run. `notify` can send its handful in parallel because it is
  // one event and a couple of recipients; a sweep is the whole board at once,
  // and the one thing it must not do is drop a reminder for going too fast.
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [i, j] of jobs.entries()) {
    // Whatever is left over is not lost: the ledger means the next pass, an
    // hour later, picks up exactly what this one didn't get to.
    if (sent + failed >= MAX_PER_RUN) {
      skipped = jobs.length - i;
      break;
    }
    if (i > 0) await new Promise((r) => setTimeout(r, SEND_GAP_MS));

    try {
      if (await once(agencyId, j.kind, j.key, j.to, j.subject, j.html)) sent++;
    } catch (e) {
      failed++;
      console.error(`sweep: ${j.kind} to ${j.to}:`, e);
    }
  }

  return { considered: jobs.length, sent, failed, skipped };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function handle(req: Request): Promise<Response> {
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY isn't set." }, 500);
  if (!SWEEP_KEY) return json({ error: "SWEEP_KEY isn't set." }, 500);

  // The only way in. No session, no agency, no slot to tamper with — either the
  // caller holds the key the cron job holds, or there is nothing here for them.
  if (req.headers.get("x-sweep-key") !== SWEEP_KEY) {
    return json({ error: "No." }, 401);
  }

  // Normally the hour decides whether the daily mails go out; `?digests=1` is
  // for trying them without waiting until tomorrow morning.
  const url = new URL(req.url);
  const withDigests =
    url.searchParams.get("digests") === "1" || new Date().getUTCHours() === DIGEST_HOUR;

  const agencies = await read<{ id: string; name: string }>("Agency?select=id,name");

  const out: Record<string, unknown> = {};
  for (const a of agencies) {
    try {
      out[a.name] = await sweepAgency(a.id, withDigests);
    } catch (e) {
      // One agency's bad data is not the others' problem.
      console.error(`sweep: ${a.name}:`, e);
      out[a.name] = { error: true };
    }
  }

  return json({ digests: withDigests, agencies: out });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    return await handle(req);
  } catch (e) {
    console.error("sweep:", e);
    return json({ error: "The sweep failed." }, 500);
  }
});
