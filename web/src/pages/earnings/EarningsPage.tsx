import type { ReactNode } from "react";
import { EarningsCard } from "./EarningsCard";
import { IconCheckCircle, IconClock, IconEmpty, IconWallet } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useViewer } from "@/lib/auth";
import { memberEarnings, memberEarningsHistory } from "@/lib/payouts";
import { useAsync } from "@/lib/use-async";
import { currentMonthKey, formatDate, formatMoney, monthLabel } from "@/lib/utils";
import "./EarningsPage.css";

/**
 * What one person has earned — the page a creative role opens to check their
 * money, and the only place in the app that shows it to them.
 *
 * Two numbers, kept apart on purpose. The month still running is an estimate
 * that grows with every delivery; the months the CEO has closed are facts that
 * can never move again. Adding them into one "lifetime" figure would quietly
 * promise that the estimate is already banked, so the running month lives in
 * the card at the top and the settled totals in the row beneath it.
 */
export function EarningsPage() {
  const viewer = useViewer();
  const monthKey = currentMonthKey();

  const earnings = useAsync(() => memberEarnings(viewer, monthKey), [viewer.id, monthKey]);
  const history = useAsync(() => memberEarningsHistory(viewer.id), [viewer.id]);

  const loading = (earnings.loading && !earnings.data) || (history.loading && !history.data);
  if (loading) return <PageSkeleton />;

  const error = earnings.error || history.error;
  if (error) return <EmptyState title="Couldn't load your earnings" description={error} />;
  if (!earnings.data || !history.data) return <PageSkeleton />;

  const month = earnings.data;
  const { months, paid, awaiting, settled } = history.data;
  // The open month is only an addition when it has not been frozen yet; once it
  // is approved it is already one of the rows in `months`.
  const openMonth = month.status === "estimate" ? month.total : 0;

  return (
    <div className="earn-page">
      <div>
        <h1 className="page-title">Your earnings</h1>
        <p className="page-subtitle">
          What this month has earned you so far, and everything the CEO has closed before it.
        </p>
      </div>

      <EarningsCard earnings={month} />

      <div className="earn-stats">
        <Stat
          label="Paid to you"
          value={formatMoney(paid)}
          note="Disbursed to your account"
          tone="paid"
          icon={<IconCheckCircle />}
        />
        <Stat
          label="Approved, payment on the way"
          value={formatMoney(awaiting)}
          note="Scheduled for payout release"
          tone="waiting"
          icon={<IconClock />}
        />
        <Stat
          label="Earned in closed months"
          value={formatMoney(settled)}
          note="Locked once the CEO approves"
          tone="settled"
          icon={<IconWallet />}
        />
      </div>

      <section className="card earn-history">
        <div>
          <h2 className="earn-history-title">Month by month</h2>
          <p className="earn-history-note">Closed months only — these numbers never change.</p>
        </div>

        {months.length === 0 ? (
          <div className="earn-history-empty">
            <span className="earn-history-empty-icon">
              <IconEmpty />
            </span>
            <p>Nothing closed yet. Your first month appears here once the CEO approves it.</p>
          </div>
        ) : (
          <ul className="earn-history-list">
            {months.map((m) => (
              <li key={m.monthKey} className="earn-row">
                <span
                  aria-hidden
                  className={m.status === "paid" ? "earn-mark earn-mark-paid" : "earn-mark"}
                />
                <div className="earn-row-main">
                  <p className="earn-row-month">{monthLabel(m.monthKey)}</p>
                  <p className="earn-row-meta">
                    {m.deliveries} {m.deliveries === 1 ? "delivery" : "deliveries"}
                  </p>
                </div>
                <span
                  className={
                    m.status === "paid" ? "earn-tag earn-tag-paid" : "earn-tag earn-tag-waiting"
                  }
                >
                  {m.status === "paid"
                    ? m.paidAt
                      ? `Paid ${formatDate(m.paidAt)}`
                      : "Paid"
                    : "Awaiting payment"}
                </span>
                <p className="earn-row-amount tabular">{formatMoney(m.total)}</p>
              </li>
            ))}
          </ul>
        )}

        {openMonth > 0 && (
          <p className="earn-history-open">
            {monthLabel(monthKey)} is still open, so its {formatMoney(openMonth)} is not counted
            here yet. With it, you are on <strong>{formatMoney(settled + openMonth)}</strong>.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  tone: "paid" | "waiting" | "settled";
  icon: ReactNode;
}) {
  return (
    <div className="card earn-stat">
      <div className="earn-stat-top">
        <p className="earn-stat-label">{label}</p>
        <span className={`earn-stat-icon is-${tone}`}>{icon}</span>
      </div>
      <p className="earn-stat-value tabular">{value}</p>
      <p className="earn-stat-note">
        <span aria-hidden className={`earn-stat-dot is-${tone}`} />
        {note}
      </p>
    </div>
  );
}
