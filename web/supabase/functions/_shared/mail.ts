/**
 * The one email layout, shared by every function that sends mail.
 *
 * Two functions send now — `notify`, when someone moves a video, and `sweep`,
 * on a schedule — and both go through `page()` here. That is deliberate: the
 * rule that every mail carries a button back into the app is a rule about the
 * layout, and it only holds if there is one layout to keep it in. `page()`
 * takes `action` as a required argument rather than an optional link, so a new
 * mail cannot be written without saying where it goes.
 *
 * Secrets (supabase secrets set …):
 *   RESEND_API_KEY   from resend.com -> API Keys
 *   EMAIL_FROM       "Agency OS <no-reply@yourdomain.com>", a verified sender
 *   APP_URL          where the app is hosted, for the links
 */

export const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// resend.dev is Resend's shared test sender: it works with no domain set up,
// but only ever delivers to the address that owns the Resend account. Real
// delivery to the team needs a verified domain and EMAIL_FROM set to it.
export const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Agency OS <onboarding@resend.dev>";

export const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

if (!APP_URL) {
  // Worth a line in the logs on every cold start rather than a silent
  // degradation: a mail nobody can click through from is most of the value of
  // sending it gone, and the cause is one secret away.
  console.warn("mail: APP_URL isn't set, so mail will go out with no link in it.");
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** An absolute link into the app, or null when APP_URL hasn't been set. */
export function appLink(path: string) {
  if (!APP_URL) return null;
  return `${APP_URL}/${path.replace(/^\/+/, "")}`;
}

export async function send(to: string, subject: string, html: string) {
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

export function refLabel(ref: number) {
  return `#${String(ref).padStart(3, "0")}`;
}

/** Deadlines are stored at midday UTC, so they read back as the day chosen. */
export function dateLabel(iso: string | null | undefined) {
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

export function escape(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// ------------------------------------------------------------------- layout

/** A label-and-value pair in the small table under the lead paragraph. */
export type Line = { label: string; value: string };

/**
 * One line of a list mail — a digest, a bottleneck report. Each carries its own
 * path, because a list of ten videos that all link to the same page is a list
 * nobody clicks: the point of the digest is to get to the one that matters.
 */
export type Item = { text: string; meta?: string; path?: string };

/** The button at the bottom. Every mail has one; see the note at the top. */
export type Action = { label: string; path: string };

const INK = "#1c1917";
const MUTED = "#78716c";
const FAINT = "#a8a29e";

function table(lines: Line[]) {
  if (lines.length === 0) return "";
  const rows = lines
    .map(
      (l) => `
      <tr>
        <td style="padding:6px 16px 6px 0;color:${MUTED};font-size:14px;white-space:nowrap;">${escape(l.label)}</td>
        <td style="padding:6px 0;color:${INK};font-size:14px;font-weight:500;">${escape(l.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
}

function list(items: Item[]) {
  if (items.length === 0) return "";
  const rows = items
    .map((i) => {
      const href = i.path ? appLink(i.path) : null;
      // A link where there is one, the same words as plain text where there
      // isn't, so an unconfigured APP_URL costs the reader nothing but the click.
      const text = href
        ? `<a href="${escape(href)}" style="color:${INK};text-decoration:none;border-bottom:1px solid #d6d3d1;">${escape(i.text)}</a>`
        : escape(i.text);
      const meta = i.meta
        ? `<div style="margin-top:2px;color:${MUTED};font-size:13px;">${escape(i.meta)}</div>`
        : "";
      return `
      <tr>
        <td style="padding:10px 0;border-top:1px solid #e7e5e4;color:${INK};font-size:14px;font-weight:500;">
          ${text}${meta}
        </td>
      </tr>`;
    })
    .join("");
  return `<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:20px 0 0;">${rows}</table>`;
}

/**
 * One layout for every mail Agency OS sends. Inline styles and tables, because
 * that is what mail clients actually render — Gmail strips <style> blocks.
 */
export function page(opts: {
  heading: string;
  lead: string;
  lines?: Line[];
  items?: Item[];
  note?: string;
  action: Action;
  /** The sentence at the bottom saying why this arrived. */
  because: string;
}) {
  const href = appLink(opts.action.path);

  const note = opts.note
    ? `<div style="margin:20px 0 0;padding:14px 16px;background:#fafaf9;border-left:3px solid #d6d3d1;border-radius:4px;color:#44403c;font-size:14px;line-height:1.5;">${escape(opts.note)}</div>`
    : "";

  const button = href
    ? `<div style="margin:28px 0 0;"><a href="${escape(href)}" style="display:inline-block;padding:11px 20px;background:${INK};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">${escape(opts.action.label)}</a></div>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:32px;background:#ffffff;border-radius:10px;">
      <h1 style="margin:0 0 8px;font-size:19px;font-weight:600;color:${INK};">${escape(opts.heading)}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#57534e;">${escape(opts.lead)}</p>
      ${table(opts.lines ?? [])}
      ${list(opts.items ?? [])}
      ${note}
      ${button}
      <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e7e5e4;font-size:12px;color:${FAINT};">
        ${escape(opts.because)}
      </p>
    </div>
  </body>
</html>`;
}
