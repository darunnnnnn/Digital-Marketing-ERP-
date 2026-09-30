// Validation for the Plan content form, away from the component so the rules
// can be read — and tested — on their own.
//
// Everything here is checked again in the database: row level security decides
// whether the person may insert at all, and the foreign keys decide whether an
// assignee really exists in this agency. This is the friendly first pass.

import { STEPS, type DeadlineField } from "@/lib/schedule";
import { parseDateInput } from "@/lib/utils";
import type { MemberOption } from "./types";

export type PlanValues = {
  clientId: string;
  /** "ideas" — a line per video; "count" — the writer proposes them. */
  mode: "ideas" | "count";
  ideas: string;
  count: string;
  /** "script" — only the writer's deadline; "full" — the whole four-week cycle. */
  planMode: "script" | "full";
  weekStart: string;
  format: string;
  priority: string;
  scriptwriterId: string;
  cameramanId: string;
  editorId: string;
  publisherId: string;
  dates: Record<DeadlineField, string>;
};

/** The day after, for the CEO's own review deadline. */
export function dayAfter(date: string) {
  const d = parseDateInput(date);
  if (!d) return "";
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The titles this form will create, one per video. */
export function titlesFor(v: PlanValues) {
  if (v.mode === "count") {
    const count = Number(v.count);
    if (!Number.isInteger(count) || count < 1 || count > 50) return null;
    return Array.from({ length: count }, (_, i) => `Untitled script ${i + 1}`);
  }
  return v.ideas
    .split("\n")
    .map((line) => line.replace(/^\s*[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 50);
}

export function validatePlan(v: PlanValues, members: MemberOption[]) {
  const errors: Record<string, string> = {};
  const titles = titlesFor(v);

  if (v.mode === "count") {
    if (titles === null) errors.count = "Enter a number between 1 and 50.";
    if (!v.scriptwriterId) errors.scriptwriterId = "Choose who is writing these scripts.";
  } else {
    if (!titles || titles.length === 0) errors.ideas = "Add at least one idea.";
    else if (titles.some((t) => t.length > 120)) {
      errors.ideas = "Keep each idea under 120 characters.";
    }
  }

  if (!v.clientId) errors.clientId = "Pick a client.";

  // Two ways to plan: the script deadline alone, or the whole cycle up front.
  const deadlines: Partial<Record<DeadlineField, string>> = {};

  if (v.planMode === "full") {
    for (const step of STEPS) deadlines[step.field] = v.dates[step.field];
    // "YYYY-MM-DD" strings compare correctly as text.
    for (let i = 1; i < STEPS.length; i++) {
      const [before, after] = [deadlines[STEPS[i - 1].field], deadlines[STEPS[i].field]];
      if (before && after && after < before) {
        errors.schedule = `"${STEPS[i].label}" can't be due before "${STEPS[i - 1].label}".`;
        break;
      }
    }
  } else {
    // Only the script is scheduled; every later deadline is set at its gate.
    if (!v.dates.scriptDue) errors.scriptDue = "Set the deadline for the script.";
    if (!v.scriptwriterId) errors.scriptwriterId = "Choose who is writing.";
    deadlines.scriptDue = v.dates.scriptDue;
    // The CEO's own review gets the next day, so it doesn't sit undated.
    deadlines.scriptApprovalDue = dayAfter(v.dates.scriptDue);
  }

  const has = (id: string, role: string) =>
    members.some((m) => m.id === id && m.role === role);

  if (v.scriptwriterId && !has(v.scriptwriterId, "scriptwriter")) {
    errors.scriptwriterId = "Pick a scriptwriter from your team.";
  }

  // Up-front assignments are only offered when planning the whole cycle.
  const assignees: Record<string, string> = {};
  if (v.planMode === "full") {
    for (const [field, role, label] of [
      ["cameramanId", "cameraman", "cameraman"],
      ["editorId", "editor", "editor"],
      ["publisherId", "publisher", "posting person"],
    ] as const) {
      const id = v[field];
      if (!id) continue;
      if (has(id, role)) assignees[field] = id;
      else errors[field] = `Pick a ${label} from your team.`;
    }
  }

  return { errors, titles: titles ?? [], deadlines, assignees };
}
