export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function formatMoney(rupees: number) {
  return "\u20B9" + rupees.toLocaleString("en-IN");
}

export function parseServices(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatDate(d: Date | null | undefined) {
  if (!d) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatDateTime(d: Date | null | undefined) {
  if (!d) return null;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Today", "Tomorrow", "3d late", or a short date. */
export function dueLabel(d: Date | null | undefined) {
  if (!d) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = calendarDate(d);

  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "1d late";
  if (days < -1) return `${Math.abs(days)}d late`;
  if (days <= 6) return `In ${days}d`;
  return formatCalendar(d);
}

/** Value for an <input type="date">. */
export function dateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Parses an <input type="date"> value. Calendar dates carry no time, so they
 * are pinned to midday UTC — local midnight would slip to the previous day
 * once it is stored, and read back wrong from another timezone.
 */
export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Formats a stored calendar date (midday UTC), free of timezone drift. */
export function formatCalendar(d: Date | null | undefined) {
  if (!d) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Calendar date of a stored due date, as local midnight, for comparisons. */
export function calendarDate(d: Date) {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function timeAgo(d: Date) {
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d) ?? "";
}
