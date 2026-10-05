// What is sitting on the CEO's desk.
//
// lib/pipeline already describes what approving *does* at each of the three
// gates — it moves the video on, picks the next person and sets their deadline.
// This file is the other half of a gate: who sent the work in, what they
// actually sent, and how long it has been waiting.
//
// The video page shows one video at a time, which is the right view when you
// are already looking at a video. The approvals page is the view for the other
// way round: start from the queue, see every submission with its sender and its
// files, and clear them one by one without hunting the board for them.

import { supabase } from "./supabase";
import { ROLE_LABELS, isOverdue, type AssignField, type Role, type Stage } from "./pipeline";
import { deadlineFor } from "./schedule";
import type { ContentItemWithNames, Member } from "./types";
import { toDate } from "./utils";

/** The three stages where a video is waiting on the CEO and nobody else. */
export const APPROVAL_STAGES: Stage[] = ["script_review", "footage_review", "edit_review"];

export type GateLink = { label: string; href: string };
export type GateNote = { label: string; text: string };
export type GateFact = { label: string; value: string };

// A gate lists everything it *could* show; whatever the sender left blank is
// dropped here rather than rendered as an empty row.
const links = (rows: { label: string; href: string | null }[]) =>
  rows.filter((r) => Boolean(r.href?.trim())) as GateLink[];
const notes = (rows: { label: string; text: string | null }[]) =>
  rows.filter((r) => Boolean(r.text?.trim())) as GateNote[];
const facts = (rows: { label: string; value: string | null }[]) =>
  rows.filter((r) => Boolean(r.value?.trim())) as GateFact[];

export type Gate = {
  stage: Stage;
  /** Section heading on the approvals page. */
  heading: string;
  /** What the CEO is being asked to look at, in a sentence. */
  note: string;
  /** Which assignee's work this is — the person who sent it in. */
  from: AssignField;
  /** The timestamp that marks when it landed on the desk. */
  sentAt: "scriptSubmittedAt" | "shootCompletedAt" | "editSubmittedAt";
  /** The files to open, the text to read, and the details worth knowing. */
  links: (item: ContentItemWithNames) => GateLink[];
  notes: (item: ContentItemWithNames) => GateNote[];
  facts: (item: ContentItemWithNames) => GateFact[];
};

export const GATES: Record<string, Gate> = {
  script_review: {
    stage: "script_review",
    heading: "Scripts",
    note: "Read the script, then approve it and decide how the video gets made.",
    from: "scriptwriterId",
    sentAt: "scriptSubmittedAt",
    links: (item) => links([{ label: "Reference", href: item.referenceUrl }]),
    notes: (item) =>
      notes([
        { label: "The idea", text: item.idea },
        { label: "Script", text: item.scriptBody },
      ]),
    facts: (item) =>
      facts([
        { label: "Voice over", value: item.voNeeded ? "Asked for" : "Not needed" },
        {
          label: "Sent back before",
          value: item.revisions === 0 ? null : `${item.revisions}×`,
        },
      ]),
  },
  footage_review: {
    stage: "footage_review",
    heading: "Footage",
    note: "Watch what came back from the shoot, then hand the video to an editor.",
    from: "cameramanId",
    sentAt: "shootCompletedAt",
    links: (item) =>
      links([
        { label: "Raw footage", href: item.footageUrl },
        { label: "Voice over", href: item.voUrl },
        { label: "Reference", href: item.referenceUrl },
      ]),
    notes: (item) =>
      notes([
        { label: "Shoot notes", text: item.shootNotes },
        { label: "Voice over notes", text: item.voNotes },
      ]),
    facts: (item) =>
      facts([
        { label: "Location", value: item.shootLocation },
        {
          label: "Sent back before",
          value: item.revisions === 0 ? null : `${item.revisions}×`,
        },
      ]),
  },
  edit_review: {
    stage: "edit_review",
    heading: "Final cuts",
    note: "The last look before it goes out. Approve it and hand it to posting.",
    from: "editorId",
    sentAt: "editSubmittedAt",
    links: (item) =>
      links([
        { label: "Edited cut", href: item.editUrl },
        { label: "Raw footage", href: item.footageUrl },
        { label: "Voice over", href: item.voUrl },
        // The cut is judged against the example it was modelled on.
        { label: "Reference", href: item.referenceUrl },
      ]),
    notes: (item) => notes([{ label: "Editing instructions", text: item.editBrief }]),
    facts: (item) =>
      facts([
        {
          label: "Sent back before",
          value: item.revisions === 0 ? null : `${item.revisions}×`,
        },
      ]),
  },
};

