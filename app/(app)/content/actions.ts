"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  addContentNote,
  advanceContent,
  moveContent,
  planContent,
  removeContent,
  handOffContent,
  saveContentPanel,
  sendContentBack,
  setAssignee,
} from "@/lib/content-ops";
import {
  canAdvance,
  canAssign,
  canDeleteContent,
  canDrag,
  canEditPanel,
  canNote,
  canPlan,
  canSeeItem,
  canSendBack,
} from "@/lib/permissions";
import type { AssignField } from "@/lib/pipeline";
import { STEPS } from "@/lib/schedule";
import { parseDateInput } from "@/lib/utils";

export type ContentFormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

/**
 * The video, if it belongs to the signed-in person's agency and they are allowed
 * to see it. Anything else looks exactly like "not found", with no hint it exists.
 */
async function loadItem(id: string) {
  const user = await requireUser();
  if (!id) return { user, item: null };
  const item = await db.contentItem.findFirst({ where: { id, agencyId: user.agencyId } });
  return { user, item: item && canSeeItem(user, item) ? item : null };
}

/** A member of the same agency, so nobody can be assigned across workspaces. */
async function sameAgencyMember(memberId: string, agencyId: string, role?: string) {
  if (!memberId) return null;
  return db.member.findFirst({
    where: { id: memberId, agencyId, active: true, ...(role ? { role } : {}) },
  });
}

