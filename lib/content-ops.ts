// Every mutation the content pipeline performs, with no framework imports.
// The server actions in app/content/actions.ts are thin wrappers around these,
// which keeps the rules testable on their own.

import { db } from "./db";
import {
  handoff,
  isStage,
  nextStage,
  prevStage,
  stageConfig,
  type AssignField,
  type Stage,
} from "./pipeline";
import { PRICE_FIELDS, priceLabel, type PriceField } from "./pricing";
import { STEPS, scheduleFrom, type DeadlineField } from "./schedule";
import { currentMonthKey, parseDateInput } from "./utils";

export const ASSIGN_FIELDS: AssignField[] = [
  "scriptwriterId",
  "cameramanId",
  "editorId",
  "publisherId",
];

/** Timestamps a stage owns when a piece lands on it. */
export function enterStage(to: Stage): Record<string, Date | null> {
  switch (to) {
    case "script_review":
      return { scriptSubmittedAt: new Date() };
    case "shooting":
      return { scriptApprovedAt: new Date() };
    case "footage_review":
      return { shootCompletedAt: new Date() };
    case "editing":
      return { editStartedAt: new Date() };
    case "edit_review":
      return { editSubmittedAt: new Date() };
    case "ready":
      return { editApprovedAt: new Date() };
    case "published":
      return { publishedAt: new Date() };
    default:
      return {};
  }
}

/** Undone when a piece is sent back out of a stage. */
export function leaveStage(from: Stage): Record<string, Date | null> {
  switch (from) {
    case "script_review":
      return { scriptSubmittedAt: null };
    case "footage_review":
      return { shootCompletedAt: null };
    case "editing":
      return { editStartedAt: null };
    case "edit_review":
      return { editSubmittedAt: null };
    case "ready":
      return { editApprovedAt: null };
    case "published":
      return { publishedAt: null };
    default:
      return {};
  }
}

async function ownerName(item: {
  stage: string;
  scriptwriterId: string | null;
  cameramanId: string | null;
  editorId: string | null;
  publisherId: string | null;
}) {
  const field = stageConfig(item.stage).assign;
  if (!field) return null;
  const id = item[field];
  if (!id) return null;
  const member = await db.member.findUnique({ where: { id } });
  return member?.name ?? null;
}

export type PlanInput = {
  agencyId: string;
  clientId: string;
  titles: string[];
  format: string;
  priority: string;
  /** Monday the four-week cycle starts, "YYYY-MM-DD". Empty means unscheduled. */
  weekStart: string;
  scriptwriterId: string;
  /** Per-step dates chosen in the plan dialog; any left blank use the default. */
  deadlines?: Partial<Record<DeadlineField, string>>;
  /** Who planned it, for the activity log. */
  actor?: string;
  /** Optionally hand the whole cycle out at planning time. */
  assignees?: { cameramanId?: string; editorId?: string; publisherId?: string };
};

/** Creates one tracked video per title, numbering them sequentially. */
export async function planContent(input: PlanInput) {
  const client = await db.client.findFirst({
    where: { id: input.clientId, agencyId: input.agencyId },
  });
  if (!client) return { error: "That client no longer exists." as const, ids: [] };

  const last = await db.contentItem.findFirst({
    where: { agencyId: input.agencyId },
    orderBy: { ref: "desc" },
    select: { ref: true },
  });

  const start = parseDateInput(input.weekStart);
  const schedule: Partial<Record<DeadlineField, Date>> & { cycleStart?: Date } = start
    ? scheduleFrom(start)
    : {};
  for (const step of STEPS) {
    const chosen = parseDateInput(input.deadlines?.[step.field] ?? "");
    if (chosen) schedule[step.field] = chosen;
  }
  // A video counts toward the month it is posted in.
  const monthKey = currentMonthKey(schedule.publishDue ?? new Date());
  let ref = (last?.ref ?? 0) + 1;
  const ids: string[] = [];

  for (const title of input.titles) {
    const item = await db.contentItem.create({
      data: {
        agencyId: input.agencyId,
        clientId: client.id,
        ref: ref++,
        title,
        format: input.format,
        priority: input.priority,
        ...schedule,
        dueDate: schedule.publishDue ?? null,
        monthKey,
        // Seeded from the client so a video arrives already priced; 0 on the
        // client means no price agreed, which stays null here.
        videoPrice: client.videoPrice > 0 ? client.videoPrice : null,
        scriptPrice: client.scriptPrice > 0 ? client.scriptPrice : null,
        scriptwriterId: input.scriptwriterId || null,
        cameramanId: input.assignees?.cameramanId || null,
        editorId: input.assignees?.editorId || null,
        publisherId: input.assignees?.publisherId || null,
        stage: input.scriptwriterId ? "scripting" : "planned",
        events: {
          create: {
            kind: "created",
            message: `Planned for ${client.name}`,
            actor: input.actor,
          },
        },
      },
    });
    ids.push(item.id);
  }

  return { ids, clientId: client.id };
}

