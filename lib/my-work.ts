// What one person actually has to do. Creative roles never see the agency
// board; they get their own queue, built from every step they are responsible
// for — which is not always just the one their job title names.

import { db } from "./db";
import { memberPerformance, rolesForMember, stepsForRoles, type RoleStep } from "./performance";
import { stageIndex } from "./pipeline";
import { calendarDate, currentMonthKey } from "./utils";

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

const ASSIGN_TASK: Record<string, { noun: string; verb: string }> = {
  scriptwriterId: ROLE_TASK.scriptwriter,
  cameramanId: ROLE_TASK.cameraman,
  editorId: ROLE_TASK.editor,
  publisherId: ROLE_TASK.publisher,
};

/** What this step asks of whoever holds it. */
function taskForStep(step: RoleStep) {
  return (step.assign ? ASSIGN_TASK[step.assign] : null) ?? { noun: "task", verb: "Your step" };
}

export type WorkItem = {
  id: string;
  ref: number;
  title: string;
  client: string;
  stage: string;
  due: Date | null;
  /** What this particular item needs from them — "Edit the video". */
  verb: string;
  /** "script", "edit"… for counting a mixed queue in plain language. */
  noun: string;
};

export async function myWork(user: { id: string; role: string; agencyId: string }) {
  const roles = await rolesForMember(user);
  // Only the steps that are actually handed to a person; the CEO's agency-wide
  // approval steps have no assignee and belong on the board, not in a queue.
  const steps = stepsForRoles(roles).filter((step) => step.assign);
  if (steps.length === 0) return null;

  // Their queue and their month's numbers are independent — fetch together.
  const [perStep, { summary }] = await Promise.all([
    Promise.all(
      steps.map((step) =>
        db.contentItem.findMany({
          where: {
            agencyId: user.agencyId,
            [step.assign!]: user.id,
            stage: { not: "published" },
          },
          include: { client: { select: { name: true } } },
          orderBy: [{ [step.due]: "asc" }, { ref: "asc" }],
        }),
      ),
    ),
    // How their month is going, so the dashboard shows progress, not just a list.
    memberPerformance({ ...user, name: "" }, currentMonthKey(), new Date(), roles),
  ]);

  const todo: WorkItem[] = [];
  const upcoming: WorkItem[] = [];
  const handedOn: WorkItem[] = [];

  steps.forEach((step, i) => {
    const task = taskForStep(step);
    const mine = stageIndex(step.stage);

    for (const r of perStep[i]) {
      const item: WorkItem = {
        id: r.id,
        ref: r.ref,
        title: r.title,
        client: r.client.name,
        stage: r.stage,
        due: (r[step.due] as Date | null) ?? null,
        verb: task.verb,
        noun: task.noun,
      };

      // Which list it belongs in is per step, not per person: the same video
      // can be waiting on their edit while their script on it is long done.
      if (r.stage === step.stage) todo.push(item);
      else if (stageIndex(r.stage) < mine) upcoming.push(item);
      else handedOn.push(item);
    }
  });

  const byDue = (a: WorkItem, b: WorkItem) =>
    (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity) || a.ref - b.ref;

  return {
    steps,
    roles,
    /** Only set when they do one job, so the page can name it in the heading. */
    task: steps.length === 1 ? taskForStep(steps[0]) : null,
    month: summary,
    /** On their desk right now. */
    todo: todo.sort(byDue),
    /** Assigned to them, but an earlier step is still running. */
    upcoming: upcoming.sort(byDue),
    /** Already handed on — with the CEO or someone else. */
    handedOn: handedOn.sort(byDue),
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
