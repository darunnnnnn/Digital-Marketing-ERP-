"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTeam } from "@/lib/permissions";
import { ROLES } from "@/lib/pipeline";
import { deleteAllSessions, issueInvite } from "@/lib/session";

export type InviteState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  link?: string;
  name?: string;
};

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

async function inviteUrl(token: string) {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${h.get("host")}/invite/${token}`;
}

/** A member of the CEO's own agency, or null. */
async function ownMember(id: string, agencyId: string) {
  return db.member.findFirst({ where: { id, agencyId } });
}

/** At least one active CEO must remain, or nobody could approve or manage the team. */
async function wouldLeaveNoCeo(agencyId: string, changingId: string) {
  const others = await db.member.count({
    where: { agencyId, role: "ceo", active: true, id: { not: changingId } },
  });
  return others === 0;
}

export async function inviteMember(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const user = await requireRole(canManageTeam);

  const values = {
    name: text(formData, "name"),
    email: text(formData, "email").toLowerCase(),
    role: text(formData, "role"),
  };

  const errors: Record<string, string> = {};
  if (!values.name) errors.name = "Add their name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Enter a valid email.";
  if (!(ROLES as readonly string[]).includes(values.role)) errors.role = "Pick a role.";

  if (!errors.email && (await db.member.findUnique({ where: { email: values.email } }))) {
    errors.email = "Someone already uses this email.";
  }

  if (Object.keys(errors).length > 0) return { errors, values };

  const member = await db.member.create({
    data: {
      agencyId: user.agencyId,
      name: values.name,
      email: values.email,
      role: values.role,
    },
  });
  const token = await issueInvite(member.id);

  revalidatePath("/team");
  return { link: await inviteUrl(token), name: member.name };
}

/** A fresh link — for an invite that expired, or someone who forgot their password. */
export async function newInviteLink(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const user = await requireRole(canManageTeam);
  const member = await ownMember(text(formData, "id"), user.agencyId);
  if (!member) return { errors: { id: "That person is no longer on the team." } };

  const token = await issueInvite(member.id);
  revalidatePath("/team");
  return { link: await inviteUrl(token), name: member.name };
}

export async function changeRole(formData: FormData) {
  const user = await requireRole(canManageTeam);
  const member = await ownMember(text(formData, "id"), user.agencyId);
  const role = text(formData, "role");

  if (!member || member.id === user.id) return; // your own role can't be changed from here
  if (!(ROLES as readonly string[]).includes(role)) return;
  if (
    member.role === "ceo" &&
    role !== "ceo" &&
    (await wouldLeaveNoCeo(user.agencyId, member.id))
  ) {
    return;
  }

  await db.member.update({ where: { id: member.id }, data: { role } });
  revalidatePath("/team");
}

export async function setActive(formData: FormData) {
  const user = await requireRole(canManageTeam);
  const member = await ownMember(text(formData, "id"), user.agencyId);
  const active = text(formData, "active") === "true";

  if (!member || member.id === user.id) return; // can't lock yourself out
  if (!active && member.role === "ceo" && (await wouldLeaveNoCeo(user.agencyId, member.id))) {
    return;
  }

  await db.member.update({ where: { id: member.id }, data: { active } });
  // Deactivating signs them out everywhere, immediately.
  if (!active) await deleteAllSessions(member.id);
  revalidatePath("/team");
}
