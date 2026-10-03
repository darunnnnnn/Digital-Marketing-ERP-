// Per-person performance for a month: what they finished, how late, and what
// they are holding right now. Everything is derived from the stage timestamps
// the pipeline already records — nobody reports anything by hand.
//
// The old build asked the database two or three questions per step, per person.
// Here one pass fetches the month's videos once and every person is measured
// against that same set in memory, so the team and payout pages cost two round
// trips no matter how many people are on the team.

import { supabase } from "./supabase";
import type { DeadlineField } from "./schedule";
import { memberRoles } from "./roles";
import { calendarDate, toDate } from "./utils";

type AssignField = "scriptwriterId" | "cameramanId" | "editorId" | "publisherId";
type DoneField =
  | "editStartedAt"
  | "scriptSubmittedAt"
  | "scriptApprovedAt"
  | "shootCompletedAt"
  | "editSubmittedAt"
  | "editApprovedAt"
  | "publishedAt";

/** One step of the pipeline a role is responsible for. */
export type RoleStep = {
  label: string;
  /** Null for the CEO, whose approvals cover the whole agency. */
  assign: AssignField | null;
  done: DoneField;
  due: DeadlineField;
  /** The stage a video sits in while this step is still to do. */
  stage: string;
  /** How a send-back to this step is written in the activity log. */
  sentBackTo: string | null;
};

export const ROLE_STEPS: Record<string, RoleStep[]> = {
  scriptwriter: [
    {
      label: "Scripts written",
      assign: "scriptwriterId",
      done: "scriptSubmittedAt",
      due: "scriptDue",
      stage: "scripting",
      sentBackTo: "Scripting",
    },
  ],
  cameraman: [
    {
      label: "Shoots delivered",
      assign: "cameramanId",
      done: "shootCompletedAt",
      due: "shootDue",
      stage: "shooting",
      sentBackTo: "Shooting",
    },
  ],
  editor: [
    {
      label: "Edits delivered",
      assign: "editorId",
      done: "editSubmittedAt",
      due: "editDue",
      stage: "editing",
      sentBackTo: "Editing",
    },
  ],
  publisher: [
    {
      label: "Videos posted",
      assign: "publisherId",
      done: "publishedAt",
      due: "publishDue",
      stage: "ready",
      sentBackTo: "Ready to post",
    },
  ],
  // The CEO owns no delivery step, so each approval is measured against the
  // deadline of the step it is reviewing rather than a date of its own.
  ceo: [
    {
      label: "Scripts approved",
      assign: null,
      done: "scriptApprovedAt",
      due: "scriptDue",
      stage: "script_review",
      sentBackTo: null,
    },
    {
      label: "Footage approved",
      assign: null,
      done: "editStartedAt",
      due: "shootDue",
      stage: "footage_review",
      sentBackTo: null,
    },
    {
      label: "Final videos approved",
      assign: null,
      done: "editApprovedAt",
      due: "editDue",
      stage: "edit_review",
      sentBackTo: null,
    },
  ],
  manager: [],
};

export type WorkRow = {
  id: string;
  ref: number;
  title: string;
  client: string;
  step: string;
  due: Date | null;
  doneAt: Date | null;
  /** Days past the deadline: when finished, or as of today if still open. */
  lateDays: number;
};

export type Summary = {
  done: number;
  onTime: number;
  late: number;
  /** 0–100, or null when nothing was finished. */
  onTimeRate: number | null;
  /** Average days late, across the late ones only. */
  avgLag: number;
  maxLag: number;
  inProgress: number;
  overdueNow: number;
  dueThisWeek: number;
  revisions: number;
};

export type Performance = {
  summary: Summary;
  completed: WorkRow[];
  open: WorkRow[];
  byClient: { client: string; done: number; late: number }[];
};