/** Moves a piece one stage forward. Returns false if it is already live. */
export async function advanceContent(id: string, actor?: string) {
  const item = await db.contentItem.findUnique({ where: { id } });
  if (!item) return false;

  const to = nextStage(item.stage);
  if (!to) return false;

  await db.contentItem.update({
    where: { id },
    data: {
      stage: to,
      ...enterStage(to),
      events: {
        create: {
          kind: "stage",
          message: `Moved to ${stageConfig(to).label}`,
          actor: actor ?? (await ownerName(item)),
        },
      },
    },
  });

  return true;
}

/** Jumps a piece straight to a stage — what a drag on the board does. */
export async function moveContent(id: string, to: string, actor?: string) {
  if (!isStage(to)) return false;

  const item = await db.contentItem.findUnique({ where: { id } });
  if (!item || item.stage === to) return false;

  await db.contentItem.update({
    where: { id },
    data: {
      stage: to,
      ...enterStage(to),
      events: {
        create: {
          kind: "stage",
          message: `Moved from ${stageConfig(item.stage).label} to ${stageConfig(to).label}`,
          actor,
        },
      },
    },
  });

  return true;
}

/**
 * A CEO gate: approve, hand the video to the next person, and set their
 * deadline — one action, so nothing moves on without an owner and a date.
 */
export async function handOffContent(input: {
  id: string;
  memberId: string;
  due: string;
  note?: string;
  actor?: string;
  /**
   * The CEO's answer to "does the price need changing?". Left undefined when
   * they did not ask to change it, which leaves the stored price untouched —
   * distinct from null, which clears it.
   */
  price?: number | null;
}) {
  const item = await db.contentItem.findUnique({ where: { id: input.id } });
  if (!item) return "That video no longer exists." as const;

  const gate = handoff(item.stage);
  const to = nextStage(item.stage);
  if (!gate || !to) return "This stage isn't a hand-off." as const;

  const member = await db.member.findUnique({ where: { id: input.memberId } });
  if (!member || member.agencyId !== item.agencyId || !member.active) {
    return `Pick a ${gate.who} from your team.` as const;
  }
  if (!gate.roles.includes(member.role)) {
    return `${member.name} isn't a ${gate.who}.` as const;
  }

  const due = parseDateInput(input.due);
  if (!due) return "Set a deadline for this step." as const;

  // Only touched when the CEO explicitly chose to change it at this gate.
  const repriced = input.price !== undefined && input.price !== item[gate.price];
  const priceChange = input.price === undefined ? {} : { [gate.price]: input.price };

  await db.contentItem.update({
    where: { id: item.id },
    data: {
      stage: to,
      ...enterStage(to),
      ...priceChange,
      [gate.assign]: member.id,
      [gate.deadline]: due,
      // The posting date is the overall due date, and decides which month the
      // video counts toward.
      ...(gate.deadline === "publishDue"
        ? { dueDate: due, monthKey: currentMonthKey(due) }
        : {}),
      events: {
        create: [
          {
            kind: "stage",
            message: input.note
              ? `${stageConfig(item.stage).advance} — ${member.name} by ${input.due}: ${input.note}`
              : `${stageConfig(item.stage).advance} — assigned to ${member.name}, due ${input.due}`,
            actor: input.actor,
          },
          // A separate entry: a price change is its own fact, and burying it in
          // the hand-off message would hide it from anyone scanning the log.
          ...(repriced
            ? [
                {
                  kind: "price" as const,
                  message: `${PRICE_FIELDS[gate.price].label} set to ${priceLabel(
                    input.price ?? null,
                  )}`,
                  actor: input.actor,
                },
              ]
            : []),
        ],
      },
    },
  });

  return null;
}

/**
 * Sets one of a video's two prices outright, for the CEO who wants to reprice
 * without waiting for the next gate. `null` clears it, which makes the video
 * fall back to the client's standard rate.
 */
