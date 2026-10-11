/**
 * The one place Agency OS sends email from.
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
 * Secrets it needs (supabase secrets set …):
 *   RESEND_API_KEY   from resend.com -> API Keys
 *   EMAIL_FROM       "Agency OS <no-reply@yourdomain.com>", a verified sender
 *   APP_URL          where the app is hosted, for the link in each mail
 * SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected by
 * Supabase itself and don't need setting.
 *
 * Deploy:  npx supabase functions deploy notify
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// resend.dev is Resend's shared test sender: it works with no domain set up,
// but only ever delivers to the address that owns the Resend account. Real
// delivery to the team needs a verified domain and EMAIL_FROM set to it.
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Agency OS <onboarding@resend.dev>";
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

// ------------------------------------------------------------------ plumbing

/** A PostgREST read as the service role — past row level security, by design. */
async function db<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Read failed (${path}): ${await res.text()}`);
  return await res.json();
}

/** The signed-in person behind this call, or null if the token is no good. */
async function caller(jwt: string): Promise<{ email: string } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return typeof user?.email === "string" ? { email: user.email.toLowerCase() } : null;
}

async function send(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend refused it: ${await res.text()}`);
}

// -------------------------------------------------------------------- words

function refLabel(ref: number) {
  return `#${String(ref).padStart(3, "0")}`;
}

/** Deadlines are stored at midday UTC, so they read back as the day chosen. */
function dateLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function escape(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

type Line = { label: string; value: string };

/**
 * One layout for all four mails. Inline styles and a table, because that is
 * what mail clients actually render — Gmail strips <style> blocks.
 */
function page(opts: {
  heading: string;
  lead: string;
  lines: Line[];
  note?: string;
  link: string | null;
}) {
  const rows = opts.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:6px 16px 6px 0;color:#78716c;font-size:14px;white-space:nowrap;">${escape(l.label)}</td>
        <td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:500;">${escape(l.value)}</td>
      </tr>`,
    )
    .join("");

  const note = opts.note
    ? `<div style="margin:20px 0 0;padding:14px 16px;background:#fafaf9;border-left:3px solid #d6d3d1;border-radius:4px;color:#44403c;font-size:14px;line-height:1.5;">${escape(opts.note)}</div>`
    : "";

  const button = opts.link
    ? `<div style="margin:28px 0 0;"><a href="${escape(opts.link)}" style="display:inline-block;padding:11px 20px;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">Open it in Agency OS</a></div>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px;background:#ffffff;border-radius:10px;">
      <h1 style="margin:0 0 8px;font-size:19px;font-weight:600;color:#1c1917;">${escape(opts.heading)}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#57534e;">${escape(opts.lead)}</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
      ${note}
      ${button}
      <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e7e5e4;font-size:12px;color:#a8a29e;">
        Sent by Agency OS because this video is on your desk.
      </p>
    </div>
  </body>
</html>`;
}

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
  const [item] = await db<Item>(
    `ContentItem?id=eq.${encodeURIComponent(body.contentId)}` +
      `&select=id,agencyId,ref,title,Client(name),${FIELDS.join(",")}`,
  );
  if (!item) return no("No such video.", 404);

  // Everyone in this agency, which is both the recipient pool and the place the
  // CEO is found. Scoped to the video's own agency, so ids from elsewhere miss.
  const team = await db<Member & { role: string }>(
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
    link: APP_URL ? `${APP_URL}/content/${item.id}` : null,
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
