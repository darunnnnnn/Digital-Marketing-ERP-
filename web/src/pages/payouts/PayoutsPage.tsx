import { Link, useSearchParams } from "react-router";
import {
  IconAlert,
  IconCheckCircle,
  IconChevronLeft,
  IconClock,
  IconWallet,
} from "@/components/icons";
import { ApproveButton, PaySettingsButton } from "./PayoutDialogs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stat } from "@/components/ui/Stat";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useToast } from "@/components/ui/Toast";
import { useViewer } from "@/lib/auth";
import { payTypeLabel, toCsv } from "@/lib/pay-rules";
import { approvePayout, markPaid, monthPayouts, reopenPayout } from "@/lib/payouts";
import { shiftMonth } from "@/lib/performance";
import { ROLE_LABELS, type Role } from "@/lib/pipeline";
import { useAsync } from "@/lib/use-async";
import { cn, currentMonthKey, formatDate, formatMoney, initials, monthLabel } from "@/lib/utils";
import "./PayoutsPage.css";
import "../team/TeamPage.css";
import "../team/MemberActions.css";
import "../clients/ClientsPage.css";

export function PayoutsPage() {
  const viewer = useViewer();
  const [params] = useSearchParams();
  const toast = useToast();

  const thisMonth = currentMonthKey();
  const asked = params.get("month") ?? "";
  const monthKey = /^\d{4}-\d{2}$/.test(asked) && asked <= thisMonth ? asked : thisMonth;
  const isCurrent = monthKey === thisMonth;

  const { data, loading, error, reload } = useAsync(
    () => monthPayouts(viewer.agencyId, monthKey),
    [viewer.agencyId, monthKey],
  );

  if (loading && !data) return <PageSkeleton />;
  if (error) return <EmptyState title="Couldn't load payouts" description={error} />;

  const all = data ?? [];
  const rows = all.filter((r) => r.onPayroll);
  const unpaid = all.filter((r) => !r.onPayroll);

  const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred).reduce((acc, r) => acc + r.total, 0);
  const total = sum(() => true);
  const paid = sum((r) => r.status === "paid");
  const approved = sum((r) => r.status === "approved");
  const estimates = rows.filter((r) => r.status === "estimate");

  async function run(work: () => Promise<unknown>, failure: string) {
    try {
      await work();
      await reload();
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : failure);
    }
  }

  /**
   * The CSV is built here and handed to the browser as a download. The old build
   * had a server route for this; with no server, a blob does the same job and the
   * numbers never leave the person's machine on the way out.
   */
  function exportCsv() {
    const csv = toCsv([
      [
        "Name",
        "Role",
        "Pay type",
        "Deliveries",
        "Rate per task",
        "Task pay",
        "Salary",
        "Adjustment",
        "Adjustment note",
        "Total",
        "Status",
        "Paid on",
      ],
      ...rows.map((r) => [
        r.name,
        ROLE_LABELS[r.role as Role] ?? r.role,
        payTypeLabel(r.payType),
        r.deliveries,
        r.rate,
        r.taskPay,
        r.base,
        r.adjustment,
        r.note ?? "",
        r.total,
        r.status,
        r.paidAt ? r.paidAt.toISOString().slice(0, 10) : "",
      ]),
    ]);

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function approveAll() {
    for (const r of estimates) {
      await approvePayout({
        agencyId: viewer.agencyId,
        memberId: r.memberId,
        monthKey,
        approvedBy: viewer.name,
      });
    }
    await reload();
    toast.say(`Approved ${estimates.length}.`);
  }

  return (
    <div className="stack-8">
      <div className="pay-head">
        <div>
          <h1 className="page-title">Payouts</h1>
          <p className="page-subtitle">
            What each person has earned, worked out from what they actually delivered.
          </p>
        </div>

        <div className="pay-head-actions">
          {/* Month switcher */}
          <div className="months months-light">
            <Link
              to={`/payouts?month=${shiftMonth(monthKey, -1)}`}
              aria-label="Previous month"
              className="months-arrow"
            >
              <IconChevronLeft />
            </Link>
            <span className="months-label">{monthLabel(monthKey)}</span>
            {isCurrent ? (
              <span className="months-arrow months-arrow-off" aria-hidden>
                <IconChevronLeft className="flip" />
              </span>
            ) : (
              <Link
                to={`/payouts?month=${shiftMonth(monthKey, 1)}`}
                aria-label="Next month"
                className="months-arrow"
              >
                <IconChevronLeft className="flip" />
              </Link>
            )}
          </div>

          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          {estimates.length > 0 && (
            <Button onClick={() => void approveAll()}>Approve all {estimates.length}</Button>
          )}
        </div>
      </div>

      {isCurrent && (
        <div className="pay-notice">
          <IconClock />
          <p>
            {monthLabel(monthKey)} is still in progress, so these are running totals that grow as
            work is delivered. Approve them once the month has closed.
          </p>
        </div>
      )}

      <div className="stat-grid">
        <Stat icon={IconWallet} label="Total payable" value={formatMoney(total)} tone="accent" />
        <Stat
          icon={IconClock}
          label="Not yet approved"
          value={formatMoney(total - approved - paid)}
          hint={`${estimates.length} ${estimates.length === 1 ? "person" : "people"}`}
        />
        <Stat icon={IconAlert} label="Approved, unpaid" value={formatMoney(approved)} />
        <Stat icon={IconCheckCircle} label="Paid" value={formatMoney(paid)} />
      </div>

      <div className="card team-scroll">
        <table className="team-table pay-table">
          <thead>
            <tr>
              <th className="cell-wide">Name</th>
              <th>Pay type</th>
              <th className="team-right">Deliveries</th>
              <th className="team-right">Task pay</th>
              <th className="team-right">Salary</th>
              <th className="team-right">Adjust</th>
              <th className="team-right">Total</th>
              <th>Status</th>
              <th className="cell-wide team-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.memberId} className={cn(!r.active && "team-row-off")}>
                <td className="cell-wide">
                  <Link to={`/team/${r.memberId}?month=${monthKey}`} className="who">
                    <span className="who-avatar">{initials(r.name)}</span>
                    <div className="who-text">
                      <p className="who-name truncate">{r.name}</p>
                      <p className="who-email truncate">
                        {ROLE_LABELS[r.role as Role] ?? r.role}
                        {!r.active && " · deactivated"}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="pay-cell">
                  {payTypeLabel(r.payType)}
                  {r.payType !== "salary" && (
                    <span className="pay-sub">{formatMoney(r.rate)} each</span>
                  )}
                </td>
                <td className="pay-cell team-right tabular">
                  {r.payType === "salary" ? "—" : r.deliveries}
                </td>
                <td className="pay-cell team-right tabular">
                  {r.payType === "salary" ? "—" : formatMoney(r.taskPay)}
                </td>
                <td className="pay-cell team-right tabular">
                  {r.payType === "per_task" ? "—" : formatMoney(r.base)}
                </td>
                <td className="pay-cell team-right tabular">
                  {r.adjustment === 0 ? (
                    <span className="pay-none">—</span>
                  ) : (
                    <span
                      title={r.note ?? undefined}
                      className={r.adjustment > 0 ? "breakdown-up" : "breakdown-down"}
                    >
                      {r.adjustment > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(r.adjustment))}
                    </span>
                  )}
                </td>
                <td className="pay-total-cell team-right tabular">{formatMoney(r.total)}</td>
                <td>
                  <span
                    className={cn(
                      "team-status",
                      r.status === "estimate" && "team-status-pending",
                      r.status === "approved" && "team-status-active",
                      r.status === "paid" && "team-status-paid",
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
                <td className="cell-wide">
                  <div className="team-actions">
                    {r.status === "estimate" && (
                      <>
                        <PaySettingsButton
                          memberId={r.memberId}
                          name={r.name}
                          payType={r.payType}
                          rate={r.rate}
                          salary={r.salary}
                          onSaved={reload}
                        />
                        <ApproveButton row={r} month={monthKey} onApproved={reload} />
                      </>
                    )}
                    {r.status === "approved" && (
                      <>
                        <button
                          type="button"
                          className="row-action row-action-quiet"
                          onClick={() =>
                            void run(
                              () => reopenPayout(viewer.agencyId, r.memberId, monthKey),
                              "Couldn't reopen that.",
                            )
                          }
                        >
                          Reopen
                        </button>
                        <Button
                          size="sm"
                          onClick={() =>
                            void run(
                              () => markPaid(viewer.agencyId, r.memberId, monthKey),
                              "Couldn't mark that paid.",
                            )
                          }
                        >
                          Mark paid
                        </Button>
                      </>
                    )}
                    {r.status === "paid" && (
                      <span className="pay-locked">
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
            <tr>
              <td colSpan={6} className="cell-wide pay-foot">
                {rows.length} people · {monthLabel(monthKey)}
              </td>
              <td className="pay-foot-total team-right tabular">{formatMoney(total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {unpaid.length > 0 && (
        <div className="offpayroll">
          <span>Not on payroll:</span>
          {unpaid.map((r) => (
            <span key={r.memberId} className="offpayroll-person">
              <span className="offpayroll-name">{r.name}</span>
              <PaySettingsButton
                memberId={r.memberId}
                name={r.name}
                payType={r.payType}
                rate={r.rate}
                salary={r.salary}
                onSaved={reload}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
