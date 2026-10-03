// The content cycle: the four steps someone has to deliver.
//
//   Script written  ->  Shot & footage uploaded  ->  Edit complete  ->  Posted
//
// Approving is the CEO's job but carries no deadline of its own: a review is
// measured against the step it is reviewing (see STAGE_DEADLINE), so nothing
// waits on a date that exists only to describe the CEO's own turnaround.
//
// Picking a start date fills these in as a suggestion, spaced roughly a week
// apart. They are ordinary dates afterwards and can be moved to any pace —
// four videos in a week, or one over a month.

import { calendarDate } from "./utils";

export type DeadlineField = "scriptDue" | "shootDue" | "editDue" | "publishDue";

/**
 * A deadline a step can be measured against. The voice over has one of its own,
 * set when the script is approved, but it is not one of the four planned dates.
 */
export type StepDue = DeadlineField | "voDue";

/** The timestamp that marks a step as done. */
export type DoneField =
  | "scriptSubmittedAt"
  | "scriptApprovedAt"
  | "shootCompletedAt"
  | "voCompletedAt"
  | "editSubmittedAt"
  | "editApprovedAt"
  | "publishedAt";

export type Step = {
  field: DeadlineField;
  done: DoneField;
  label: string;
  who: string;
  /** Days after the cycle's start, used only to suggest a first set of dates. */
  offset: number;
};

export const STEPS: Step[] = [
  {
    field: "scriptDue",
    done: "scriptSubmittedAt",
    label: "Script written",
    who: "Scriptwriter",
    offset: 3,
  },
  {
    field: "shootDue",
    done: "shootCompletedAt",
    label: "Shot & footage uploaded",
    who: "Cameraman",
    offset: 11,
  },
  {
    field: "editDue",
    done: "editSubmittedAt",
    label: "Edit complete",
    who: "Editor",
    offset: 18,
  },
  {
    field: "publishDue",
    done: "publishedAt",
    label: "Posted",
    who: "Posting team",
    offset: 25,
  },
];

/** Which deadline a video is working against while it sits in a stage. */
export const STAGE_DEADLINE: Record<string, DeadlineField | null> = {
  planned: "scriptDue",
  scripting: "scriptDue",
  shooting: "shootDue",
  editing: "editDue",
  ready: "publishDue",
  published: null,
  // The three CEO gates have no deadline of their own. Each keeps counting
  // against the step it is reviewing, so a video held up in review still shows
  // as late — the delay lands on the step, which is where it is felt.
  script_review: "scriptDue",
  footage_review: "shootDue",
  edit_review: "editDue",
};

/**
 * The deadline a particular video is working against right now. Usually the
 * stage decides it, except a video with no shoot, which is waiting on the voice
 * over alone and so runs to that date instead.
 */
export function deadlineFor(item: {
  stage: string;
  shootNeeded?: boolean;
  voNeeded?: boolean;
}): StepDue | null {
  if (item.stage === "shooting" && item.shootNeeded === false && item.voNeeded) return "voDue";
  return STAGE_DEADLINE[item.stage] ?? null;
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** A suggested date for each step, from a cycle start (a midday-UTC calendar date). */
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