/** The day after, for the CEO's own review deadline. */
function dayAfter(date: string) {
  const d = parseDateInput(date);
  if (!d) return "";
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function refresh(id?: string) {
  revalidatePath("/content");
  revalidatePath("/clients");
  if (id) revalidatePath(`/content/${id}`);
}

export async function createContent(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const values = {
    clientId: text(formData, "clientId"),
    ideas: text(formData, "ideas"),
    format: text(formData, "format") || "reel",
    priority: text(formData, "priority") || "normal",
    weekStart: text(formData, "weekStart"),
    scriptwriterId: text(formData, "scriptwriterId"),
    ...Object.fromEntries(STEPS.map((step) => [step.field, text(formData, step.field)])),
  } as Record<string, string>;

  const errors: Record<string, string> = {};
  const byCount = text(formData, "mode") === "count";

  // Either a list of ideas, or a number of scripts for the writer to propose.
  let titles: string[] = [];
  if (byCount) {
    const count = Number(text(formData, "count"));
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      errors.count = "Enter a number between 1 and 50.";
    } else {
      titles = Array.from({ length: count }, (_, i) => `Untitled script ${i + 1}`);
    }
    if (!values.scriptwriterId) {
      errors.scriptwriterId = "Choose who is writing these scripts.";
    }
  } else {
    titles = values.ideas
      .split("\n")
      .map((line) => line.replace(/^\s*[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 50);
    if (titles.length === 0) errors.ideas = "Add at least one idea.";
    else if (titles.some((t) => t.length > 120)) {
      errors.ideas = "Keep each idea under 120 characters.";
    }
  }

  if (!values.clientId) errors.clientId = "Pick a client.";

  // Two ways to plan: the script deadline alone, or the whole cycle up front.
  const wholeCycle = text(formData, "planMode") === "full";
  const deadlines: Record<string, string> = {};

  if (wholeCycle) {
    for (const step of STEPS) deadlines[step.field] = values[step.field];
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
    if (!values.scriptDue) errors.scriptDue = "Set the deadline for the script.";
    if (!values.scriptwriterId) errors.scriptwriterId = "Choose who is writing.";
    deadlines.scriptDue = values.scriptDue;
    // The CEO's own review gets the next day, so it doesn't sit undated.
    deadlines.scriptApprovalDue = dayAfter(values.scriptDue);
  }

  const user = await requireUser();
  if (!canPlan(user)) {
    return { errors: { clientId: "Only the CEO or a manager can plan content." }, values };
  }

  if (
    values.scriptwriterId &&
    !(await sameAgencyMember(values.scriptwriterId, user.agencyId, "scriptwriter"))
  ) {
    errors.scriptwriterId = "Pick a scriptwriter from your team.";
  }

  // Up-front assignments are only offered when planning the whole cycle.
  const assignees: Record<string, string> = {};
  if (wholeCycle) {
    for (const [field, role, label] of [
      ["cameramanId", "cameraman", "cameraman"],
      ["editorId", "editor", "editor"],
      ["publisherId", "publisher", "posting person"],
    ] as const) {
      const id = text(formData, field);
      if (!id) continue;
      if (await sameAgencyMember(id, user.agencyId, role)) assignees[field] = id;
      else errors[field] = `Pick a ${label} from your team.`;
    }
  }

  if (Object.keys(errors).length > 0) return { errors, values };

  const result = await planContent({
    agencyId: user.agencyId,
    actor: user.name,
    titles,
    clientId: values.clientId,
    format: values.format,
    priority: values.priority,
    // Blank in script-only mode, so no later deadline is invented.
    weekStart: wholeCycle ? values.weekStart : "",
    scriptwriterId: values.scriptwriterId,
    deadlines,
    assignees,
  });

  if ("error" in result && result.error) {
    return { errors: { clientId: result.error }, values };
  }

  refresh();
  if (result.ids.length === 1) redirect(`/content/${result.ids[0]}`);
  redirect(`/content?client=${result.clientId}`);
}

export async function advanceStage(formData: FormData) {
  const { user, item } = await loadItem(text(formData, "id"));
  if (!item || !canAdvance(user, item)) return;
  if (await advanceContent(item.id, user.name)) refresh(item.id);
}

/** Called by drag and drop on the board. */
export async function moveToStage(id: string, to: string) {
  const { user, item } = await loadItem(id);
  if (!item || !canDrag(user)) return;
  if (await moveContent(item.id, to, user.name)) refresh(item.id);
}

/** A CEO gate: approve, assign the next person, set their deadline. */
export async function handOffStage(
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const { user, item } = await loadItem(text(formData, "id"));
  if (!item || !canAdvance(user, item)) {
    return { errors: { memberId: "You can't approve this step." } };
  }

  const error = await handOffContent({
    id: item.id,
    memberId: text(formData, "memberId"),
    due: text(formData, "due"),
    note: text(formData, "note"),
    actor: user.name,
  });

  if (error) {
    return {
      errors: error.startsWith("Set a deadline") ? { due: error } : { memberId: error },
    };
  }

  refresh(item.id);
  return {};
}

export async function sendBack(formData: FormData) {
  const { user, item } = await loadItem(text(formData, "id"));
  if (!item || !canSendBack(user, item)) return;
  if (await sendContentBack(item.id, text(formData, "note"), user.name)) refresh(item.id);
}

export async function assignMember(formData: FormData) {
  const { user, item } = await loadItem(text(formData, "id"));
  if (!item || !canAssign(user)) return;

  const memberId = text(formData, "memberId");
  if (memberId && !(await sameAgencyMember(memberId, user.agencyId))) return;

  const field = text(formData, "field") as AssignField;
  if (await setAssignee(item.id, field, memberId, user.name)) refresh(item.id);
}

export async function saveStageDetails(
  id: string,
  _prev: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const panel = text(formData, "panel");
  const { user, item } = await loadItem(id);
  if (!item) return { errors: { panel: "This video no longer exists." } };
  if (!canEditPanel(user, item, panel)) {
    return { errors: { panel: "You don't have permission to change this." } };
  }

  const error = await saveContentPanel(item.id, panel, (key) => text(formData, key));
  if (error) return { errors: { link: error } };

  refresh(item.id);
  return {};
}

export async function addNote(formData: FormData) {
  const { user, item } = await loadItem(text(formData, "id"));
  if (!item || !canNote(user, item)) return;
  if (await addContentNote(item.id, text(formData, "message"), user.name)) refresh(item.id);
}

export async function deleteContent(formData: FormData) {
  const { user, item } = await loadItem(text(formData, "id"));
  if (!item || !canDeleteContent(user)) return;

  await removeContent(item.id);

  refresh();
  redirect("/content");
}
