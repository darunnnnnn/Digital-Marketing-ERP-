// Monthly pay. A month stays a live estimate until the CEO approves it; approval
// copies every number into a Payout row so it can never drift afterwards.

import { supabase } from "./supabase";
import { PAY_TYPES, computePay, onPayroll } from "./pay-rules";
import { loadPerfSource, measureMember } from "./performance";
import { toDate } from "./utils";
import type { Member, Payout } from "./types";

export { PAY_TYPES, computePay, onPayroll, payTypeLabel, toCsv, type PayType } from "./pay-rules";

export type PayoutRow = {
  memberId: string;
  name: string;
  role: string;
  roles: string[];
  active: boolean;
  payType: string;
  deliveries: number;
  rate: number;
  salary: number;
  taskPay: number;
  base: number;
  adjustment: number;
  note: string | null;
  total: number;
  status: "estimate" | "approved" | "paid";
  /** No pay configured, so there is nothing to approve. Frozen rows are always on payroll. */
  onPayroll: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  paidAt: Date | null;
};

/**
 * Everyone's pay for a month. Approved months read from their frozen record;
 * open months are computed live from current deliveries and current rates.
 *
 * Three round trips total — team, frozen records, and the month's videos —
 * however many people are on payroll.
 */
export async function monthPayouts(agencyId: string, monthKey: string): Promise<PayoutRow[]> {
  const [team, records, source] = await Promise.all([
    supabase.from("Member").select("*").eq("agencyId", agencyId).order("name"),
    supabase.from("Payout").select("*").eq("agencyId", agencyId).eq("monthKey", monthKey),
    loadPerfSource(agencyId, monthKey),
  ]);

  if (team.error) throw new Error(`Couldn't load payouts: ${team.error.message}`);

  const members = (team.data ?? []) as Member[];
  const frozen = new Map(((records.data ?? []) as Payout[]).map((r) => [r.memberId, r]));

  const rows: PayoutRow[] = [];
  for (const m of members) {
    const rec = frozen.get(m.id);

    if (rec) {
      const pay = computePay(rec.payType, rec.deliveries, rec.rate, rec.salary, rec.adjustment);
      rows.push({
        memberId: m.id,
        name: m.name,
        role: m.role,
        roles: m.roles,
        active: m.active,
        payType: rec.payType,
        deliveries: rec.deliveries,
        rate: rec.rate,
        salary: rec.salary,
        taskPay: pay.taskPay,
        base: pay.base,
        adjustment: rec.adjustment,
        note: rec.note,
        total: rec.amount,
        status: rec.status === "paid" ? "paid" : "approved",
        onPayroll: true,
        approvedAt: toDate(rec.approvedAt),
        approvedBy: rec.approvedBy,
        paidAt: toDate(rec.paidAt),
      });
      continue;
    }

    const { summary } = measureMember(m, monthKey, source);
    const pay = computePay(m.payType, summary.done, m.rate, m.salary);

    // Deactivated people only appear for months where they are owed something.
    if (!m.active && pay.total === 0) continue;

    rows.push({
      memberId: m.id,
      name: m.name,
      role: m.role,
      roles: m.roles,
      active: m.active,
      payType: m.payType,
      deliveries: summary.done,
      rate: m.rate,
      salary: m.salary,
      taskPay: pay.taskPay,
      base: pay.base,
      adjustment: 0,
      note: null,
      total: pay.total,
      status: "estimate",
      onPayroll: onPayroll(m.payType, m.rate, m.salary),
      approvedAt: null,
      approvedBy: null,
      paidAt: null,
    });
  }
  return rows;
}

/**
 * Freezes one person's month. Returns false if it was already approved.
 * The deliveries count is recalculated here rather than taken from the page, so
 * what gets frozen is what the database says, not what a stale tab showed.
 */
export async function approvePayout(input: {
  agencyId: string;
  memberId: string;
  monthKey: string;
  adjustment?: number;
  note?: string | null;
  approvedBy?: string;
}) {
  const { data: member } = await supabase
    .from("Member")
    .select("*")
    .eq("id", input.memberId)
    .eq("agencyId", input.agencyId)
    .maybeSingle<Member>();
  if (!member) return false;

  if (!onPayroll(member.payType, member.rate, member.salary)) return false;

  const { data: existing } = await supabase
    .from("Payout")
    .select("id")
    .eq("memberId", member.id)
    .eq("monthKey", input.monthKey)
    .maybeSingle();
  if (existing) return false;

  const source = await loadPerfSource(input.agencyId, input.monthKey);
  const { summary } = measureMember(member, input.monthKey, source);
  const adjustment = Math.round(input.adjustment ?? 0);
  const pay = computePay(member.payType, summary.done, member.rate, member.salary, adjustment);

  const { error } = await supabase.from("Payout").insert({
    agencyId: input.agencyId,
    memberId: member.id,
    monthKey: input.monthKey,
    payType: member.payType,
    deliveries: summary.done,
    rate: member.rate,
    salary: member.salary,
    adjustment,
    note: input.note || null,
    amount: pay.total,
    approvedBy: input.approvedBy ?? null,
  });
  return !error;
}

export async function markPaid(agencyId: string, memberId: string, monthKey: string) {
  const { data, error } = await supabase
    .from("Payout")
    .update({ status: "paid", paidAt: new Date().toISOString() })
    .eq("agencyId", agencyId)
    .eq("memberId", memberId)
    .eq("monthKey", monthKey)
    .eq("status", "approved")
    .select("id");
  return !error && (data ?? []).length > 0;
}

/** Undoes an approval so the month is live again. Paid months stay locked. */
export async function reopenPayout(agencyId: string, memberId: string, monthKey: string) {
  const { data, error } = await supabase
    .from("Payout")
    .delete()
    .eq("agencyId", agencyId)
    .eq("memberId", memberId)
    .eq("monthKey", monthKey)
    .eq("status", "approved")
    .select("id");
  return !error && (data ?? []).length > 0;
}

export async function savePaySettings(
  agencyId: string,
  memberId: string,
  settings: { payType: string; rate: number; salary: number },
) {
  if (!PAY_TYPES.some((p) => p.key === settings.payType)) return "Pick a pay type.";
  if (![settings.rate, settings.salary].every((n) => Number.isInteger(n) && n >= 0)) {
    return "Amounts must be whole rupees, zero or more.";
  }
  const { data, error } = await supabase
    .from("Member")
    .update(settings)
    .eq("id", memberId)
    .eq("agencyId", agencyId)
    .select("id");
  if (error) return error.message;
  return (data ?? []).length ? null : "That person is no longer on the team.";
}