/** Local midnight on the 1st of the month, and of the month after. */
export function monthRange(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

export function shiftMonth(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function localDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysLate(due: Date | null, at: Date) {
  if (!due) return 0;
  const diff = Math.round((localDay(at).getTime() - calendarDate(due).getTime()) / 86_400_000);
  return Math.max(0, diff);
}

/** The columns performance needs — not the whole row, since scripts are long. */
const PERF_COLUMNS = `
  id, ref, title, stage, revisions,
  scriptwriterId, cameramanId, editorId, publisherId,
  scriptSubmittedAt, scriptApprovedAt, shootCompletedAt,
  editStartedAt, editSubmittedAt, editApprovedAt, publishedAt,
  scriptDue, shootDue, editDue, publishDue,
  client:Client(name)
`;

type PerfItem = Record<string, unknown> & {
  id: string;
  ref: number;
  title: string;
  stage: string;
  client: { name: string } | null;
};

/** One fetch of everything the month's numbers are derived from. */
export type PerfSource = {
  items: PerfItem[];
  /** Send-backs in the month, as `contentId` → which steps they landed on. */
  revisions: { contentId: string; message: string }[];
};

export async function loadPerfSource(agencyId: string, monthKey: string): Promise<PerfSource> {
  const { start, end } = monthRange(monthKey);

  const [items, events] = await Promise.all([
    supabase.from("ContentItem").select(PERF_COLUMNS).eq("agencyId", agencyId),
    supabase
      .from("ContentEvent")
      .select("contentId, message")
      .eq("kind", "revision")
      .gte("createdAt", start.toISOString())
      .lt("createdAt", end.toISOString()),
  ]);

  if (items.error) throw new Error(`Couldn't load performance: ${items.error.message}`);

  return {
    items: (items.data ?? []) as unknown as PerfItem[],
    revisions: (events.data ?? []) as { contentId: string; message: string }[],
  };
}

/**
 * One person's month, measured against an already-fetched set of videos.
 * Pure: no database, so the team page can measure everyone from one source.
 */
export function measureMember(
  member: { id: string; role: string; roles?: string[] | null },
  monthKey: string,
  source: PerfSource,
  today = new Date(),
): Performance {
  // Someone who writes and edits is measured on both steps.
  const steps = memberRoles(member).flatMap((r) => ROLE_STEPS[r] ?? []);
  const { start, end } = monthRange(monthKey);
  const todayDay = localDay(today);
  const weekOut = new Date(todayDay.getTime() + 7 * 86_400_000);

  const completed: WorkRow[] = [];
  const open: WorkRow[] = [];
  let revisions = 0;

  // Which videos each person's send-backs could belong to.
  const byId = new Map(source.items.map((i) => [i.id, i]));

  for (const step of steps) {
    const mine = (item: PerfItem) => (step.assign ? item[step.assign] === member.id : true);

    for (const item of source.items) {
      if (!mine(item)) continue;
      const base = {
        id: item.id,
        ref: item.ref,
        title: item.title,
        client: item.client?.name ?? "—",
        step: step.label,
      };

      const doneAt = toDate(item[step.done] as string | null);
      const due = toDate(item[step.due] as string | null);

      // Finished this month.
      if (doneAt && doneAt >= start && doneAt < end) {
        completed.push({ ...base, due, doneAt, lateDays: daysLate(due, doneAt) });
      }
      // Sitting on this step right now, whichever month it was planned for.
      if (item.stage === step.stage) {
        open.push({ ...base, due, doneAt: null, lateDays: daysLate(due, today) });
      }
    }

    if (step.sentBackTo && step.assign) {
      const prefix = `Sent back to ${step.sentBackTo}`;
      for (const ev of source.revisions) {
        const item = byId.get(ev.contentId);
        if (!item || item[step.assign] !== member.id) continue;
        if (ev.message.startsWith(prefix)) revisions++;
      }
    }
  }

  completed.sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0));
  // Most overdue first, then soonest due.
  open.sort(
    (a, b) =>
      b.lateDays - a.lateDays || (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity),
  );

  const late = completed.filter((r) => r.lateDays > 0);
  const lagTotal = late.reduce((sum, r) => sum + r.lateDays, 0);

  const clients = new Map<string, { done: number; late: number }>();
  for (const r of completed) {
    const c = clients.get(r.client) ?? { done: 0, late: 0 };
    c.done++;
    if (r.lateDays > 0) c.late++;
    clients.set(r.client, c);
  }

  return {
    summary: {
      done: completed.length,
      onTime: completed.length - late.length,
      late: late.length,
      onTimeRate: completed.length
        ? Math.round(((completed.length - late.length) / completed.length) * 100)
        : null,
      avgLag: late.length ? Math.round((lagTotal / late.length) * 10) / 10 : 0,
      maxLag: late.reduce((max, r) => Math.max(max, r.lateDays), 0),
      inProgress: open.length,
      overdueNow: open.filter((r) => r.lateDays > 0).length,
      dueThisWeek: open.filter((r) => r.lateDays === 0 && r.due && calendarDate(r.due) < weekOut)
        .length,
      revisions,
    },
    completed,
    open,
    byClient: [...clients.entries()]
      .map(([client, v]) => ({ client, ...v }))
      .sort((a, b) => b.done - a.done),
  };
}

/** One person, fetching their own source. Used by the profile page. */
export async function memberPerformance(
  member: { id: string; role: string; roles?: string[] | null; agencyId: string },
  monthKey: string,
  today = new Date(),
) {
  const source = await loadPerfSource(member.agencyId, monthKey);
  return measureMember(member, monthKey, source, today);
}
