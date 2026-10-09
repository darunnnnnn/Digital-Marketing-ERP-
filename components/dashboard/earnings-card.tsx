import { IconWallet } from "@/components/icons";
import { payTypeLabel } from "@/lib/pay-rules";
import type { MemberEarnings } from "@/lib/payouts";
import { cn, formatDate, formatMoney, monthLabel } from "@/lib/utils";

const STATUS: Record<MemberEarnings["status"], { label: string; chip: string }> = {
  estimate: { label: "Running total", chip: "bg-white/20 text-white ring-white/30" },
  approved: { label: "Approved", chip: "bg-white/20 text-white ring-white/30" },
  paid: { label: "Paid", chip: "bg-white text-brand-800 ring-white" },
};

/**
 * What this person has earned this month, and where it came from.
 *
 * Deliberately the loudest thing on the dashboard: it is the number people
 * open the app to check. The wording has to stay honest about which kind of
 * number it is — a month still running is an estimate that keeps growing, and
 * promising a figure that later drops would be worse than showing nothing.
 */
export function EarningsCard({ earnings }: { earnings: MemberEarnings }) {
  const { status, payType, total, deliveries, rate, breakdown } = earnings;
  const perTask = payType === "per_task" || payType === "hybrid";
  const salaried = payType === "salary" || payType === "hybrid";
  const badge = STATUS[status];

  if (!earnings.onPayroll) {
    return (
      <section className="surface p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500">
            <IconWallet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-stone-900">
              Earnings for {monthLabel(earnings.monthKey)}
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">
              No pay is set up for you yet — ask the CEO to set your rate.
            </p>
          </div>
        </div>

        {deliveries > 0 && (
          <p className="mt-4 rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm text-stone-600">
            Your {deliveries} {deliveries === 1 ? "delivery" : "deliveries"} this month are
            still counted, so nothing is lost once a rate is set.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand-800 p-5 text-white shadow-xl shadow-brand-900/25 sm:p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/40 blur-3xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-100">
            You earned · {monthLabel(earnings.monthKey)}
          </p>
          <p className="mt-1.5 break-words text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
            {formatMoney(total)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
            badge.chip,
          )}
        >
          {badge.label}
        </span>
      </div>

      <p className="relative mt-2 text-sm text-brand-100">
        {status === "estimate"
          ? `${monthLabel(earnings.monthKey)} is still open, so this grows as you deliver. The CEO approves it once the month closes.`
          : status === "approved"
            ? "Approved by the CEO and locked. Payment is on its way."
            : `Paid${earnings.paidAt ? ` on ${formatDate(earnings.paidAt)}` : ""}.`}
      </p>

      {/* How the number is built up. */}
      <dl className="relative mt-5 space-y-2 border-t border-white/20 pt-4 text-sm">
        {salaried && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-brand-100">Salary</dt>
            <dd className="font-medium tabular-nums">{formatMoney(earnings.base)}</dd>
          </div>
        )}
        {perTask && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-brand-100">
              {deliveries} {deliveries === 1 ? "delivery" : "deliveries"} × {formatMoney(rate)}
            </dt>
            <dd className="font-medium tabular-nums">{formatMoney(earnings.taskPay)}</dd>
          </div>
        )}
        {earnings.adjustment !== 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-brand-100">
              {earnings.adjustment > 0 ? "Bonus" : "Deduction"}
              {earnings.note ? ` · ${earnings.note}` : ""}
            </dt>
            <dd className="font-medium tabular-nums">
              {earnings.adjustment > 0 ? "+" : "−"}
              {formatMoney(Math.abs(earnings.adjustment))}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-white/20 pt-2">
          <dt className="font-medium">Total</dt>
          <dd className="text-base font-semibold tabular-nums">{formatMoney(total)}</dd>
        </div>
      </dl>

      {/* What the deliveries were. Someone who writes and edits is paid the
          same rate for both, so the split is the only way to see the mix. */}
      {perTask && breakdown.length > 0 && (
        <div className="relative mt-4 border-t border-white/20 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-200">
            Counted from
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {breakdown.map((b) => (
              <li
                key={b.step}
                className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium"
              >
                {b.step}
                <span className="ml-1.5 tabular-nums text-brand-100">{b.done}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="relative mt-4 text-[11px] text-brand-200">
        {payTypeLabel(payType)}
        {perTask && ` · ${formatMoney(rate)} per delivery`}
      </p>
    </section>
  );
}
