/**
 * Sending someone their way in: an invite to set a first password, or a reset
 * link for one they've forgotten.
 *
 * This used to happen in the browser — it minted a token, wrote the hash to the
 * Member row, and handed the CEO a link to copy into WhatsApp by hand. That
 * worked, but it made adding a person a chore with a manual step in the middle,
 * which is the kind of thing this product exists to remove.
 *
 * Moving it here buys something besides convenience. The token is generated,
 * hashed and mailed entirely inside this function, so the only plaintext copy
 * that ever exists is the one in the recipient's inbox — the browser that asked
 * for the invite never sees it, and so cannot leak it, log it or have it read
 * off the screen. The database still stores nothing but the SHA-256, exactly as
 * before, so a copy of the database is still no use for claiming an invite.
 *
 * The one exception is a send that fails. Then the link comes back in the
 * response so the CEO can still pass it on themselves, because a person locked
 * out of the app is a worse problem than a token on a screen.
 *
 * Deploy:  npx supabase functions deploy invite
 */

import { caller, read, update } from "../_shared/db.ts";
import { CORS, RESEND_API_KEY, appLink, page, send } from "../_shared/mail.ts";

/** How long a link stays good. Matches INVITE_DAYS in src/lib/invites.ts. */
const INVITE_DAYS = 7;

type Member = {
  id: string;
  agencyId: string;
  name: string;
  email: string | null;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
};

/** base64url, the shape the invite page already expects. */
function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** SHA-256, hex — matching what is already stored for existing invites. */
async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!jwt) return no("Sign in first.", 401);
  const me = await caller(jwt);
  if (!me) return no("That session isn't valid.", 401);

  let body: { memberId?: string };
  try {
    body = await req.json();
  } catch {
    return no("Expected JSON.", 400);
  }
  if (!body.memberId) return no("No member given.", 400);

  const [member] = await read<Member>(
    `Member?id=eq.${encodeURIComponent(body.memberId)}` +
      `&select=id,agencyId,name,email,role,active,lastLoginAt`,
  );
  if (!member) return no("No such member.", 404);

  // Inviting is the CEO's alone, which is also what row level security says
  // about writing a Member row. Checked here against the member's own agency,
  // so a CEO of one agency cannot issue links into another.
  const team = await read<Member>(
    `Member?agencyId=eq.${encodeURIComponent(member.agencyId)}&select=id,name,email,role,active`,
  );
  const actor = team.find((m) => m.email?.toLowerCase() === me.email && m.active);
  if (!actor) return no("That team isn't yours.", 403);
  if (actor.role !== "ceo") return no("Only the CEO can invite people.", 403);

  if (!member.active) return no("That person is deactivated.", 400);
  if (!member.email) return no("That person has no email address on file.", 400);

  // A fresh token replaces any earlier one, so an invite that was sent twice
  // only ever has one link that works — the most recent.
  const token = newToken();
  await update("Member", `id=eq.${encodeURIComponent(member.id)}`, {
    inviteTokenHash: await hashToken(token),
    inviteExpires: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
  });

  const path = `invite/${token}`;
  const link = appLink(path);

  // Someone who has signed in before is resetting a password, not joining.
  // Taken from their own row rather than the caller's word for it.
  const joining = !member.lastLoginAt;
  const first = member.name.split(" ")[0];

  const subject = joining
    ? `${actor.name} added you to Agency OS`
    : "Set a new password for Agency OS";

  const html = page({
    heading: joining ? `You're on the team, ${first}` : "Set a new password",
    lead: joining
      ? `${actor.name} added you to Agency OS. Pick a password and your work is waiting for you.`
      : `${actor.name} sent you a link to set a new password. Your current one keeps working until you do.`,
    lines: [
      { label: "Name", value: member.name },
      { label: "Sign in with", value: member.email },
    ],
    note: `This link works once and expires in ${INVITE_DAYS} days. If you didn't expect it, ignore it — nothing changes until it's opened.`,
    action: { label: joining ? "Set your password" : "Choose a new password", path },
    because: joining
      ? "Sent by Agency OS because you were added to the team."
      : "Sent by Agency OS because a password reset was requested for you.",
  });

  if (!RESEND_API_KEY || !link) {
    // Not configured to send. The link still has to reach them somehow.
    return ok({ sent: false, link, why: "Email isn't set up on this project." });
  }

  try {
    await send(member.email, subject, html);
    return ok({ sent: true, email: member.email });
  } catch (e) {
    console.error("invite:", e);
    // The token is already live, so hand it back rather than stranding them.
    return ok({ sent: false, link, why: "The email couldn't be sent." });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    return await handle(req);
  } catch (e) {
    console.error("invite:", e);
    return no("Couldn't create that invite.", 500);
  }
});
