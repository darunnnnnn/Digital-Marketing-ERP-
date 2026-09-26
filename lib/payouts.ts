// Monthly pay. A month stays a live estimate until the CEO approves it; approval
// copies every number into a Payout row so it can never drift afterwards.

import { db } from "./db";
import { PAY_TYPES, computePay, onPayroll } from "./pay-rules";
import { memberPerformance } from "./performance";

export {
  PAY_TYPES,
  computePay,
  onPayroll,
  payTypeLabel,
  toCsv,
  type PayType,
} from "./pay-rules";

export type PayoutRow = {
  memberId: string;
  name: string;
  role: string;
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
 */
export async function monthPayouts(agencyId: string, monthKey: string): Promise<PayoutRow[]> {
  const [members, records] = await Promise.all([
    db.member.findMany({ where: { agencyId }, orderBy: { name: "asc" } }),
    db.payout.findMany({ where: { agencyId, monthKey } }),
  ]);
  const frozen = new Map(records.map((r) => [r.memberId, r]));

  const rows: PayoutRow[] = [];
  for (const m of members) {
    const rec = frozen.get(m.id);

    if (rec) {
      const pay = computePay(rec.payType, rec.deliveries, rec.rate, rec.salary, rec.adjustment);
      rows.push({
        memberId: m.id,
        name: m.name,
        role: m.role,
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
        approvedAt: rec.approvedAt,
        approvedBy: rec.approvedBy,
        paidAt: rec.paidAt,
      });
      continue;
    }

    const { summary } = await memberPerformance(m, monthKey);
    const pay = computePay(m.payType, summary.done, m.rate, m.salary);

    // Deactivated people only appear for months where they are owed something.
    if (!m.active && pay.total === 0) continue;

    rows.push({
      memberId: m.id,
      name: m.name,
      role: m.role,
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

/** Freezes one person's month. Returns false if it was already approved. */
export async function approvePayout(input: {
  agencyId: string;
  memberId: string;
  monthKey: string;
  adjustment?: number;
  note?: string | null;
  approvedBy?: string;
}) {
  const member = await db.member.findFirst({
    where: { id: input.memberId, agencyId: input.agencyId },
  });
  if (!member) return false;

  if (!onPayroll(member.payType, member.rate, member.salary)) return false;

  const existing = await db.payout.findUnique({
    where: { memberId_monthKey: { memberId: member.id, monthKey: input.monthKey } },
  });
  if (existing) return false;

  const { summary } = await memberPerformance(member, input.monthKey);
  const adjustment = Math.round(input.adjustment ?? 0);
  const pay = computePay(member.payType, summary.done, member.rate, member.salary, adjustment);

  await db.payout.create({
    data: {
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
      approvedBy: input.approvedBy,
    },
  });
  return true;
}

export async function markPaid(agencyId: string, memberId: string, monthKey: string) {
  const { count } = await db.payout.updateMany({
    where: { agencyId, memberId, monthKey, status: "approved" },
    data: { status: "paid", paidAt: new Date() },
  });
  return count > 0;
}

/** Undoes an approval so the month is live again. Paid months stay locked. */
export async function reopenPayout(agencyId: string, memberId: string, monthKey: string) {
  const { count } = await db.payout.deleteMany({
    where: { agencyId, memberId, monthKey, status: "approved" },
  });
  return count > 0;
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
  const { count } = await db.member.updateMany({
    where: { id: memberId, agencyId },
    data: settings,
  });
  return count ? null : "That person is no longer on the team.";
}
