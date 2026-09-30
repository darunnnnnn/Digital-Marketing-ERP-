// What one person actually has to do. Creative roles never see the agency
// board; they get their own queue, built from the single step their role owns.

import { supabase } from "./supabase";
import { ROLE_STEPS, loadPerfSource, measureMember } from "./performance";
import { stageIndex } from "./pipeline";
import { calendarDate, currentMonthKey, toDate } from "./utils";

/** The panel on the video page that this role fills in. */
export const ROLE_PANEL: Record<string, string> = {
  scriptwriter: "script",
  cameraman: "shoot",
  editor: "edit",
  publisher: "post",
};

/** Plain-language name for the thing they hand over. */
export const ROLE_TASK: Record<string, { noun: string; verb: string }> = {
  scriptwriter: { noun: "script", verb: "Write the script" },
  cameraman: { noun: "shoot", verb: "Shoot and upload the footage" },
  editor: { noun: "edit", verb: "Edit the video" },
  publisher: { noun: "post", verb: "Caption, schedule and post" },
};

export type WorkItem = {
  id: string;
  ref: number;
  title: string;
  client: string;
  stage: string;
  due: Date | null;
};

type Row = Record<string, unknown> & {
  id: string;
  ref: number;
  title: string;
  stage: string;
  client: { name: string } | null;
};

export async function myWork(user: { id: string; role: string; agencyId: string }) {
  const step = (ROLE_STEPS[user.role] ?? [])[0];
  if (!step || !step.assign) return null;

  // Their queue and their month's numbers are independent — fetch together.
  const [queue, source] = await Promise.all([
    supabase
      .from("ContentItem")
      .select(`id, ref, title, stage, ${step.due}, client:Client(name)`)
      .eq("agencyId", user.agencyId)
      .eq(step.assign, user.id)
      .neq("stage", "published")
      .order(step.due, { nullsFirst: false })
      .order("ref"),
    loadPerfSource(user.agencyId, currentMonthKey()),
  ]);

  if (queue.error) throw new Error(`Couldn't load your work: ${queue.error.message}`);
  const rows = (queue.data ?? []) as unknown as Row[];
  const { summary } = measureMember(user, currentMonthKey(), source);

  const mine = stageIndex(step.stage);
  const map = (r: Row): WorkItem => ({
    id: r.id,
    ref: r.ref,
    title: r.title,
    client: r.client?.name ?? "—",
    stage: r.stage,
    due: toDate(r[step.due] as string | null),
  });

  return {
    step,
    task: ROLE_TASK[user.role],
    month: summary,
    /** On their desk right now. */
    todo: rows.filter((r) => r.stage === step.stage).map(map),
    /** Assigned to them, but an earlier step is still running. */
    upcoming: rows.filter((r) => stageIndex(r.stage) < mine).map(map),
    /** Already handed on — with the CEO or someone else. */
    handedOn: rows.filter((r) => stageIndex(r.stage) > mine).map(map),
  };
}

export type Urgency = "overdue" | "today" | "week" | "later" | "undated";

/** Which bucket a deadline falls in, for grouping the dashboard. */
export function urgency(due: Date | null, today = new Date()): Urgency {
  if (!due) return "undated";
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((calendarDate(due).getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return days <= 7 ? "week" : "later";
}

export function groupByUrgency(items: WorkItem[], today = new Date()) {
  const groups: Record<Urgency, WorkItem[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    undated: [],
  };
  for (const item of items) groups[urgency(item.due, today)].push(item);
  return groups;
}
