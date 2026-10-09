// Monthly pay. A month stays a live estimate until the CEO approves it; approval
// copies every number into a Payout row so it can never drift afterwards.

import { db } from "./db";
import { PAY_TYPES, computePay, onPayroll } from "./pay-rules";
import { memberPerformance, rolesByMember } from "./performance";

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

  // Everyone who still needs live numbers is calculated at once, not one
  // person after another — otherwise the page slows down with every hire.
  // The roles lookup is batched too, so adding multi-role support did not turn
  // this page into one extra query per person.
  const pending = members.filter((m) => !frozen.has(m.id));
  const roles = await rolesByMember(agencyId, pending);
  const live = new Map(
    await Promise.all(
      pending.map(
        async (m) =>
          [
            m.id,
            (await memberPerformance(m, monthKey, new Date(), roles.get(m.id))).summary,
          ] as const,
      ),
    ),
  );

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

    const summary = live.get(m.id)!;
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

export type MemberEarnings = {
  monthKey: string;
  payType: string;
  rate: number;
  salary: number;
  deliveries: number;
  taskPay: number;
  base: number;
  adjustment: number;
  note: string | null;
  total: number;
  status: "estimate" | "approved" | "paid";
  onPayroll: boolean;
  paidAt: Date | null;
  /** What made up the deliveries, per step — a multi-role person works several. */
  breakdown: { step: string; done: number }[];
  roles: string[];
};

/**
 * One person's own pay for a month. Deliberately separate from monthPayouts:
 * this is what someone is shown about themselves, so it never reads anybody
 * else's rate or total.
 *
 * An approved month is read from its frozen record; an open one is a running
 * estimate off current deliveries and current rates.
 */
export async function memberEarnings(
  member: {
    id: string;
    name: string;
    role: string;
    agencyId: string;
    payType: string;
    rate: number;
    salary: number;
  },
  monthKey: string,
): Promise<MemberEarnings> {
  const [record, perf, roles] = await Promise.all([
    db.payout.findUnique({
      where: { memberId_monthKey: { memberId: member.id, monthKey } },
    }),
    memberPerformance(member, monthKey),
    rolesByMember(member.agencyId, [member]).then((m) => m.get(member.id) ?? [member.role]),
  ]);

  // Grouped by the step label the pipeline already uses, so "Scripts written 4,
  // Edits delivered 3" reads the same here as on their profile.
  const counts = new Map<string, number>();
  for (const row of perf.completed) counts.set(row.step, (counts.get(row.step) ?? 0) + 1);
  const breakdown = [...counts.entries()]
    .map(([step, done]) => ({ step, done }))
    .sort((a, b) => b.done - a.done);

  if (record) {
    const pay = computePay(
      record.payType,
      record.deliveries,
      record.rate,
      record.salary,
      record.adjustment,
    );
    return {
      monthKey,
      payType: record.payType,
      rate: record.rate,
      salary: record.salary,
      deliveries: record.deliveries,
      taskPay: pay.taskPay,
      base: pay.base,
      adjustment: record.adjustment,
      note: record.note,
      total: record.amount,
      status: record.status === "paid" ? "paid" : "approved",
      onPayroll: true,
      paidAt: record.paidAt,
      breakdown,
      roles,
    };
  }

  const pay = computePay(member.payType, perf.summary.done, member.rate, member.salary);
  return {
    monthKey,
    payType: member.payType,
    rate: member.rate,
    salary: member.salary,
    deliveries: perf.summary.done,
    taskPay: pay.taskPay,
    base: pay.base,
    adjustment: 0,
    note: null,
    total: pay.total,
    status: "estimate",
    onPayroll: onPayroll(member.payType, member.rate, member.salary),
    paidAt: null,
    breakdown,
    roles,
  };
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
