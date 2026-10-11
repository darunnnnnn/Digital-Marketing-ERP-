import { IconWallet } from "@/components/icons";
import { payTypeLabel } from "@/lib/pay-rules";
import type { MemberEarnings } from "@/lib/payouts";
import { cn, formatDate, formatMoney, monthLabel } from "@/lib/utils";
import "./EarningsCard.css";

const STATUS_LABEL: Record<MemberEarnings["status"], string> = {
  estimate: "Running total",
  approved: "Approved",
  paid: "Paid",
};

/**
 * What this person has earned this month, and where it came from.
 *
 * Deliberately the loudest thing on the dashboard: it is the number people
 * open the app to check. The wording stays honest about which kind of number
 * it is — a month still running is an estimate that keeps growing, and
 * promising a figure that later drops would be worse than showing nothing.
 */
export function EarningsCard({ earnings }: { earnings: MemberEarnings }) {
  const { status, payType, total, deliveries, rate, breakdown } = earnings;
  const perTask = payType === "per_task" || payType === "hybrid";
  const salaried = payType === "salary" || payType === "hybrid";

  if (!earnings.onPayroll) {
    return (
      <section className="card earnings-card earnings-card-empty">
        <div className="earnings-empty-head">
          <span className="earnings-empty-icon">
            <IconWallet />
          </span>
          <div>
            <h2 className="earnings-empty-title">Earnings for {monthLabel(earnings.monthKey)}</h2>
            <p className="earnings-empty-note">
              No pay is set up for you yet — ask the CEO to set your rate.
            </p>
          </div>
        </div>
        {deliveries > 0 && (
          <p className="earnings-empty-banner">
            Your {deliveries} {deliveries === 1 ? "delivery" : "deliveries"} this month are
            still counted, so nothing is lost once a rate is set.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="earnings-card earnings-card-money">
      <span aria-hidden className="earnings-glow" />

      <div className="earnings-head">
        <div>
          <p className="earnings-kicker">You earned · {monthLabel(earnings.monthKey)}</p>
          <p className="earnings-total tabular">{formatMoney(total)}</p>
        </div>
        <span className="earnings-badge">{STATUS_LABEL[status]}</span>
      </div>

      <p className="earnings-status-note">
        {status === "estimate"
          ? `${monthLabel(earnings.monthKey)} is still open, so this grows as you deliver. The CEO approves it once the month closes.`
          : status === "approved"
            ? "Approved by the CEO and locked. Payment is on its way."
            : `Paid${earnings.paidAt ? ` on ${formatDate(earnings.paidAt)}` : ""}.`}
      </p>

      <dl className="earnings-breakdown">
        {salaried && (
          <div className="earnings-line">
            <dt>Salary</dt>
            <dd className="tabular">{formatMoney(earnings.base)}</dd>
          </div>
        )}
        {perTask && (
          <div className="earnings-line">
            <dt>
              {deliveries} {deliveries === 1 ? "delivery" : "deliveries"} × {formatMoney(rate)}
            </dt>
            <dd className="tabular">{formatMoney(earnings.taskPay)}</dd>
          </div>
        )}
        {earnings.adjustment !== 0 && (
          <div className="earnings-line">
            <dt>
              {earnings.adjustment > 0 ? "Bonus" : "Deduction"}
              {earnings.note ? ` · ${earnings.note}` : ""}
            </dt>
            <dd className="tabular">
              {earnings.adjustment > 0 ? "+" : "−"}
              {formatMoney(Math.abs(earnings.adjustment))}
            </dd>
          </div>
        )}
        <div className={cn("earnings-line", "earnings-line-total")}>
          <dt>Total</dt>
          <dd className="tabular">{formatMoney(total)}</dd>
        </div>
      </dl>

      {/* What the deliveries were. Someone who writes and edits is paid the
          same rate for both, so the split is the only way to see the mix. */}
      {perTask && breakdown.length > 0 && (
        <div className="earnings-counted">
          <p className="earnings-counted-label">Counted from</p>
          <ul className="earnings-chips">
            {breakdown.map((b) => (
              <li key={b.step} className="earnings-chip">
                {b.step}
                <span className="tabular earnings-chip-count">{b.done}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="earnings-footnote">
        {payTypeLabel(payType)}
        {perTask && ` · ${formatMoney(rate)} per delivery`}
      </p>
    </section>
  );
}
