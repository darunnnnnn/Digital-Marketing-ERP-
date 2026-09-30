import { Link, useParams, useSearchParams } from "react-router";
import {
  IconAlert,
  IconCheckCircle,
  IconChevronLeft,
  IconClock,
  IconPencil,
} from "@/components/icons";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/Progress";
import { Stat } from "@/components/ui/Stat";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useViewer } from "@/lib/auth";
import { computePay, payTypeLabel } from "@/lib/pay-rules";
import { ROLE_STEPS, memberPerformance, shiftMonth, type WorkRow } from "@/lib/performance";
import { getMember } from "@/lib/queries";
import { ROLE_LABELS, refLabel, type Role } from "@/lib/pipeline";
import { supabase } from "@/lib/supabase";
import { useAsync } from "@/lib/use-async";
import {
  cn,
  currentMonthKey,
  dueLabel,
  formatCalendar,
  formatDate,
  formatMoney,
  initials,
  monthLabel,
  timeAgo,
  toDate,
} from "@/lib/utils";
import type { Payout } from "@/lib/types";
import "./TeamProfilePage.css";
import "./TeamPage.css";
import "../clients/ClientsPage.css";

function LatePill({ days, open = false }: { days: number; open?: boolean }) {
  if (days === 0) {
    return <span className="pill-ok">{open ? "On track" : "On time"}</span>;
  }
  return <span className="pill-late">{days}d late</span>;
}

function WorkLink({ row }: { row: WorkRow }) {
  return (
    <Link to={`/content/${row.id}`} className="work-link">
      <p className="work-link-title truncate">{row.title}</p>
      <p className="work-link-meta truncate">
        <span className="work-link-ref">{refLabel(row.ref)}</span> · {row.client}
      </p>
    </Link>
  );
}

