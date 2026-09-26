import Link from "next/link";
import { approveAll, payOne, reopenOne } from "@/app/(app)/payouts/actions";
import {
  IconAlert,
  IconCheckCircle,
  IconChevronLeft,
  IconClock,
  IconWallet,
} from "@/components/icons";
import { ApproveButton } from "@/components/payouts/approve-button";
import { PaySettingsButton } from "@/components/payouts/pay-settings-button";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/lib/auth";
import { payTypeLabel } from "@/lib/pay-rules";
import { monthPayouts } from "@/lib/payouts";
import { shiftMonth } from "@/lib/performance";
import { canManagePayouts } from "@/lib/permissions";
import { ROLE_LABELS, type Role } from "@/lib/pipeline";
import {
  cn,
  currentMonthKey,
  formatDate,
  formatMoney,
  initials,
  monthLabel,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireRole(canManagePayouts);
  const { month } = await searchParams;

  const thisMonth = currentMonthKey();
  const monthKey =
    month && /^\d{4}-\d{2}$/.test(month) && month <= thisMonth ? month : thisMonth;
  const isCurrent = monthKey === thisMonth;

  const all = await monthPayouts(user.agencyId, monthKey);
  const rows = all.filter((r) => r.onPayroll);
  const unpaid = all.filter((r) => !r.onPayroll);

  const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred).reduce((acc, r) => acc + r.total, 0);
  const total = sum(() => true);
  const paid = sum((r) => r.status === "paid");
  const approved = sum((r) => r.status === "approved");
  const estimates = rows.filter((r) => r.status === "estimate");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Payouts</h1>
          <p className="mt-2 text-base text-stone-500">
            What each person has earned, worked out from what they actually delivered.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month switcher */}
          <div className="flex items-center gap-1 rounded-full bg-white/80 p-1 ring-1 ring-stone-200">
            <Link
              href={`/payouts?month=${shiftMonth(monthKey, -1)}`}
              aria-label="Previous month"
              className="grid h-9 w-9 place-items-center rounded-full text-stone-600 transition-colors hover:bg-stone-100"
            >
              <IconChevronLeft className="h-4 w-4" />
            </Link>
            <span className="min-w-36 px-2 text-center text-sm font-medium text-stone-900">
              {monthLabel(monthKey)}
            </span>
            {isCurrent ? (
              <span className="grid h-9 w-9 place-items-center text-stone-300" aria-hidden>
                <IconChevronLeft className="h-4 w-4 rotate-180" />
              </span>
            ) : (
              <Link
                href={`/payouts?month=${shiftMonth(monthKey, 1)}`}
                aria-label="Next month"
                className="grid h-9 w-9 place-items-center rounded-full text-stone-600 transition-colors hover:bg-stone-100"
              >
                <IconChevronLeft className="h-4 w-4 rotate-180" />
              </Link>
            )}
          </div>

          <a
            href={`/payouts/export?month=${monthKey}`}
            className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition-colors hover:text-brand-800"
          >
            Export CSV
          </a>
          {estimates.length > 0 && (
            <form action={approveAll}>
              <input type="hidden" name="month" value={monthKey} />
              <Button type="submit">Approve all {estimates.length}</Button>
            </form>
          )}
        </div>
      </div>

      {isCurrent && (
        <div className="flex items-start gap-3 rounded-2xl bg-white/70 px-5 py-4 text-sm text-stone-600 ring-1 ring-stone-200">
          <IconClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p>
            {monthLabel(monthKey)} is still in progress, so these are running totals that grow
            as work is delivered. Approve them once the month has closed.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={IconWallet}
          label="Total payable"
          value={formatMoney(total)}
          tone="accent"
        />
        <Stat
          icon={IconClock}
          label="Not yet approved"
          value={formatMoney(total - approved - paid)}
          hint={`${estimates.length} ${estimates.length === 1 ? "person" : "people"}`}
        />
        <Stat icon={IconAlert} label="Approved, unpaid" value={formatMoney(approved)} />
        <Stat icon={IconCheckCircle} label="Paid" value={formatMoney(paid)} />
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left">
          <thead>
            <tr className="border-b border-stone-200/70 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <th className="px-6 py-4">Name</th>
              <th className="px-4 py-4">Pay type</th>
              <th className="px-4 py-4 text-right">Deliveries</th>
              <th className="px-4 py-4 text-right">Task pay</th>
              <th className="px-4 py-4 text-right">Salary</th>
              <th className="px-4 py-4 text-right">Adjust</th>
              <th className="px-4 py-4 text-right">Total</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/70">
            {rows.map((r) => (
              <tr key={r.memberId} className={cn(!r.active && "opacity-60")}>
                <td className="px-6 py-4">
                  <Link
                    href={`/team/${r.memberId}?month=${monthKey}`}
                    className="group flex items-center gap-3"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-medium text-brand-800 transition-colors group-hover:bg-brand-800 group-hover:text-white">
                      {initials(r.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-stone-900 group-hover:text-brand-800">
                        {r.name}
                      </p>
                      <p className="truncate text-sm text-stone-500">
                        {ROLE_LABELS[r.role as Role] ?? r.role}
                        {!r.active && " · deactivated"}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm text-stone-700">
                  {payTypeLabel(r.payType)}
                  {r.payType !== "salary" && (
                    <span className="block text-xs text-stone-400">
                      {formatMoney(r.rate)} each
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-right text-sm tabular-nums text-stone-700">
                  {r.payType === "salary" ? "—" : r.deliveries}
                </td>
                <td className="px-4 py-4 text-right text-sm tabular-nums text-stone-700">
                  {r.payType === "salary" ? "—" : formatMoney(r.taskPay)}
                </td>
                <td className="px-4 py-4 text-right text-sm tabular-nums text-stone-700">
                  {r.payType === "per_task" ? "—" : formatMoney(r.base)}
                </td>
                <td className="px-4 py-4 text-right text-sm tabular-nums">
                  {r.adjustment === 0 ? (
                    <span className="text-stone-300">—</span>
                  ) : (
                    <span
                      title={r.note ?? undefined}
                      className={r.adjustment > 0 ? "text-brand-700" : "text-red-600"}
                    >
                      {r.adjustment > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(r.adjustment))}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-right text-base font-semibold tabular-nums text-stone-900">
                  {formatMoney(r.total)}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      r.status === "estimate" && "bg-stone-100 text-stone-600",
                      r.status === "approved" && "bg-brand-50 text-brand-700",
                      r.status === "paid" && "bg-brand-800 text-white",
                    )}
                  >
                    {r.status === "estimate"
                      ? isCurrent
                        ? "Running total"
                        : "To approve"
                      : r.status === "approved"
                        ? "Approved"
                        : `Paid ${formatDate(r.paidAt)}`}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1.5">
                    {r.status === "estimate" && (
                      <>
                        <PaySettingsButton
                          memberId={r.memberId}
                          name={r.name}
                          payType={r.payType}
                          rate={r.rate}
                          salary={r.salary}
                        />
                        <ApproveButton row={r} month={monthKey} />
                      </>
                    )}
                    {r.status === "approved" && (
                      <>
                        <form action={reopenOne}>
                          <input type="hidden" name="memberId" value={r.memberId} />
                          <input type="hidden" name="month" value={monthKey} />
                          <button
                            type="submit"
                            className="rounded-full px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
                          >
                            Reopen
                          </button>
                        </form>
                        <form action={payOne}>
                          <input type="hidden" name="memberId" value={r.memberId} />
                          <input type="hidden" name="month" value={monthKey} />
                          <Button type="submit" size="sm">
                            Mark paid
                          </Button>
                        </form>
                      </>
                    )}
                    {r.status === "paid" && (
                      <span className="text-xs text-stone-400">
                        Locked
                        {r.approvedBy ? ` · approved by ${r.approvedBy.split(" ")[0]}` : ""}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200/70">
              <td colSpan={6} className="px-6 py-4 text-sm font-medium text-stone-500">
                {rows.length} people · {monthLabel(monthKey)}
              </td>
              <td className="px-4 py-4 text-right text-lg font-semibold tabular-nums text-stone-900">
                {formatMoney(total)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {unpaid.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 text-sm text-stone-500">
          <span>Not on payroll:</span>
          {unpaid.map((r) => (
            <span key={r.memberId} className="inline-flex items-center gap-1">
              <span className="font-medium text-stone-700">{r.name}</span>
              <PaySettingsButton
                memberId={r.memberId}
                name={r.name}
                payType={r.payType}
                rate={r.rate}
                salary={r.salary}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
