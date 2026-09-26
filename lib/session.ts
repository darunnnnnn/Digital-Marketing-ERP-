// Sessions and invite tokens. The browser holds a random token; the database
// holds only its SHA-256, so a copy of the database can't be used to sign in.

import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export const SESSION_DAYS = 30;
export const INVITE_DAYS = 7;

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(memberId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { id: hashToken(token), memberId, expiresAt } });
  await db.member.update({ where: { id: memberId }, data: { lastLoginAt: new Date() } });
  return { token, expiresAt };
}

/** The signed-in member for a cookie token, or null if missing, expired or deactivated. */
export async function memberForToken(token: string | undefined) {
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { member: { include: { agency: true } } },
  });
  if (!session) return null;

  if (session.expiresAt < new Date() || !session.member.active) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.member;
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

/** Signs a member out everywhere — used when they are deactivated. */
export async function deleteAllSessions(memberId: string) {
  await db.session.deleteMany({ where: { memberId } });
}

/** Issues a fresh invite link token for a member, replacing any earlier one. */
export async function issueInvite(memberId: string) {
  const token = newToken();
  await db.member.update({
    where: { id: memberId },
    data: {
      inviteTokenHash: hashToken(token),
      inviteExpires: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    },
  });
  return token;
}

export async function memberForInvite(token: string) {
  const member = await db.member.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: { agency: true },
  });
  if (!member || !member.active) return null;
  if (!member.inviteExpires || member.inviteExpires < new Date()) return null;
  return member;
}

/**
 * The member behind a one-click demo sign-in, or null when it isn't allowed.
 * Kept here, away from the form, so the rule can be tested on its own.
 */
export async function demoMember(
  email: string,
  isProduction = process.env.NODE_ENV === "production",
) {
  if (isProduction) return null;

  const address = email.trim().toLowerCase();
  if (!address.endsWith("@demo.test")) return null;

  const member = await db.member.findUnique({ where: { email: address } });
  return member && member.active ? member : null;
}
