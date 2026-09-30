/**
 * Every read and write the app makes, in one place. This replaces both the
 * Prisma calls and the server actions of the old build.
 *
 * Two things carry over from the old design on purpose:
 *   - independent queries go out together, never one after another;
 *   - the rules these functions follow are also enforced by row level security,
 *     so a blocked write fails in the database, not just in the UI.
 */
import { supabase } from "./supabase";
import { STEPS, scheduleFrom, type DeadlineField } from "./schedule";
import { handoff, nextStage, prevStage, stageConfig, type Stage } from "./pipeline";
import { currentMonthKey, parseDateInput } from "./utils";
import type {
  Client,
  ContentEvent,
  ContentItem,
  ContentItemWithNames,
  Member,
  Payout,
  Viewer,
} from "./types";

/** Supabase errors carry the database's message; surface it rather than swallow it. */
function fail(message: string, error: { message: string } | null): never {
  throw new Error(error ? `${message}: ${error.message}` : message);
}

const ITEM_WITH_NAMES = `
  *,
  client:Client(id, name, accent),
  scriptwriter:Member!ContentItem_scriptwriterId_fkey(name, accent, role),
  cameraman:Member!ContentItem_cameramanId_fkey(name, accent, role),
  editor:Member!ContentItem_editorId_fkey(name, accent, role),
  publisher:Member!ContentItem_publisherId_fkey(name, accent, role)
`;

// ------------------------------------------------------------------ clients

export async function listClients(agencyId: string, opts: { q?: string; status?: string } = {}) {
  let query = supabase.from("Client").select("*").eq("agencyId", agencyId);

  if (opts.status && opts.status !== "all") query = query.eq("status", opts.status);
  if (opts.q) {
    // ilike is case-insensitive, matching how search behaved on SQLite.
    const like = `%${opts.q}%`;
    query = query.or(`name.ilike.${like},industry.ilike.${like},contactName.ilike.${like}`);
  }

  const { data, error } = await query.order("status").order("name");
  if (error) fail("Couldn't load clients", error);
  return (data ?? []) as Client[];
}

export async function getClient(id: string) {
  const { data, error } = await supabase.from("Client").select("*").eq("id", id).maybeSingle();
  if (error) fail("Couldn't load that client", error);
  return data as Client | null;
}

export async function saveClient(
  values: Partial<Client> & { name: string },
  agencyId: string,
  id?: string,
) {
  if (id) {
    const { error } = await supabase.from("Client").update(values).eq("id", id);
    if (error) fail("Couldn't save the client", error);
    return id;
  }
  const { data, error } = await supabase
    .from("Client")
    .insert({ ...values, agencyId })
    .select("id")
    .single();
  if (error) fail("Couldn't create the client", error);
  return (data as { id: string }).id;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("Client").delete().eq("id", id);
  if (error) fail("Couldn't delete the client", error);
}

// ------------------------------------------------------------------ content

export async function listContent(
  viewer: Viewer,
  filters: { client?: string; owner?: string; q?: string } = {},
  monthKey = currentMonthKey(),
) {
  let query = supabase
    .from("ContentItem")
    .select(ITEM_WITH_NAMES)
    .eq("agencyId", viewer.agencyId)
    // This month, plus anything older still in flight.
    .or(`monthKey.eq.${monthKey},stage.neq.published`);

  if (filters.client) query = query.eq("clientId", filters.client);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);
  if (filters.owner) {
    const o = filters.owner;
    query = query.or(
      `scriptwriterId.eq.${o},cameramanId.eq.${o},editorId.eq.${o},publisherId.eq.${o}`,
    );
  }

  const { data, error } = await query.order("dueDate", { nullsFirst: false }).order("ref");
  if (error) fail("Couldn't load the pipeline", error);
  return (data ?? []) as unknown as ContentItemWithNames[];
}

export async function getContent(id: string) {
  const { data, error } = await supabase
    .from("ContentItem")
    .select(ITEM_WITH_NAMES)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("Couldn't load that video", error);
  return data as unknown as ContentItemWithNames | null;
}

