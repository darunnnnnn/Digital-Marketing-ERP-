import type { PriceField } from "./pricing";
import { calendarDate } from "./utils";

// The spine of Agency OS. Every board column, badge and action button reads
// from this one file.
//
//   Plan -> Script -> CEO approves & assigns the shoot
//        -> Shoot -> CEO reviews footage & assigns the edit
//        -> Edit  -> CEO approves the final cut & assigns posting
//        -> Post
//
// The CEO's three gates are hand-offs: approving also picks the next person and
// sets their deadline, so work never sits unassigned.

export const STAGES = [
  "planned",
  "scripting",
  "script_review",
  "shooting",
  "footage_review",
  "editing",
  "edit_review",
  "ready",
  "published",
] as const;

export type Stage = (typeof STAGES)[number];

export const ROLES = [
  "ceo",
  "manager",
  "scriptwriter",
  "cameraman",
  "editor",
  "publisher",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ceo: "CEO",
  manager: "Social media manager",
  scriptwriter: "Scriptwriter",
  cameraman: "Cameraman",
  editor: "Editor",
  publisher: "Posting",
};

/** Which assignment field the stage's owner comes from. */
export type AssignField = "scriptwriterId" | "cameramanId" | "editorId" | "publisherId";

export type StageConfig = {
  key: Stage;
  label: string;
  short: string;
  /** Who is holding the ball at this stage. */
  owner: Role;
  assign: AssignField | null;
  blurb: string;
  /** Label on the button that moves it forward. */
  advance: string | null;
  /** Label on the button that sends it back, when the stage allows it. */
  sendBack: string | null;
  dot: string;
  chip: string;
  bar: string;
  ring: string;
};

// Colour carries progress, not category: one hue deepening as work moves along,
// finishing in solid ink. The chip stays neutral so seven columns read as one board.
export const STAGE_CONFIG: Record<Stage, StageConfig> = {
  planned: {
    key: "planned",
    label: "Planned",
    short: "Plan",
    owner: "manager",
    assign: null,
    blurb: "Idea is on the calendar and waiting for a scriptwriter.",
    advance: "Send to scriptwriter",
    sendBack: null,
    dot: "bg-stone-300",
    chip: "bg-stone-100 text-stone-600 ring-stone-200",
    bar: "bg-stone-300",
    ring: "ring-stone-200",
  },
  scripting: {
    key: "scripting",
    label: "Scripting",
    short: "Script",
    owner: "scriptwriter",
    assign: "scriptwriterId",
    blurb: "Scriptwriter is drafting. Submit when the script is ready for review.",
    advance: "Submit for review",
    sendBack: null,
    dot: "bg-brand-200",
    chip: "bg-stone-100 text-stone-600 ring-stone-200",
    bar: "bg-brand-200",
    ring: "ring-brand-200",
  },
  script_review: {
    key: "script_review",
    label: "Script review",
    short: "Review",
    owner: "ceo",
    assign: null,
    blurb: "Waiting on CEO approval. Approve to release it to the shoot team.",
    advance: "Approve script",
    sendBack: "Request changes",
    dot: "bg-brand-400",
    chip: "bg-brand-50 text-brand-700 ring-brand-200",
    bar: "bg-brand-400",
    ring: "ring-brand-300",
  },
  shooting: {
    key: "shooting",
    label: "Shooting",
    short: "Shoot",
    owner: "cameraman",
    assign: "cameramanId",
    blurb: "Script approved. Schedule the shoot, then upload the raw footage.",
    advance: "Send footage to CEO",
    sendBack: null,
    dot: "bg-brand-500",
    chip: "bg-stone-100 text-stone-600 ring-stone-200",
    bar: "bg-brand-500",
    ring: "ring-brand-400",
  },
  footage_review: {
    key: "footage_review",
    label: "Footage review",
    short: "Footage",
    owner: "ceo",
    assign: null,
    blurb: "Footage is in. Check it, then assign an editor and their deadline.",
    advance: "Approve footage",
    sendBack: "Send back to reshoot",
    dot: "bg-brand-500",
    chip: "bg-brand-50 text-brand-700 ring-brand-200",
    bar: "bg-brand-500",
    ring: "ring-brand-500",
  },
  editing: {
    key: "editing",
    label: "Editing",
    short: "Edit",
    owner: "editor",
    assign: "editorId",
    blurb: "Editor has the script and raw footage. Submit the cut for the CEO's final review.",
    advance: "Submit for final review",
    sendBack: "Back to shoot",
    dot: "bg-brand-500",
    chip: "bg-stone-100 text-stone-600 ring-stone-200",
    bar: "bg-brand-500",
    ring: "ring-brand-500",
  },
  edit_review: {
    key: "edit_review",
    label: "Final review",
    short: "Final",
    owner: "ceo",
    assign: null,
    blurb: "The finished video is waiting on CEO approval before it goes to posting.",
    advance: "Approve final video",
    sendBack: "Request changes",
    dot: "bg-brand-600",
    chip: "bg-brand-50 text-brand-700 ring-brand-200",
    bar: "bg-brand-600",
    ring: "ring-brand-600",
  },
  ready: {
    key: "ready",
    label: "Ready to post",
    short: "Ready",
    owner: "publisher",
    assign: "publisherId",
    blurb: "Final video approved. Add the caption and schedule, then post it.",
    advance: "Mark posted",
    sendBack: "Back to final review",
    dot: "bg-brand-700",
    chip: "bg-brand-50 text-brand-700 ring-brand-200",
    bar: "bg-brand-700",
    ring: "ring-brand-600",
  },
  published: {
    key: "published",
    label: "Published",
    short: "Live",
    owner: "publisher",
    assign: "publisherId",
    blurb: "Live. This counts toward the client's monthly target.",
    advance: null,
    sendBack: "Unpublish",
    dot: "bg-stone-900",
    chip: "bg-stone-900 text-white ring-stone-900",
    bar: "bg-stone-900",
    ring: "ring-stone-900",
  },
};

