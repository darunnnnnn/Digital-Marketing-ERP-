// Invite links. The browser holds a random token; the database holds only its
// SHA-256, so a copy of the database can't be used to claim an invite.

import { supabase } from "./supabase";

export const INVITE_DAYS = 7;

export function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url, the same shape the old server's tokens had.
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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

/** Issues a fresh invite link token for a member, replacing any earlier one. */
export async function issueInvite(memberId: string) {
  const token = newToken();
  const { error } = await supabase
    .from("Member")
    .update({
      inviteTokenHash: await hashToken(token),
      inviteExpires: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    })
    .eq("id", memberId);
  if (error) throw new Error(`Couldn't create an invite link: ${error.message}`);
  return `${window.location.origin}/invite/${token}`;
}
