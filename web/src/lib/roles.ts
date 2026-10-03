// What a person can be given to do.
//
// Agency OS separates two things that both used to live in one "role" column:
//
//   authority — ceo and manager. Who may approve, plan, assign and see money.
//               Still a single value, and still what row level security reads.
//   craft     — scriptwriter, cameraman, editor, posting. What work lands on
//               their desk. A person can hold several: in a small agency the
//               same person often writes, shoots and edits.
//
// Permissions never needed changing for this. A video carries four independent
// assignee fields, and every check — in the database and in the app — asks
// "is this person in that field", not "is their role this". So one person in
// all four fields already worked; they just could not be put there.

import type { Member } from "./types";
import { isManager } from "./permissions";
import { ROLE_LABELS, type AssignField, type Role } from "./pipeline";

export type Craft = {
  /** The value stored in Member.roles. */
  role: string;
  /** URL segment: /work/script. */
  slug: string;
  /** What the person sees in the sidebar. */
  label: string;
  /** The field on a video that assigns this craft. */
  assign: AssignField;
  /** The panel of the video page they fill in. */
  panel: string;
  /** The stage a video sits in while this craft's step is still to do. */
  stage: string;
};

export const CRAFTS: Craft[] = [
  {
    role: "scriptwriter",
    slug: "script",
    label: "Scripts",
    assign: "scriptwriterId",
    panel: "script",
    stage: "scripting",
  },
  {
    role: "cameraman",
    slug: "shoot",
    label: "Shoot",
    assign: "cameramanId",
    panel: "shoot",
    stage: "shooting",
  },
  {
    role: "voiceover",
    slug: "voiceover",
    label: "Voice over",
    assign: "voiceoverId",
    panel: "vo",
    stage: "shooting",
  },
  {
    role: "editor",
    slug: "edit",
    label: "Edit",
    assign: "editorId",
    panel: "edit",
    stage: "editing",
  },
  {
    role: "publisher",
    slug: "post",
    label: "Posting",
    assign: "publisherId",
    panel: "post",
    stage: "ready",
  },
];

export function craftBySlug(slug: string) {
  return CRAFTS.find((c) => c.slug === slug) ?? null;
}

export function craftByRole(role: string) {
  return CRAFTS.find((c) => c.role === role) ?? null;
}

export function craftByAssign(field: string) {
  return CRAFTS.find((c) => c.assign === field) ?? null;
}

/**
 * Every role a person holds.
 *
 * Falls back to the single `role` column, because rows written before `roles`
 * existed have it empty — and because `role` stays the primary one, for display
 * and for the authority checks in the database.
 */
export function memberRoles(m: Pick<Member, "role"> & { roles?: string[] | null }): string[] {
  const extra = m.roles ?? [];
  return extra.length > 0 ? extra : [m.role];
}

export function hasRole(
  m: Pick<Member, "role"> & { roles?: string[] | null },
  role: string,
): boolean {
  return memberRoles(m).includes(role);
}

/** The crafts a person actually does, in pipeline order. */
export function craftsOf(m: Pick<Member, "role"> & { roles?: string[] | null }): Craft[] {
  const mine = memberRoles(m);
  return CRAFTS.filter((c) => mine.includes(c.role));
}

/** Everything someone holds, as one line: "Scriptwriter · Editor". */
export function rolesLabel(m: Pick<Member, "role"> & { roles?: string[] | null }): string {
  return memberRoles(m)
    .map((r) => ROLE_LABELS[r as Role] ?? r)
    .join(" · ");
}

/**
 * Which craft this person is acting as on this particular video.
 *
 * Driven by what they are assigned to here rather than by their roles, because
 * someone who writes and edits is the writer on one video and the editor on the
 * next. When they hold several fields on the same video, the step the video is
 * on right now wins — that is the one waiting on them — and otherwise the
 * earliest in the pipeline, since that is the next one to reach them.
 */
export function craftFor(
  m: { id: string },
  item: Record<string, unknown> & { stage: string },
): Craft | null {
  const held = CRAFTS.filter((c) => item[c.assign] === m.id);
  return (
    held.find((c) => craftIsOpen(c, item)) ??
    held.find((c) => c.stage === item.stage) ??
    held[0] ??
    null
  );
}

/**
 * Whether a video is still waiting on this craft, not merely sitting in its
 * stage. The shoot and the voice over share a stage and finish independently,
 * so a video can be in "shooting" with the footage already in and only the
 * voice over left.
 */
export function craftIsOpen(c: Craft, item: Record<string, unknown> & { stage: string }) {
  if (item.stage !== c.stage) return false;
  if (c.role === "cameraman") return item.shootNeeded !== false && !item.shootCompletedAt;
  if (c.role === "voiceover") return item.voNeeded === true && !item.voCompletedAt;
  return true;
}

/**
 * The separate work pages someone gets — Scripts, Shoot, Edit — or none.
 *
 * Only for a creative who holds more than one craft. Someone with one has
 * always had their queue on the content page and keeps it there, and managers
 * see the whole board, which already covers anything assigned to them.
 */
export function workPortals(m: { id: string; role: string; roles?: string[] | null }): Craft[] {
  if (isManager(m)) return [];
  const crafts = craftsOf(m);
  return crafts.length > 1 ? crafts : [];
}