export const STAGE_LABELS = Object.fromEntries(
  STAGES.map((s) => [s, STAGE_CONFIG[s].label]),
) as Record<Stage, string>;

/**
 * The CEO gates. Approving here also assigns the next person and their deadline
 * — the hand-off the agency actually runs on.
 */
export const HANDOFFS: Record<
  string,
  {
    assign: AssignField;
    /**
     * Who may be handed this step. A list, because the sidebar already lets a
     * manager cover scripting and posting — a gate that refused them would
     * contradict the assignment it sits next to.
     */
    roles: string[];
    deadline: string;
    who: string;
    verb: string;
    /**
     * Which price the CEO is offered a chance to change here. Commissioning the
     * script is when the script fee is decided; from the shoot onward the
     * number that matters is what the finished video is worth.
     */
    price: PriceField;
  }
> = {
  planned: {
    assign: "scriptwriterId",
    roles: ["scriptwriter", "manager"],
    deadline: "scriptDue",
    who: "scriptwriter",
    verb: "Send to scriptwriter",
    price: "scriptPrice",
  },
  script_review: {
    assign: "cameramanId",
    roles: ["cameraman"],
    deadline: "shootDue",
    who: "cameraman",
    verb: "Approve script & assign the shoot",
    price: "videoPrice",
  },
  footage_review: {
    assign: "editorId",
    roles: ["editor"],
    deadline: "editDue",
    who: "editor",
    verb: "Approve footage & assign the edit",
    price: "videoPrice",
  },
  edit_review: {
    assign: "publisherId",
    roles: ["publisher", "manager"],
    deadline: "publishDue",
    who: "posting team",
    verb: "Approve final video & assign posting",
    price: "videoPrice",
  },
};

export function handoff(stage: string) {
  return HANDOFFS[stage] ?? null;
}

export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

export function stageConfig(value: string): StageConfig {
  return STAGE_CONFIG[isStage(value) ? value : "planned"];
}

export function stageIndex(value: string) {
  const i = STAGES.indexOf(value as Stage);
  return i === -1 ? 0 : i;
}

export function nextStage(value: string): Stage | null {
  const i = stageIndex(value);
  return i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

export function prevStage(value: string): Stage | null {
  const i = stageIndex(value);
  return i > 0 ? STAGES[i - 1] : null;
}

/** Percent of the way through the pipeline, for progress bars. */
export function stageProgress(value: string) {
  return Math.round((stageIndex(value) / (STAGES.length - 1)) * 100);
}

export const FORMATS = [
  { key: "reel", label: "Reel" },
  { key: "short", label: "Short" },
  { key: "post", label: "Static post" },
  { key: "ad", label: "Ad creative" },
  { key: "longform", label: "Long form" },
];

export const PRIORITIES: Record<string, { label: string; chip: string }> = {
  low: {
    label: "Low",
    chip: "bg-transparent text-stone-400 ring-stone-200",
  },
  normal: {
    label: "Normal",
    chip: "bg-stone-100 text-stone-600 ring-stone-200",
  },
  high: {
    label: "High",
    chip: "bg-stone-900 text-white ring-stone-900",
  },
};

export function priority(value: string) {
  return PRIORITIES[value] ?? PRIORITIES.normal;
}

/** Overdue = past its due date and not yet live. */
export function isOverdue(dueDate: Date | null, stage: string) {
  if (!dueDate || stage === "published") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return calendarDate(dueDate) < today;
}

export function refLabel(ref: number) {
  return `#${String(ref).padStart(3, "0")}`;
}
