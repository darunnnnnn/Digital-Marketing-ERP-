"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  approvePayout,
  markPaid,
  monthPayouts,
  reopenPayout,
  savePaySettings,
} from "@/lib/payouts";
import { canManagePayouts } from "@/lib/permissions";

export type PayFormState = { error?: string; ok?: boolean };

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function validMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value) ? value : null;
}

function refresh(memberId?: string) {
  revalidatePath("/payouts");
  if (memberId) revalidatePath(`/team/${memberId}`);
}

export async function updatePaySettings(
  _prev: PayFormState,
  formData: FormData,
): Promise<PayFormState> {
  const user = await requireRole(canManagePayouts);
  const memberId = text(formData, "memberId");
  const error = await savePaySettings(user.agencyId, memberId, {
    payType: text(formData, "payType"),
    rate: Number(text(formData, "rate") || 0),
    salary: Number(text(formData, "salary") || 0),
  });
  if (error) return { error };
  refresh(memberId);
  return { ok: true };
}

export async function approveOne(
  _prev: PayFormState,
  formData: FormData,
): Promise<PayFormState> {
  const user = await requireRole(canManagePayouts);
  const monthKey = validMonth(text(formData, "month"));
  const memberId = text(formData, "memberId");
  if (!monthKey) return { error: "Unknown month." };

  const raw = text(formData, "adjustment");
  const adjustment = raw ? Number(raw) : 0;
  if (!Number.isFinite(adjustment)) return { error: "Adjustment must be a number." };
  const note = text(formData, "note");
  if (adjustment !== 0 && !note) {
    return { error: "Add a short reason for the bonus or deduction." };
  }

  const ok = await approvePayout({
    agencyId: user.agencyId,
    memberId,
    monthKey,
    adjustment,
    note,
    approvedBy: user.name,
  });
  if (!ok) return { error: "Already approved, or this person has no pay set up." };
  refresh(memberId);
  return { ok: true };
}

/** Approves every open estimate for the month, with no adjustments. */
export async function approveAll(formData: FormData) {
  const user = await requireRole(canManagePayouts);
  const monthKey = validMonth(text(formData, "month"));
  if (!monthKey) return;

  const rows = await monthPayouts(user.agencyId, monthKey);
  for (const row of rows.filter((r) => r.status === "estimate" && r.onPayroll)) {
    await approvePayout({
      agencyId: user.agencyId,
      memberId: row.memberId,
      monthKey,
      approvedBy: user.name,
    });
  }
  refresh();
}

export async function payOne(formData: FormData) {
  const user = await requireRole(canManagePayouts);
  const monthKey = validMonth(text(formData, "month"));
  const memberId = text(formData, "memberId");
  if (monthKey && (await markPaid(user.agencyId, memberId, monthKey))) refresh(memberId);
}

export async function reopenOne(formData: FormData) {
  const user = await requireRole(canManagePayouts);
  const monthKey = validMonth(text(formData, "month"));
  const memberId = text(formData, "memberId");
  if (monthKey && (await reopenPayout(user.agencyId, memberId, monthKey))) refresh(memberId);
}
