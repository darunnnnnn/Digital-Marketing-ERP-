// Per-person performance for a month: what they finished, how late, and what
// they are holding right now. Everything is derived from the stage timestamps
// the pipeline already records — nobody reports anything by hand.

import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { DeadlineField } from "./schedule";
import { calendarDate } from "./utils";

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
  ceo: [
    {
      label: "Scripts approved",
      assign: null,
      done: "scriptApprovedAt",
      due: "scriptApprovalDue",
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
      due: "finalApprovalDue",
      stage: "edit_review",
      sentBackTo: null,
    },
  ],
  manager: [],
};

/** The assignment field that makes someone the owner of a role's step. */
const ROLE_ASSIGN: Record<string, AssignField> = {
  scriptwriter: "scriptwriterId",
  cameraman: "cameramanId",
  editor: "editorId",
  publisher: "publisherId",
};

const ASSIGN_ROLE = Object.fromEntries(
  Object.entries(ROLE_ASSIGN).map(([role, field]) => [field, role]),
) as Record<AssignField, string>;

export const ASSIGN_FIELDS = Object.values(ROLE_ASSIGN);

/**
 * The steps one person is measured and paid on.
 *
 * `Member.role` is a job title, not the whole truth: the four assignment
 * fields on a video are independent, so a scriptwriter can be handed the edit
 * on one video and the shoot on another. Counting only the declared role meant
 * that work vanished — it never showed in their queue and, because pay is
 * rate × deliveries, they were never paid for it.
 *
 * So the roles someone works are their declared one plus every role they hold
 * an assignment for. The CEO assigning them to a step is the statement that
 * they do that job; nobody has to maintain a second list by hand.
 */
export function stepsForRoles(roles: Iterable<string>): RoleStep[] {
  const steps: RoleStep[] = [];
  const seen = new Set<string>();
  for (const role of roles) {
    for (const step of ROLE_STEPS[role] ?? []) {
      // Two roles can nominate the same step; count it once.
      const key = `${step.assign ?? "agency"}:${step.done}`;
      if (seen.has(key)) continue;
      seen.add(key);
      steps.push(step);
    }
  }
  return steps;
}

/**
 * Which roles each of these people actually works, in one query rather than
 * one per person — the payouts and team pages ask about everybody at once.
 */
export async function rolesByMember(
  agencyId: string,
  members: { id: string; role: string }[],
): Promise<Map<string, string[]>> {
  const ids = members.map((m) => m.id);
  const roles = new Map(members.map((m) => [m.id, new Set([m.role])]));
  if (ids.length === 0) return new Map();

  const rows = await db.contentItem.findMany({
    where: {
      agencyId,
      OR: ASSIGN_FIELDS.map((field) => ({ [field]: { in: ids } })),
    },
    select: {
      scriptwriterId: true,
      cameramanId: true,
      editorId: true,
      publisherId: true,
    },
  });

  for (const row of rows) {
    for (const field of ASSIGN_FIELDS) {
      const holder = row[field];
      if (holder) roles.get(holder)?.add(ASSIGN_ROLE[field]);
    }
  }

  return new Map([...roles].map(([id, set]) => [id, [...set]]));
}

/** The same thing for one person. */
export async function rolesForMember(member: { id: string; role: string; agencyId: string }) {
  const map = await rolesByMember(member.agencyId, [member]);
  return map.get(member.id) ?? [member.role];
}

/** Human-readable, for "Scriptwriter · Editor" under someone's name. */
export function extraRoles(roles: string[], declared: string) {
  return roles.filter((r) => r !== declared);
}

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

type Row = Prisma.ContentItemGetPayload<{ include: { client: { select: { name: true } } } }>;

export async function memberPerformance(
  member: { id: string; name: string; role: string; agencyId: string },
  monthKey: string,
  today = new Date(),
  /** Pass this when looping over a team, so the roles lookup runs once. */
  knownRoles?: string[],
): Promise<Performance> {
  const roles = knownRoles ?? (await rolesForMember(member));
  const steps = stepsForRoles(roles);
  const { start, end } = monthRange(monthKey);
  const todayDay = localDay(today);
  const weekOut = new Date(todayDay.getTime() + 7 * 86_400_000);

  const completed: WorkRow[] = [];
  const open: WorkRow[] = [];
  let revisions = 0;

  // Every step's queries go out at once — one database round trip for the
  // whole person, instead of two or three per step, one step after another.
  const fetched = await Promise.all(
    steps.map((step) => {
      const mine: Prisma.ContentItemWhereInput = step.assign
        ? { agencyId: member.agencyId, [step.assign]: member.id }
        : { agencyId: member.agencyId };

      return Promise.all([
        db.contentItem.findMany({
          where: { ...mine, [step.done]: { gte: start, lt: end } },
          include: { client: { select: { name: true } } },
        }),
        db.contentItem.findMany({
          where: { ...mine, stage: step.stage },
          include: { client: { select: { name: true } } },
        }),
        // Send-backs to this person's step, on videos they are assigned to.
        step.sentBackTo && step.assign
          ? db.contentEvent.count({
              where: {
                kind: "revision",
                createdAt: { gte: start, lt: end },
                message: { startsWith: `Sent back to ${step.sentBackTo}` },
                content: mine,
              },
            })
          : Promise.resolve(0),
      ]) as Promise<[Row[], Row[], number]>;
    }),
  );

  steps.forEach((step, i) => {
    const [doneRows, openRows, sentBack] = fetched[i];
    revisions += sentBack;

    for (const r of doneRows) {
      const doneAt = r[step.done] as Date;
      const due = r[step.due] as Date | null;
      completed.push({
        id: r.id,
        ref: r.ref,
        title: r.title,
        client: r.client.name,
        step: step.label,
        due,
        doneAt,
        lateDays: daysLate(due, doneAt),
      });
    }

    for (const r of openRows) {
      const due = r[step.due] as Date | null;
      open.push({
        id: r.id,
        ref: r.ref,
        title: r.title,
        client: r.client.name,
        step: step.label,
        due,
        doneAt: null,
        lateDays: daysLate(due, today),
      });
    }
  });

  completed.sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0));
  // Most overdue first, then soonest due.
  open.sort(
    (a, b) =>
      b.lateDays - a.lateDays ||
      (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity),
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
      dueThisWeek: open.filter(
        (r) => r.lateDays === 0 && r.due && calendarDate(r.due) < weekOut,
      ).length,
      revisions,
    },
    completed,
    open,
    byClient: [...clients.entries()]
      .map(([client, v]) => ({ client, ...v }))
      .sort((a, b) => b.done - a.done),
  };
}
