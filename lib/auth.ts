// The signed-in person, read from the session cookie. Server-only.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Viewer } from "./permissions";
import { createSession, deleteSession, memberForToken } from "./session";

export const SESSION_COOKIE = "aos_session";

/** Memoised per request, so layout, page and actions share one lookup. */
export const getUser = cache(async () => {
  const store = await cookies();
  return memberForToken(store.get(SESSION_COOKIE)?.value);
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Sends anyone who fails the check back to the pipeline, which everyone can see. */
export async function requireRole(check: (v: Viewer) => boolean) {
  const user = await requireUser();
  if (!check(user)) redirect("/content");
  return user;
}

export async function startSession(memberId: string) {
  const { token, expiresAt } = await createSession(memberId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, // unreadable from page scripts
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const store = await cookies();
  await deleteSession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
}

/** Only same-site paths, so ?next= can't bounce someone to another website. */
export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/content";
  }
  return value;
}
