/**
 * Telling people, by email, that something landed on their desk.
 *
 * The browser can't send mail itself without handing an API key to every
 * signed-in device, so this asks the `notify` edge function instead (see
 * supabase/functions/notify). All it sends is the event, the video and which
 * assignment slot it concerns — the function looks up the person and their
 * address at the other end.
 *
 * Nothing here is awaited by the code that calls it, and nothing here throws.
 * A video that moved is a video that moved; the mail not going out is worth a
 * line in the console, but it is not worth failing the action the person just
 * took, or making them wait on Resend before the board redraws.
 */
import { supabase } from "./supabase";
import type { AssignField } from "./pipeline";

export type NotifyEvent =
  /** Work has just become someone's to do. */
  | "assigned"
  /** Someone finished their part; the CEO needs to look at it. */
  | "submitted"
  /** The CEO signed off on what someone delivered. */
  | "approved"
  /** The CEO wants another pass at it. */
  | "sent_back";

/** What the work in each slot is called, in a subject line. */
export const WORK: Record<AssignField, string> = {
  scriptwriterId: "Script",
  cameramanId: "Shoot",
  voiceoverId: "Voice over",
  editorId: "Edit",
  publisherId: "Posting",
};

export type Notification = {
  event: NotifyEvent;
  contentId: string;
  /** Whose slots to write to. Left out for "submitted", which goes to the CEO. */
  fields?: AssignField[];
  /** The part of the work this is about. Defaults to the slots' own label. */
  what?: string;
  /** Their deadline — either a date input value or a stored timestamp. */
  due?: string | null;
  note?: string;
};

export function notify(n: Notification) {
  // Nothing to tell anyone about: no slot named, and not an event that finds
  // its own recipients.
  if (n.event !== "submitted" && (n.fields ?? []).length === 0) return;

  const what = n.what ?? (n.fields?.length === 1 ? WORK[n.fields[0]] : undefined);

  void supabase.functions
    .invoke("notify", { body: { ...n, what } })
    .then(async ({ error }) => {
      if (!error) return;
      // supabase-js reports every failed status as the same sentence. The
      // function's own explanation is in the response it hangs off the error,
      // and that is the part worth reading.
      const body = await readError(error);
      console.warn(`Couldn't send the notification email: ${body ?? error.message}`);
    })
    .catch((e) => console.warn("Couldn't send the notification email:", e));
}

async function readError(error: unknown): Promise<string | null> {
  const res = (error as { context?: Response }).context;
  if (!(res instanceof Response)) return null;
  try {
    const body = await res.clone().json();
    return typeof body?.error === "string" ? `${res.status} — ${body.error}` : null;
  } catch {
    return null;
  }
}
