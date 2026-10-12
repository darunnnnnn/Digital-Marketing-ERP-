// Invite links. The database holds only a token's SHA-256, so a copy of it
// can't be used to claim an invite. The token itself is minted and mailed by
// the `invite` edge function and never passes through here — this file only
// reads and spends a token that someone arrived with.

import { supabase } from "./supabase";

/** SHA-256, hex — matching what is already stored for existing invites. */
export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Invite = { name: string; email: string; role: string; agency: string };

/** Who an invite is for, or null for anything wrong, expired or already used. */
export async function readInvite(token: string): Promise<Invite | null> {
  const { data, error } = await supabase.rpc("app_invite", { token_hash: await hashToken(token) });
  if (error || !data || (data as Invite[]).length === 0) return null;
  return (data as Invite[])[0];
}

/** Spends the invite. False if someone already used it. */
export async function claimInvite(token: string) {
  const { data, error } = await supabase.rpc("app_claim_invite", {
    token_hash: await hashToken(token),
  });
  return !error && data === true;
}

/**
 * What happened when we tried to get someone their link. Either it is in their
 * inbox, or it isn't and the link itself comes back so it can be passed on by
 * hand — being unable to send mail is no reason to leave someone locked out.
 */
export type InviteResult =
  | { sent: true; email: string }
  | { sent: false; link: string | null; why: string };

/**
 * Emails someone a fresh link to set their password, replacing any earlier one.
 *
 * The token is minted inside the edge function, not here — see
 * supabase/functions/invite. This asks for a member by id and never handles the
 * token itself, so the only plaintext copy is the one in their inbox. The one
 * exception is a send that failed, which hands the link back so it can still be
 * delivered some other way.
 */
export async function sendInvite(memberId: string): Promise<InviteResult> {
  const { data, error } = await supabase.functions.invoke("invite", { body: { memberId } });

  if (error) {
    // supabase-js reports every failed status as the same sentence; the
    // function's own explanation is in the response hung off the error.
    throw new Error(await readError(error));
  }
  return data as InviteResult;
}

async function readError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Couldn't send that invite.";
  const res = (error as { context?: Response }).context;
  if (!(res instanceof Response)) return fallback;
  try {
    const body = await res.clone().json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}
