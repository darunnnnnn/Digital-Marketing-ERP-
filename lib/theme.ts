// Two colours, on purpose.
//
//   neutral — zinc, carries every surface, border and piece of text
//   accent  — blue, reserved for what is interactive, current or primary
//
// Red appears in exactly two places, and only as a signal, never as decoration:
// something is overdue, or something is about to be deleted.
//
// Per-client colours were removed deliberately. A dozen competing hues is what
// made the interface feel noisy; identity comes from the name, not a swatch.

export type AccentKey = "default";

const NEUTRAL = {
  label: "Default",
  avatar: "bg-stone-100 text-stone-900 ring-1 ring-stone-200",
  soft: "bg-stone-100",
  text: "text-stone-600",
  bar: "bg-brand-600",
  dot: "bg-stone-300",
};

export const ACCENTS: Record<AccentKey, typeof NEUTRAL> = { default: NEUTRAL };

export const ACCENT_KEYS: AccentKey[] = ["default"];

export function accent(_key?: string) {
  return NEUTRAL;
}

export const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-brand-50 text-brand-700 ring-brand-200",
  },
  paused: {
    label: "Paused",
    className: "bg-stone-100 text-stone-600 ring-stone-200",
  },
  archived: {
    label: "Archived",
    className: "bg-transparent text-stone-400 ring-stone-200",
  },
};

export function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.active;
}