export async function setContentPrice(
  id: string,
  field: PriceField,
  price: number | null,
  actor?: string,
) {
  const item = await db.contentItem.findUnique({ where: { id } });
  if (!item) return false;
  if (item[field] === price) return false;

  await db.contentItem.update({
    where: { id },
    data: {
      [field]: price,
      events: {
        create: {
          kind: "price",
          message:
            price === null
              ? `${PRICE_FIELDS[field].label} cleared — back to the client's rate`
              : `${PRICE_FIELDS[field].label} set to ${priceLabel(price)}`,
          actor,
        },
      },
    },
  });

  return true;
}

/** Sends a piece back one stage and counts a revision against it. */
export async function sendContentBack(id: string, note: string, actor?: string) {
  const item = await db.contentItem.findUnique({ where: { id } });
  if (!item) return false;

  const to = prevStage(item.stage);
  if (!to) return false;

  await db.contentItem.update({
    where: { id },
    data: {
      stage: to,
      ...leaveStage(item.stage as Stage),
      revisions: { increment: 1 },
      events: {
        create: {
          kind: "revision",
          message: note
            ? `Sent back to ${stageConfig(to).label}: ${note}`
            : `Sent back to ${stageConfig(to).label}`,
          actor,
        },
      },
    },
  });

  return true;
}

export async function setAssignee(
  id: string,
  field: AssignField,
  memberId: string,
  actor?: string,
) {
  if (!ASSIGN_FIELDS.includes(field)) return false;

  const member = memberId ? await db.member.findUnique({ where: { id: memberId } }) : null;

  await db.contentItem.update({
    where: { id },
    data: {
      [field]: member?.id ?? null,
      events: {
        create: {
          kind: "assign",
          message: member ? `${member.name} assigned as ${member.role}` : "Assignment cleared",
          actor,
        },
      },
    },
  });

  return true;
}

const LINK_FIELDS = ["footageUrl", "editUrl", "publishedUrl", "thumbnailUrl"];

/** Saves one panel of the content record. Returns an error string if invalid. */
export async function saveContentPanel(
  id: string,
  panel: string,
  get: (key: string) => string,
) {
  const data: Record<string, unknown> = {};

  if (panel === "brief") {
    const title = get("title");
    if (title) data.title = title;
    data.idea = get("idea") || null;
    data.format = get("format") || "reel";
    data.priority = get("priority") || "normal";
  } else if (panel === "schedule") {
    for (let i = 1; i < STEPS.length; i++) {
      const [before, after] = [get(STEPS[i - 1].field), get(STEPS[i].field)];
      if (before && after && after < before) {
        return `"${STEPS[i].label}" can't be due before "${STEPS[i - 1].label}".`;
      }
    }
    for (const step of STEPS) data[step.field] = parseDateInput(get(step.field));
    data.dueDate = data.publishDue;
  } else if (panel === "script") {
    // The writer titles the script they were asked to write.
    const title = get("title");
    if (title) data.title = title;
    data.scriptBody = get("scriptBody") || null;
  } else if (panel === "shoot") {
    data.shootDate = parseDateInput(get("shootDate"));
    data.shootLocation = get("shootLocation") || null;
    data.shootNotes = get("shootNotes") || null;
    data.footageUrl = get("footageUrl") || null;
  } else if (panel === "edit") {
    data.editBrief = get("editBrief") || null;
    data.editUrl = get("editUrl") || null;
  } else if (panel === "post") {
    data.platform = get("platform") || null;
    data.caption = get("caption") || null;
    data.hashtags = get("hashtags") || null;
    data.thumbnailUrl = get("thumbnailUrl") || null;
    data.scheduledFor = parseDateInput(get("scheduledFor"));
    data.publishedUrl = get("publishedUrl") || null;
  } else {
    return "Unknown panel.";
  }

  for (const field of LINK_FIELDS) {
    const value = data[field];
    if (typeof value === "string" && value && !/^https?:\/\//i.test(value)) {
      return "Links need to start with http:// or https://";
    }
  }

  await db.contentItem.update({ where: { id }, data });
  return null;
}

export async function addContentNote(id: string, message: string, actor?: string) {
  if (!id || !message) return false;
  await db.contentEvent.create({ data: { contentId: id, kind: "note", message, actor } });
  return true;
}

export async function removeContent(id: string) {
  await db.contentItem.delete({ where: { id } });
}