export async function listEvents(contentId: string) {
  const { data, error } = await supabase
    .from("ContentEvent")
    .select("*")
    .eq("contentId", contentId)
    .order("createdAt", { ascending: false })
    .limit(30);
  if (error) fail("Couldn't load the activity log", error);
  return (data ?? []) as ContentEvent[];
}

async function logEvent(contentId: string, kind: string, message: string, actor?: string) {
  await supabase.from("ContentEvent").insert({ contentId, kind, message, actor: actor ?? null });
}

export async function countPublished(agencyId: string, monthKey = currentMonthKey()) {
  const { count, error } = await supabase
    .from("ContentItem")
    .select("id", { count: "exact", head: true })
    .eq("agencyId", agencyId)
    .eq("monthKey", monthKey)
    .eq("stage", "published");
  if (error) fail("Couldn't count posted videos", error);
  return count ?? 0;
}

export async function plannedPerClient(agencyId: string, monthKey = currentMonthKey()) {
  const { data, error } = await supabase
    .from("ContentItem")
    .select("clientId")
    .eq("agencyId", agencyId)
    .eq("monthKey", monthKey);
  if (error) fail("Couldn't count planned videos", error);

  const map = new Map<string, number>();
  for (const row of (data ?? []) as { clientId: string }[]) {
    map.set(row.clientId, (map.get(row.clientId) ?? 0) + 1);
  }
  return map;
}

// -------------------------------------------------------- planning content

export type PlanInput = {
  agencyId: string;
  clientId: string;
  clientName: string;
  titles: string[];
  format: string;
  priority: string;
  weekStart: string;
  scriptwriterId: string;
  deadlines?: Partial<Record<DeadlineField, string>>;
  assignees?: { cameramanId?: string; editorId?: string; publisherId?: string };
  actor?: string;
};

/** Creates one tracked video per title, numbering them sequentially. */
export async function planContent(input: PlanInput) {
  const { data: last } = await supabase
    .from("ContentItem")
    .select("ref")
    .eq("agencyId", input.agencyId)
    .order("ref", { ascending: false })
    .limit(1)
    .maybeSingle();

  const start = parseDateInput(input.weekStart);
  const schedule: Partial<Record<DeadlineField, string>> & { cycleStart?: string } = {};
  if (start) {
    const s = scheduleFrom(start);
    schedule.cycleStart = s.cycleStart.toISOString();
    for (const step of STEPS) schedule[step.field] = s[step.field].toISOString();
  }
  for (const step of STEPS) {
    const chosen = parseDateInput(input.deadlines?.[step.field] ?? "");
    if (chosen) schedule[step.field] = chosen.toISOString();
  }

  // A video counts toward the month it is posted in.
  const monthKey = schedule.publishDue
    ? currentMonthKey(new Date(schedule.publishDue))
    : currentMonthKey();

  let ref = ((last as { ref: number } | null)?.ref ?? 0) + 1;
  const rows = input.titles.map((title) => ({
    agencyId: input.agencyId,
    clientId: input.clientId,
    ref: ref++,
    title,
    format: input.format,
    priority: input.priority,
    ...schedule,
    dueDate: schedule.publishDue ?? null,
    monthKey,
    scriptwriterId: input.scriptwriterId || null,
    cameramanId: input.assignees?.cameramanId || null,
    editorId: input.assignees?.editorId || null,
    publisherId: input.assignees?.publisherId || null,
    stage: input.scriptwriterId ? "scripting" : "planned",
  }));

  const { data, error } = await supabase.from("ContentItem").insert(rows).select("id");
  if (error) fail("Couldn't plan the content", error);

  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  await Promise.all(
    ids.map((id) => logEvent(id, "created", `Planned for ${input.clientName}`, input.actor)),
  );
  return ids;
}

// ------------------------------------------------------ moving work along

