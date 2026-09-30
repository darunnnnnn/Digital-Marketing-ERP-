// Two colours, on purpose.
//
//   neutral — mist grey, carries every surface, border and piece of text
//   accent  — evergreen, reserved for what is interactive, current or primary
//
// Red appears in exactly two places, and only as a signal, never as decoration:
// something is overdue, or something is about to be deleted.
//
// Per-client colours were removed deliberately. A dozen competing hues is what
// made the interface feel noisy; identity comes from the name, not a swatch.

export type AccentKey = "default";

const NEUTRAL = {
  label: "Default",
  /** Class names, styled in index.css. */
  avatar: "avatar-soft",
  soft: "tint-soft",
  text: "muted",
  /** Colour tokens, for a <ProgressBar color> or an inline style. */
  bar: "var(--brand-600)",
  dot: "var(--stone-300)",
};

export const ACCENTS: Record<AccentKey, typeof NEUTRAL> = { default: NEUTRAL };

export const ACCENT_KEYS: AccentKey[] = ["default"];

export function accent(_key?: string) {
  return NEUTRAL;
}

/** Client status pills, using the chip tones from components/ui/Badge.css. */
export const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "chip-brand" },
  paused: { label: "Paused", className: "chip-neutral" },
  archived: { label: "Archived", className: "chip-quiet" },
};

export function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.active;
}