export function TeamProfilePage() {
  const { id = "" } = useParams();
  const viewer = useViewer();
  const [params] = useSearchParams();

  const thisMonth = currentMonthKey();
  const asked = params.get("month") ?? "";
  const monthKey = /^\d{4}-\d{2}$/.test(asked) && asked <= thisMonth ? asked : thisMonth;
  const isCurrent = monthKey === thisMonth;

  const { data, loading } = useAsync(async () => {
    const member = await getMember(id);
    if (!member) return { member: null };

    const [perf, payout] = await Promise.all([
      memberPerformance(member, monthKey),
      // Payouts are the CEO's alone to read, so this comes back empty for
      // anyone else — the database decides, not this page.
      supabase
        .from("Payout")
        .select("*")
        .eq("memberId", member.id)
        .eq("monthKey", monthKey)
        .maybeSingle<Payout>(),
    ]);

    return { member, perf, payout: payout.data };
  }, [id, monthKey, viewer.id]);

  if (loading && !data) return <PageSkeleton />;

  const member = data?.member;
  if (!member) {
    return (
      <EmptyState
        title="Person not found"
        description="They may have been removed, or they belong to another agency."
        action={
          <LinkButton to="/team" size="sm" variant="secondary">
            Back to the team
          </LinkButton>
        }
      />
    );
  }

  const perf = data!.perf!;
  const payout = data!.payout ?? null;

  const pay = payout
    ? { total: payout.amount, status: payout.status === "paid" ? "Paid" : "Approved" }
    : {
        total: computePay(member.payType, perf.summary.done, member.rate, member.salary).total,
        status: isCurrent ? "Running total" : "Not approved yet",
      };

  const s = perf.summary;
  const steps = ROLE_STEPS[member.role] ?? [];
  const roleLabel = ROLE_LABELS[member.role as Role] ?? member.role;
  const doneLabel = steps.length === 1 ? steps[0].label : steps.length ? "Approvals" : "Completed";
  const lastLogin = toDate(member.lastLoginAt);
  // Sign-in belongs to Supabase Auth now, so "never signed in" stands in for
  // "hasn't set a password yet".
  const status = !member.active ? "Deactivated" : lastLogin ? "Active" : "Invite pending";

  return (
    <div className="stack-8">
      <Link to="/team" className="back-link">
        <IconChevronLeft />
        Team
      </Link>

      {/* Header */}
      <div className="card profile-head">
        <span className="profile-avatar">{initials(member.name)}</span>
        <div className="profile-id">
          <div className="profile-title-row">
            <h1 className="profile-name">{member.name}</h1>
            <span
              className={cn(
                "profile-status",
                status === "Active" && "team-status-active",
                status === "Invite pending" && "team-status-pending",
                status === "Deactivated" && "team-status-inactive",
              )}
            >
              {status}
            </span>
          </div>
          <p className="profile-meta">
            {roleLabel} · {member.email ?? "No email"} · last sign-in{" "}
            {lastLogin ? timeAgo(lastLogin) : "never"}
          </p>
        </div>

        {/* Month switcher */}
        <div className="months">
          <Link
            to={`/team/${member.id}?month=${shiftMonth(monthKey, -1)}`}
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
              to={`/team/${member.id}?month=${shiftMonth(monthKey, 1)}`}
              aria-label="Next month"
              className="months-arrow"
            >
              <IconChevronLeft className="flip" />
            </Link>
          )}
        </div>
      </div>

      {steps.length === 0 ? (
        <div className="card profile-nostep">
          <p className="profile-nostep-title">No personal pipeline step</p>
          <p className="profile-nostep-note">
            A {roleLabel.toLowerCase()} plans and coordinates rather than owning one step, so
            there&apos;s no per-person delivery count. Their work shows across the whole content
            board.
          </p>
        </div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="stat-grid stat-grid-5">
            <Stat
              icon={IconCheckCircle}
              label={doneLabel}
              value={s.done}
              tone="accent"
              hint={monthLabel(monthKey)}
            />
            <Stat
              icon={IconClock}
              label="On time"
              value={s.onTimeRate === null ? "—" : `${s.onTimeRate}%`}
              hint={s.done ? `${s.onTime} of ${s.done} on or before deadline` : "nothing finished"}
            />
            <Stat
              icon={IconAlert}
              label="Delivered late"
              value={s.late}
              tone={s.late ? "alert" : "slate"}
              hint={s.late ? `avg ${s.avgLag}d late · worst ${s.maxLag}d` : "no delays"}
            />
            <Stat
              icon={IconAlert}
              label="Overdue now"
              value={s.overdueNow}
              tone={s.overdueNow ? "alert" : "slate"}
              hint={`${s.inProgress} open · ${s.dueThisWeek} due this week`}
            />
            <Stat icon={IconPencil} label="Sent back" value={s.revisions} hint="revisions requested" />
          </div>

          <div className="profile-columns">
            {/* Completed this month */}
            <Card className="profile-wide">
              <CardHeader
                title={`Delivered in ${monthLabel(monthKey)}`}
                action={<span className="profile-note">{s.done} total</span>}
              />
              {perf.completed.length === 0 ? (
                <p className="profile-empty">Nothing delivered this month.</p>
              ) : (
                <div className="team-scroll">
                  <table className="team-table work-table">
                    <thead>
                      <tr>
                        <th className="cell-wide">Video</th>
                        {steps.length > 1 && <th>Step</th>}
                        <th>Due</th>
                        <th>Delivered</th>
                        <th className="cell-wide team-right">Timing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perf.completed.map((row) => (
                        <tr key={`${row.id}-${row.step}`}>
                          <td className="cell-wide work-cell">
                            <WorkLink row={row} />
                          </td>
                          {steps.length > 1 && <td className="work-plain">{row.step}</td>}
                          <td className="work-plain">{formatCalendar(row.due) ?? "—"}</td>
                          <td className="work-plain">{formatDate(row.doneAt)}</td>
                          <td className="cell-wide team-right">
                            <LatePill days={row.lateDays} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="stack-6">
              {/* Pay */}
              <Card>
                <CardHeader
                  title={`Pay for ${monthLabel(monthKey)}`}
                  action={
                    <Link to={`/payouts?month=${monthKey}`} className="profile-link">
                      Payouts
                    </Link>
                  }
                />
                <div className="pay">
                  <p className="pay-total tabular">{formatMoney(pay.total)}</p>
                  <p className="pay-status">
                    {pay.status} · {payTypeLabel(payout?.payType ?? member.payType)}
                    {(payout?.payType ?? member.payType) !== "salary" &&
                      ` · ${formatMoney(payout?.rate ?? member.rate)} per delivery`}
                  </p>
                </div>
              </Card>

              {/* On their desk now */}
              <Card>
                <CardHeader
                  title="On their desk now"
                  action={<span className="profile-note">{s.inProgress}</span>}
                />
                {perf.open.length === 0 ? (
                  <p className="profile-empty">Nothing waiting on them.</p>
                ) : (
                  <ul className="open-list">
                    {perf.open.slice(0, 8).map((row) => (
                      <li key={`${row.id}-${row.step}`} className="open-row">
                        <div className="open-row-main">
                          <WorkLink row={row} />
                        </div>
                        {row.lateDays > 0 ? (
                          <LatePill days={row.lateDays} open />
                        ) : (
                          <span className="open-row-due">{dueLabel(row.due) ?? "No date"}</span>
                        )}
                      </li>
                    ))}
                    {perf.open.length > 8 && (
                      <li className="open-more">+{perf.open.length - 8} more</li>
                    )}
                  </ul>
                )}
              </Card>

              {/* By client */}
              <Card>
                <CardHeader title="By client" />
                {perf.byClient.length === 0 ? (
                  <p className="profile-empty">No deliveries yet.</p>
                ) : (
                  <ul className="by-client">
                    {perf.byClient.map((c) => (
                      <li key={c.client}>
                        <div className="by-client-row">
                          <span className="by-client-name truncate">{c.client}</span>
                          <span className="by-client-count tabular">
                            {c.done}
                            {c.late > 0 && <span className="by-client-late"> · {c.late} late</span>}
                          </span>
                        </div>
                        <ProgressBar value={(c.done / s.done) * 100} className="by-client-bar" />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
