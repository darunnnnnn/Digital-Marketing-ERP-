"use server";

import { redirect } from "next/navigation";
import { endSession, safeNext, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/password";
import { demoMember, memberForInvite } from "@/lib/session";

export type AuthState = { error?: string; email?: string };

// Checked even when no account matches, so a wrong email and a wrong
// password take the same time and can't be told apart.
const DUMMY_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password.", email };

  const member = await db.member.findUnique({ where: { email } });
  const ok = await verifyPassword(password, member?.passwordHash ?? DUMMY_HASH);

  // One message for every failure, so the form never confirms which emails exist.
  if (!member || !ok || !member.active) {
    return { error: "That email and password don't match.", email };
  }

  await startSession(member.id);
  redirect(safeNext(String(formData.get("next") ?? "")));
}

/**
 * One-click sign-in for the demo accounts while testing.
 * Refuses in production, and only ever works for @demo.test addresses.
 */
export async function signInAsDemo(formData: FormData) {
  const member = await demoMember(String(formData.get("email") ?? ""));
  if (!member) return;

  await startSession(member.id);
  redirect("/content");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}

export async function acceptInvite(
  token: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const member = await memberForInvite(token);
  if (!member) return { error: "This invite link has expired or was already used." };

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) return { error: "The two passwords don't match." };

  await db.member.update({
    where: { id: member.id },
    data: {
      passwordHash: await hashPassword(password),
      inviteTokenHash: null, // one use only
      inviteExpires: null,
    },
  });

  await startSession(member.id);
  redirect("/content");
}