/** Timestamps a stage owns when a piece lands on it. */
function enterStage(to: Stage): Record<string, string | null> {
  const now = new Date().toISOString();
  switch (to) {
    case "script_review":
      return { scriptSubmittedAt: now };
    case "shooting":
      return { scriptApprovedAt: now };
    case "footage_review":
      return { shootCompletedAt: now };
    case "editing":
      return { editStartedAt: now };
    case "edit_review":
      return { editSubmittedAt: now };
    case "ready":
      return { editApprovedAt: now };
    case "published":
      return { publishedAt: now };
    default:
      return {};
  }
}

/** Undone when a piece is sent back out of a stage. */
function leaveStage(from: Stage): Record<string, string | null> {
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

export async function advanceStage(item: ContentItem, actor?: string) {
  const to = nextStage(item.stage);
  if (!to) return;

  const { error } = await supabase
    .from("ContentItem")
    .update({ stage: to, ...enterStage(to) })
    .eq("id", item.id);
  if (error) fail("Couldn't move this video on", error);

  await logEvent(item.id, "stage", `Moved to ${stageConfig(to).label}`, actor);
}

/** Drag and drop on the board. Only needs where the card is and where it landed. */
export async function moveToStage(
  item: { id: string; stage: string },
  to: string,
  actor?: string,
) {
  if (item.stage === to) return;
  const { error } = await supabase
    .from("ContentItem")
    .update({ stage: to, ...enterStage(to as Stage) })
    .eq("id", item.id);
  if (error) fail("Couldn't move this video", error);

  await logEvent(
    item.id,
    "stage",
    `Moved from ${stageConfig(item.stage).label} to ${stageConfig(to).label}`,
    actor,
  );
}

export async function sendBack(item: ContentItem, note: string, actor?: string) {
  const to = prevStage(item.stage);
  if (!to) return;

  const { error } = await supabase
    .from("ContentItem")
    .update({
      stage: to,
      ...leaveStage(item.stage as Stage),
      revisions: item.revisions + 1,
    })
    .eq("id", item.id);
  if (error) fail("Couldn't send this back", error);

  await logEvent(
    item.id,
    "revision",
    note ? `Sent back to ${stageConfig(to).label}: ${note}` : `Sent back to ${stageConfig(to).label}`,
    actor,
  );
}

/**
 * A CEO gate: approve, hand the video to the next person, and set their
 * deadline — one action, so nothing moves on without an owner and a date.
 */
export async function handOff(
  item: ContentItem,
  input: { memberId: string; due: string; note?: string; actor?: string },
  team: Member[],
) {
  const gate = handoff(item.stage);
  const to = nextStage(item.stage);
  if (!gate || !to) return "This stage isn't a hand-off.";

  const member = team.find((m) => m.id === input.memberId);
  if (!member || !member.active) return `Pick a ${gate.who} from your team.`;
  if (member.role !== gate.role) return `${member.name} isn't a ${gate.who}.`;

  const due = parseDateInput(input.due);
  if (!due) return "Set a deadline for this step.";

  const patch: Record<string, unknown> = {
    stage: to,
    ...enterStage(to),
    [gate.assign]: member.id,
    [gate.deadline]: due.toISOString(),
  };
  // The posting date is the overall due date, and decides which month it counts toward.
  if (gate.deadline === "publishDue") {
    patch.dueDate = due.toISOString();
    patch.monthKey = currentMonthKey(due);
  }

  const { error } = await supabase.from("ContentItem").update(patch).eq("id", item.id);
  if (error) return error.message;

  await logEvent(
    item.id,
    "stage",
    input.note
      ? `${stageConfig(item.stage).advance} — ${member.name} by ${input.due}: ${input.note}`
      : `${stageConfig(item.stage).advance} — assigned to ${member.name}, due ${input.due}`,
    input.actor,
  );
  return null;
}

export async function setAssignee(
  item: ContentItem,
  field: string,
  memberId: string,
  team: Member[],
  actor?: string,
) {
  const member = memberId ? team.find((m) => m.id === memberId) : null;
  const { error } = await supabase
    .from("ContentItem")
    .update({ [field]: member?.id ?? null })
    .eq("id", item.id);
  if (error) fail("Couldn't change the assignment", error);

  await logEvent(
    item.id,
    "assign",
    member ? `${member.name} assigned as ${member.role}` : "Assignment cleared",
    actor,
  );
}

const LINK_FIELDS = ["footageUrl", "editUrl", "publishedUrl", "thumbnailUrl"];

/** Saves one panel of the video page. Returns an error message, or null. */
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
    for (const step of STEPS) {
      data[step.field] = parseDateInput(get(step.field))?.toISOString() ?? null;
    }
    data.dueDate = data.publishDue;
  } else if (panel === "script") {
    const title = get("title");
    if (title) data.title = title;
    data.scriptBody = get("scriptBody") || null;
  } else if (panel === "shoot") {
    data.shootDate = parseDateInput(get("shootDate"))?.toISOString() ?? null;
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
    data.scheduledFor = parseDateInput(get("scheduledFor"))?.toISOString() ?? null;
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

  const { error } = await supabase.from("ContentItem").update(data).eq("id", id);
  return error ? error.message : null;
}

