/**
 * Mail sent the moment someone moves a video.
 *
 * The browser can't send mail: doing it there would mean shipping an API key to
 * every signed-in device. So the app asks this function instead, over
 * `supabase.functions.invoke`, and the function does the rest with the service
 * role — reading the video, the client and the recipients' addresses itself.
 *
 * That split matters for more than the key. The browser names an event and the
 * assignment slot it concerns — "whoever is the editor on this video" — never a
 * person and never an address. Both are looked up here, from the video's own
 * row, so a tampered-with call can't be turned into a mailer: the worst it can
 * do is tell someone already on the video something that didn't happen.
 *
 * The layout, the secrets it needs and the button at the bottom of every mail
 * all live in ../_shared/mail.ts. `sweep` is the other sender: everything that
 * goes out on a schedule rather than on a click.
 *
 * Deploy:  npx supabase functions deploy notify
 */

import { caller, read } from "../_shared/db.ts";
import { CORS, RESEND_API_KEY, dateLabel, page, refLabel, send } from "../_shared/mail.ts";
import type { Line } from "../_shared/mail.ts";

/** What the app is allowed to ask for. Anything else is rejected. */
const EVENTS = ["assigned", "submitted", "approved", "sent_back"] as const;
type Event = (typeof EVENTS)[number];

/**
 * The assignment slots a recipient may be read from — a fixed list, so the
 * column name arriving in a request can never be turned into a read of
 * something else on the row.
 */
const FIELDS = [
  "scriptwriterId",
  "cameramanId",
  "voiceoverId",
  "editorId",
  "publisherId",
] as const;
type Field = (typeof FIELDS)[number];

type Request_ = {
  event: Event;
  contentId: string;
  /** Whose slots to write to. Ignored for "submitted", which goes to the CEO. */
  fields?: Field[];
  /** The part of the work this is about: "Script", "Shoot", "Edit"… */
  what?: string;
  /** Their deadline, as stored (ISO). */
  due?: string | null;
  note?: string;
};

type Member = { id: string; name: string; email: string | null; active: boolean };
type Item = {
  id: string;
  agencyId: string;
  ref: number;
  title: string;
  Client: { name: string } | null;
} & Partial<Record<Field, string | null>>;

// -------------------------------------------------------------------- words

/** Subject and opening line per event. `what` is the part of the work. */
function compose(event: Event, what: string, item: Item, actor: string) {
  const ref = `${refLabel(item.ref)} ${item.title}`;
  const low = what.toLowerCase();

  switch (event) {
    case "assigned":
      return {
        subject: `${what} assigned to you — ${ref}`,
        heading: `The ${low} is yours`,
        lead: `${actor} put you on the ${low} for this video.`,
      };
    case "submitted":
      return {
        subject: `${what} ready for review — ${ref}`,
        heading: `${what} is in for review`,
        lead: `${actor} sent the ${low} through. It's waiting on your approval.`,
      };
    case "approved":
      return {
        subject: `${what} approved — ${ref}`,
        heading: `Your ${low} was approved`,
        lead: `${actor} signed off on the ${low}. Nothing more needed from you here.`,
      };
    case "sent_back":
      return {
        subject: `Changes requested — ${ref}`,
        heading: `The ${low} needs another pass`,
        lead: `${actor} sent the ${low} back to you with changes.`,
      };
  }
}

// --------------------------------------------------------------------- main

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const no = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function handle(req: Request): Promise<Response> {
  if (!RESEND_API_KEY) return no("RESEND_API_KEY isn't set on this function.", 500);

  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!jwt) return no("Sign in first.", 401);
  const me = await caller(jwt);
  if (!me) return no("That session isn't valid.", 401);

  let body: Request_;
  try {
    body = await req.json();
  } catch {
    return no("Expected JSON.", 400);
  }
  if (!EVENTS.includes(body.event)) return no("Unknown event.", 400);
  if (!body.contentId) return no("No video given.", 400);

  // The video, the client it belongs to, and every assignment slot on it.
  const [item] = await read<Item>(
    `ContentItem?id=eq.${encodeURIComponent(body.contentId)}` +
      `&select=id,agencyId,ref,title,Client(name),${FIELDS.join(",")}`,
  );
  if (!item) return no("No such video.", 404);

  // Everyone in this agency, which is both the recipient pool and the place the
  // CEO is found. Scoped to the video's own agency, so ids from elsewhere miss.
  const team = await read<Member & { role: string }>(
    `Member?agencyId=eq.${encodeURIComponent(item.agencyId)}&select=id,name,email,active,role`,
  );

  // Who holds the slots this event is about. "submitted" is the exception: it
  // always goes up to the CEO, who is nobody's assignee.
  const wanted =
    body.event === "submitted"
      ? team.filter((m) => m.role === "ceo")
      : (() => {
          const ids = (body.fields ?? [])
            .filter((f): f is Field => FIELDS.includes(f))
            .map((f) => item[f])
            .filter((id): id is string => Boolean(id));
          return team.filter((m) => ids.includes(m.id));
        })();

  // The caller has to belong to the agency whose video this is. Without this a
  // signed-in person from anywhere could set mail going about someone else's
  // work, which is a nuisance even when the addresses aren't theirs to choose.
  const actor = team.find((m) => m.email?.toLowerCase() === me.email);
  if (!actor) return no("That video isn't yours.", 403);

  const recipients = wanted.filter(
    (m) =>
      m.active &&
      m.email &&
      // Nobody needs mail about something they just did themselves.
      m.email.toLowerCase() !== me.email,
  );
  if (recipients.length === 0) return ok({ sent: 0 });

  const what = body.what?.trim() || "Work";
  const copy = compose(body.event, what, item, actor.name);

  const lines: Line[] = [{ label: "Video", value: `${refLabel(item.ref)} ${item.title}` }];
  if (item.Client?.name) lines.push({ label: "Client", value: item.Client.name });
  const due = dateLabel(body.due);
  if (due) lines.push({ label: "Due", value: due });

  const html = page({
    heading: copy.heading,
    lead: copy.lead,
    lines,
    note: body.note?.trim() || undefined,
    action: { label: "Open it in Agency OS", path: `content/${item.id}` },
    because: "Sent by Agency OS because this video is on your desk.",
  });

  // One failed address shouldn't cost the others their mail.
  const results = await Promise.allSettled(
    recipients.map((m) => send(m.email!, copy.subject, html)),
  );
  const failed = results.filter((r) => r.status === "rejected");
  for (const f of failed) console.error("notify:", (f as PromiseRejectedResult).reason);

  return ok({ sent: results.length - failed.length, failed: failed.length });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    return await handle(req);
  } catch (e) {
    // Whatever went wrong stays in the function's own logs. These reads run as
    // the service role, and their error text can carry more than the browser
    // has any business seeing.
    console.error("notify:", e);
    return no("Couldn't send that notification.", 500);
  }
});
