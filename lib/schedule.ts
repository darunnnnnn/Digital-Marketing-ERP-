// The four-week content cycle.
//
//   Week 1  script written, then approved by the CEO
//   Week 2  shot, raw footage uploaded
//   Week 3  edited
//   Week 4  final video approved by the CEO, then posted
//
// Every video gets a deadline for each step, counted in days from the Monday
// its cycle starts. Deadlines are ordinary dates afterwards and can be moved.

import { calendarDate } from "./utils";

export type DeadlineField =
  | "scriptDue"
  | "scriptApprovalDue"
  | "shootDue"
  | "editDue"
  | "finalApprovalDue"
  | "publishDue";

/** The timestamp that marks a step as done. */
export type DoneField =
  | "scriptSubmittedAt"
  | "scriptApprovedAt"
  | "shootCompletedAt"
  | "editSubmittedAt"
  | "editApprovedAt"
  | "publishedAt";

export type Step = {
  field: DeadlineField;
  done: DoneField;
  label: string;
  who: string;
  week: number;
  /** Days after the cycle's Monday. */
  offset: number;
};

export const STEPS: Step[] = [
  {
    field: "scriptDue",
    done: "scriptSubmittedAt",
    label: "Script written",
    who: "Scriptwriter",
    week: 1,
    offset: 3,
  },
  {
    field: "scriptApprovalDue",
    done: "scriptApprovedAt",
    label: "Script approved",
    who: "CEO",
    week: 1,
    offset: 4,
  },
  {
    field: "shootDue",
    done: "shootCompletedAt",
    label: "Shot & footage uploaded",
    who: "Cameraman",
    week: 2,
    offset: 11,
  },
  {
    field: "editDue",
    done: "editSubmittedAt",
    label: "Edit complete",
    who: "Editor",
    week: 3,
    offset: 18,
  },
  {
    field: "finalApprovalDue",
    done: "editApprovedAt",
    label: "Final video approved",
    who: "CEO",
    week: 4,
    offset: 22,
  },
  {
    field: "publishDue",
    done: "publishedAt",
    label: "Posted",
    who: "Posting team",
    week: 4,
    offset: 25,
  },
];

/** Which deadline a video is working against while it sits in a stage. */
export const STAGE_DEADLINE: Record<string, DeadlineField | null> = {
  planned: "scriptDue",
  scripting: "scriptDue",
  script_review: "scriptApprovalDue",
  shooting: "shootDue",
  // The CEO should turn footage around quickly, so it still counts against the
  // shoot deadline until an edit deadline is set.
  footage_review: "shootDue",
  editing: "editDue",
  edit_review: "finalApprovalDue",
  ready: "publishDue",
  published: null,
};

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** All six deadlines for a cycle starting on `start` (a midday-UTC calendar date). */
export function scheduleFrom(start: Date): Record<DeadlineField, Date> & { cycleStart: Date } {
  const out = { cycleStart: start } as Record<DeadlineField, Date> & { cycleStart: Date };
  for (const step of STEPS) out[step.field] = addDays(start, step.offset);
  return out;
}

/** The Monday of this week, or next Monday from Saturday onwards, as "YYYY-MM-DD". */
export function defaultCycleStart(today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = d.getDay(); // 0 Sun … 6 Sat
  const shift = day === 0 ? 1 : day === 6 ? 2 : 1 - day;
  d.setDate(d.getDate() + shift);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type StepStatus =
  | { kind: "done"; at: Date; late: boolean }
  | { kind: "late"; days: number }
  | { kind: "due"; days: number }
  | { kind: "unscheduled" };

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function stepStatus(
  due: Date | null,
  doneAt: Date | null,
  today = new Date(),
): StepStatus {
  if (doneAt) {
    // doneAt is a real moment, so compare its local calendar day.
    const doneDay = new Date(doneAt.getFullYear(), doneAt.getMonth(), doneAt.getDate());
    const late = Boolean(due) && doneDay > calendarDate(due!);
    return { kind: "done", at: doneAt, late };
  }
  if (!due) return { kind: "unscheduled" };

  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = daysBetween(calendarDate(due), t);
  return diff < 0 ? { kind: "late", days: -diff } : { kind: "due", days: diff };
}