export async function addNote(contentId: string, message: string, actor?: string) {
  if (!message.trim()) return;
  await logEvent(contentId, "note", message.trim(), actor);
}

export async function deleteContent(id: string) {
  const { error } = await supabase.from("ContentItem").delete().eq("id", id);
  if (error) fail("Couldn't delete that video", error);
}

// --------------------------------------------------------------- the team

export async function listMembers(agencyId: string, onlyActive = false) {
  let query = supabase.from("Member").select("*").eq("agencyId", agencyId);
  if (onlyActive) query = query.eq("active", true);

  const { data, error } = await query.order("active", { ascending: false }).order("name");
  if (error) fail("Couldn't load the team", error);
  return (data ?? []) as Member[];
}

export async function getMember(id: string) {
  const { data, error } = await supabase.from("Member").select("*").eq("id", id).maybeSingle();
  if (error) fail("Couldn't load that person", error);
  return data as Member | null;
}

export async function updateMember(id: string, values: Partial<Member>) {
  const { error } = await supabase.from("Member").update(values).eq("id", id);
  if (error) fail("Couldn't save that change", error);
}

export async function createMember(values: {
  agencyId: string;
  name: string;
  email: string;
  role: string;
}): Promise<{ member: Member } | { error: string }> {
  const { data, error } = await supabase
    .from("Member")
    .insert({ ...values, email: values.email.toLowerCase() })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Someone already uses this email." };
    return { error: error.message };
  }
  return { member: data as Member };
}

// --------------------------------------------------------------- payouts

export async function listPayouts(agencyId: string, monthKey: string) {
  const { data, error } = await supabase
    .from("Payout")
    .select("*")
    .eq("agencyId", agencyId)
    .eq("monthKey", monthKey);
  if (error) fail("Couldn't load payouts", error);
  return (data ?? []) as Payout[];
}

export async function createPayout(row: Omit<Payout, "id" | "approvedAt" | "paidAt" | "status">) {
  const { error } = await supabase.from("Payout").insert(row);
  if (error) fail("Couldn't approve that payout", error);
}

export async function markPayoutPaid(memberId: string, monthKey: string) {
  const { error } = await supabase
    .from("Payout")
    .update({ status: "paid", paidAt: new Date().toISOString() })
    .eq("memberId", memberId)
    .eq("monthKey", monthKey)
    .eq("status", "approved");
  if (error) fail("Couldn't mark that as paid", error);
}

export async function reopenPayout(memberId: string, monthKey: string) {
  const { error } = await supabase
    .from("Payout")
    .delete()
    .eq("memberId", memberId)
    .eq("monthKey", monthKey)
    .eq("status", "approved");
  if (error) fail("Couldn't reopen that payout", error);
}