export function gateFor(stage: string): Gate | null {
  return GATES[stage] ?? null;
}

/** One person's name as the approvals page prints it. */
export type Sender = { name: string; role: string };

export type Approval = {
  item: ContentItemWithNames;
  gate: Gate;
  /** Who sent it in. Null if the assignment was cleared after they sent it. */
  sender: Sender | null;
  /** Anyone else whose work is in this submission — the voice over, at the shoot gate. */
  alsoFrom: Sender[];
  sentAt: Date | null;
  /** Whole days it has been on the desk. Null when nothing stamped it. */
  waiting: number | null;
  /** The deadline of the step being reviewed; a gate has none of its own. */
  due: Date | null;
  late: boolean;
  links: GateLink[];
  notes: GateNote[];
  facts: GateFact[];
};

function roleLabel(role: string) {
  return ROLE_LABELS[role as Role] ?? role;
}

/**
 * One row for the approvals page.
 *
 * The team list is passed in because the voice over person is not one of the
 * names the content query joins, and the footage gate shows their work next to
 * the cameraman's — both parts arrive before the video moves on.
 */
export function buildApproval(item: ContentItemWithNames, team: Member[]): Approval | null {
  const gate = gateFor(item.stage);
  if (!gate) return null;

  const joined: Record<AssignField, { name: string; role: string } | null> = {
    scriptwriterId: item.scriptwriter,
    cameramanId: item.cameraman,
    voiceoverId: null, // not joined by the query; looked up in the team instead
    editorId: item.editor,
    publisherId: item.publisher,
  };

  const person = (id: string | null): Sender | null => {
    const m = id ? team.find((t) => t.id === id) : null;
    return m ? { name: m.name, role: roleLabel(m.role) } : null;
  };

  const from = joined[gate.from];
  const sender = from
    ? { name: from.name, role: roleLabel(from.role) }
    : person(item[gate.from] as string | null);

  // At the shoot gate the voice over person's recording is part of what the CEO
  // is reviewing, so they are credited beside the cameraman.
  const vo =
    item.stage === "footage_review" && item.voCompletedAt ? person(item.voiceoverId) : null;

  const sentAt = toDate(item[gate.sentAt]);
  const dueField = deadlineFor(item);
  const due = dueField ? toDate(item[dueField]) : null;

  return {
    item,
    gate,
    sender,
    alsoFrom: vo ? [vo] : [],
    sentAt,
    waiting: sentAt ? Math.floor((Date.now() - sentAt.getTime()) / 86_400_000) : null,
    due,
    late: isOverdue(due, item.stage),
    links: gate.links(item),
    notes: gate.notes(item),
    facts: gate.facts(item),
  };
}

const ITEM_WITH_SENDERS = `
  *,
  client:Client(id, name, accent),
  scriptwriter:Member!ContentItem_scriptwriterId_fkey(name, accent, role),
  cameraman:Member!ContentItem_cameramanId_fkey(name, accent, role),
  editor:Member!ContentItem_editorId_fkey(name, accent, role),
  publisher:Member!ContentItem_publisherId_fkey(name, accent, role)
`;

/**
 * Everything waiting on the CEO, longest wait first — the order it should be
 * cleared in. Deliberately not filtered by month: a script submitted in March
 * and never looked at is exactly what this page exists to surface.
 */
export async function listApprovals(agencyId: string, team: Member[]) {
  const { data, error } = await supabase
    .from("ContentItem")
    .select(ITEM_WITH_SENDERS)
    .eq("agencyId", agencyId)
    .in("stage", APPROVAL_STAGES)
    .order("ref");
  if (error) throw new Error(`Couldn't load what's waiting for you: ${error.message}`);

  const rows = (data ?? []) as unknown as ContentItemWithNames[];
  return rows
    .map((item) => buildApproval(item, team))
    .filter((a): a is Approval => a !== null)
    .sort((a, b) => {
      // Oldest submission first; anything with no timestamp sits at the end.
      const left = a.sentAt?.getTime() ?? Infinity;
      const right = b.sentAt?.getTime() ?? Infinity;
      return left - right || a.item.ref - b.item.ref;
    });
}

/** Just the number, for the badge on the sidebar link. */
export async function approvalCount(agencyId: string) {
  const { count, error } = await supabase
    .from("ContentItem")
    .select("id", { count: "exact", head: true })
    .eq("agencyId", agencyId)
    .in("stage", APPROVAL_STAGES);
  if (error) throw new Error(`Couldn't count approvals: ${error.message}`);
  return count ?? 0;
}
