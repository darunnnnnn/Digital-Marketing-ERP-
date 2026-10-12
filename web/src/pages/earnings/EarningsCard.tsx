import type { ComponentType, SVGProps } from "react";
import {
  IconAlert,
  IconCamera,
  IconCheckCircle,
  IconFilm,
  IconMic,
  IconPencil,
  IconSend,
} from "@/components/icons";
import { payTypeLabel } from "@/lib/pay-rules";
import type { MemberEarnings } from "@/lib/payouts";
import { formatDate, formatMoney, monthLabel } from "@/lib/utils";
import "./EarningsCard.css";

const STATUS_LABEL: Record<MemberEarnings["status"], string> = {
  estimate: "Active period",
  approved: "Approved",
  paid: "Paid",
};

/**
 * The step labels come from ROLE_STEPS, so they are a closed set — an icon and
 * a line of plain English for each, and a neutral fallback if one is ever
 * renamed. Saying what a step actually was beats repeating its name twice.
 */
const STEP_LOOK: Record<string, { icon: ComponentType<SVGProps<SVGSVGElement>>; what: string }> =
  {
    "Scripts written": { icon: IconPencil, what: "Submitted and tracked for review" },
    "Shoots delivered": { icon: IconCamera, what: "Filmed and handed to the edit" },
    "Voice overs delivered": { icon: IconMic, what: "Voice tracks recorded" },
    "Edits delivered": { icon: IconFilm, what: "Video cuts and post-production" },
    "Videos posted": { icon: IconSend, what: "Published to the client's channel" },
  };

/**
 * This month's pay — the thing people open the app to check, so the figure
 * leads the page and everything else on the card explains it.
 *
 * Someone with no rate set still gets the full card: the amount reads zero,
 * but the deliveries underneath are real and the notice says plainly that they
 * are being kept. A page that collapses into an apology for those people hides
 * the one fact they came to confirm.
 */
export function EarningsCard({ earnings }: { earnings: MemberEarnings }) {
  const { status, payType, total, deliveries, rate, breakdown, onPayroll } = earnings;
  const perTask = payType === "per_task" || payType === "hybrid";
  const salaried = payType === "salary" || payType === "hybrid";
  const month = monthLabel(earnings.monthKey);

  return (
    <section className="card earn-hero">
      <div className="earn-hero-top">
        <div className="earn-hero-figure">
          <p className="earn-hero-kicker">
            <span aria-hidden className={onPayroll ? "earn-hero-dot" : "earn-hero-dot is-idle"} />
            {month}
            <span className={onPayroll ? "earn-hero-pill" : "earn-hero-pill is-idle"}>
              {onPayroll ? STATUS_LABEL[status] : "No rate set"}
            </span>
          </p>

          <p className="earn-hero-amount tabular">{formatMoney(total)}</p>

          <p className="earn-hero-caption">
            {!onPayroll
              ? "Nothing to pay out until the CEO sets your rate."
              : status === "estimate"
                ? `Grows as you deliver — the CEO locks it when ${month} closes.`
                : status === "approved"
                  ? "Locked by the CEO. Payment is on its way."
                  : `Paid${earnings.paidAt ? ` on ${formatDate(earnings.paidAt)}` : ""}.`}
          </p>
        </div>

        {onPayroll ? (
          <dl className="earn-hero-lines">
            {salaried && (
              <div className="earn-hero-line">
                <dt>Salary</dt>
                <dd className="tabular">{formatMoney(earnings.base)}</dd>
              </div>
            )}
            {perTask && (
              <div className="earn-hero-line">
                <dt>
                  {deliveries} × {formatMoney(rate)}
                </dt>
                <dd className="tabular">{formatMoney(earnings.taskPay)}</dd>
              </div>
            )}
            {earnings.adjustment !== 0 && (
              <div className="earn-hero-line">
                <dt>{earnings.adjustment > 0 ? "Bonus" : "Deduction"}</dt>
                <dd className="tabular">
                  {earnings.adjustment > 0 ? "+" : "−"}
                  {formatMoney(Math.abs(earnings.adjustment))}
                </dd>
              </div>
            )}
            <div className="earn-hero-line earn-hero-line-foot">
              <dt>{payTypeLabel(payType)}</dt>
              <dd>{perTask ? `${formatMoney(rate)} each` : "Monthly"}</dd>
            </div>
          </dl>
        ) : (
          <p className="earn-hero-notice">
            <IconAlert />
            <span>
              <strong>Rate not set:</strong> ask the CEO to set yours — every delivery below is
              still counted, so nothing is lost.
            </span>
          </p>
        )}
      </div>

      {/* The mix matters: someone who writes and edits is paid the same for
          both, so this split is the only place it shows. */}
      <div className="earn-hero-body">
        <p className="earn-hero-label">What you delivered this month</p>

        {breakdown.length === 0 ? (
          <p className="earn-hero-none">Nothing delivered yet this month.</p>
        ) : (
          <ul className="earn-steps">
            {breakdown.map((b) => {
              const look = STEP_LOOK[b.step];
              const Icon = look?.icon ?? IconCheckCircle;
              return (
                <li key={b.step} className="earn-step">
                  <span className="earn-step-icon">
                    <Icon />
                  </span>
                  <div className="earn-step-main">
                    <p className="earn-step-name">{b.step}</p>
                    {look && <p className="earn-step-what">{look.what}</p>}
                  </div>
                  <span className="earn-step-count">
                    <strong className="tabular">{b.done}</strong> delivered
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
