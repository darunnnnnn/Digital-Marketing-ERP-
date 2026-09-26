"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ACCENT_KEYS } from "@/lib/theme";

export type ClientFormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

const STATUSES = ["active", "paused", "archived"];

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function parse(fd: FormData) {
  const values = {
    name: text(fd, "name"),
    industry: text(fd, "industry"),
    status: text(fd, "status") || "active",
    accent: "default",
    contactName: text(fd, "contactName"),
    contactEmail: text(fd, "contactEmail"),
    contactPhone: text(fd, "contactPhone"),
    monthlyTarget: text(fd, "monthlyTarget"),
    monthlyPostTarget: text(fd, "monthlyPostTarget"),
    retainer: text(fd, "retainer"),
    services: text(fd, "services"),
    notes: text(fd, "notes"),
  };

  const errors: Record<string, string> = {};

  if (!values.name) errors.name = "Client name is required.";
  else if (values.name.length > 80) errors.name = "Keep the name under 80 characters.";

  if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) {
    errors.contactEmail = "That doesn't look like a valid email.";
  }

  const target = Number(values.monthlyTarget || 0);
  if (!Number.isInteger(target) || target < 0 || target > 999) {
    errors.monthlyTarget = "Enter a whole number between 0 and 999.";
  }

  const postTarget = Number(values.monthlyPostTarget || 0);
  if (!Number.isInteger(postTarget) || postTarget < 0 || postTarget > 999) {
    errors.monthlyPostTarget = "Enter a whole number between 0 and 999.";
  }

  const retainer = Number(values.retainer || 0);
  if (!Number.isFinite(retainer) || retainer < 0) {
    errors.retainer = "Enter a positive amount.";
  }

  if (!STATUSES.includes(values.status)) values.status = "active";
  if (!ACCENT_KEYS.includes(values.accent as never)) values.accent = "default";

  return {
    values,
    errors,
    data: {
      name: values.name,
      industry: values.industry || null,
      status: values.status,
      accent: values.accent,
      contactName: values.contactName || null,
      contactEmail: values.contactEmail || null,
      contactPhone: values.contactPhone || null,
      monthlyTarget: target,
      monthlyPostTarget: postTarget,
      retainer: Math.round(retainer),
      services: values.services,
      notes: values.notes || null,
    },
  };
}

export async function createClient(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const { values, errors, data } = parse(formData);
  if (Object.keys(errors).length > 0) return { errors, values };

  const user = await requireRole(canManageClients);
  const client = await db.client.create({ data: { ...data, agencyId: user.agencyId } });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(
  id: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const { values, errors, data } = parse(formData);
  if (Object.keys(errors).length > 0) return { errors, values };

  const user = await requireRole(canManageClients);
  // updateMany with the agency in the filter: a client from another agency simply isn't matched.
  const { count } = await db.client.updateMany({
    where: { id, agencyId: user.agencyId },
    data,
  });
  if (count === 0) redirect("/clients");

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const user = await requireRole(canManageClients);
  await db.client.deleteMany({ where: { id, agencyId: user.agencyId } });

  revalidatePath("/clients");
  redirect("/clients");
}
