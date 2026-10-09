import { Link } from "react-router";
import {
  IconAlert,
  IconCheckCircle,
  IconClock,
  IconFilm,
  IconWallet,
} from "@/components/icons";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/Progress";
import { Stat } from "@/components/ui/Stat";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useViewer } from "@/lib/auth";
import { listApprovals, type Approval } from "@/lib/approvals";
import { isCeo } from "@/lib/permissions";
import { monthPayouts } from "@/lib/payouts";
import { isOverdue, refLabel, stageConfig } from "@/lib/pipeline";
import { listClients, listContent, listMembers } from "@/lib/queries";
import { deadlineFor } from "@/lib/schedule";
import { progressPercent, statsForClients } from "@/lib/stats";
import type { ContentItemWithNames } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { cn, currentMonthKey, dueLabel, formatMoney, monthLabel, toDate } from "@/lib/utils";
import "./DashboardPage.css";
import "../clients/ClientsPage.css";
import "../clients/ClientDetailPage.css";

/** Whoever the current stage is waiting on. */
function holder(item: ContentItemWithNames) {
  switch (stageConfig(item.stage).assign) {
    case "scriptwriterId":
      return item.scriptwriter?.name ?? null;
    case "cameramanId":
      return item.cameraman?.name ?? null;
    case "editorId":
      return item.editor?.name ?? null;
    case "publisherId":
      return item.publisher?.name ?? null;
    default:
      return null;
  }
}

export function DashboardPage() {
  const viewer = useViewer();
  const ceo = isCeo(viewer);
  const monthKey = currentMonthKey();

  const { data, loading, error } = useAsync(async () => {
    const [clients, team, items] = await Promise.all([
      listClients(viewer.agencyId),
      listMembers(viewer.agencyId, true),
      listContent(viewer, {}, monthKey),
    ]);

    const active = clients.filter((c) => c.status === "active");
    const [stats, approvals, payouts] = await Promise.all([
      statsForClients(
        active.map((c) => c.id),
        monthKey,
      ),
      // The three gates are the CEO's alone, and so is money.
      ceo ? listApprovals(viewer.agencyId, team) : Promise.resolve([] as Approval[]),
      ceo ? monthPayouts(viewer.agencyId, monthKey) : Promise.resolve([]),
    ]);

    return { clients: active, items, stats, approvals, payouts };
  }, [viewer.agencyId, viewer.id, ceo, monthKey]);

  if (loading && !data) return <PageSkeleton />;
  if (error) return <EmptyState title="Couldn't load the dashboard" description={error} />;

  const { clients = [], items = [], stats = {}, approvals = [], payouts = [] } = data ?? {};

  const overdue = items
    .filter((i) => {
      const field = deadlineFor(i);
      return isOverdue(field ? toDate(i[field] as string | null) : null, i.stage);
    })
    .sort((a, b) => {
      const fa = deadlineFor(a);
      const fb = deadlineFor(b);
      const da = fa ? (toDate(a[fa] as string | null)?.getTime() ?? 0) : 0;
      const db = fb ? (toDate(b[fb] as string | null)?.getTime() ?? 0) : 0;
      return da - db; // longest overdue first
    });

  const inFlight = items.filter((i) => i.stage !== "published").length;
  const posted = items.filter((i) => i.stage === "published").length;
  const promised = clients.reduce((sum, c) => sum + c.monthlyTarget, 0);
  const payable = payouts.filter((p) => p.onPayroll).reduce((sum, p) => sum + p.total, 0);

  // Furthest behind first — the ones worth looking at.
  const byProgress = [...clients].sort(
    (a, b) =>
      progressPercent(stats[a.id]?.published ?? 0, a.monthlyTarget) -
      progressPercent(stats[b.id]?.published ?? 0, b.monthlyTarget),
  );

  return (
    <div className="stack-8">
      <div className="page-head">
        <div>
          <h1 className="page-title">Hello, {viewer.name.split(" ")[0]}</h1>
          <p className="page-subtitle">
            {monthLabel(monthKey)} — how the agency is doing, and what needs you.
          </p>
        </div>
        <LinkButton to="/content">
          <IconFilm />
          Open the pipeline
        </LinkButton>
      </div>

      <div className="stat-grid">
        <Stat
          icon={IconClock}
          label={ceo ? "Waiting on you" : "Awaiting CEO approval"}
          value={approvals.length}
          tone={approvals.length ? "accent" : "slate"}
          hint={approvals.length ? "scripts, footage and final cuts" : "nothing to approve"}
        />
        <Stat
          icon={IconAlert}
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? "alert" : "slate"}
          hint={overdue.length ? "behind on their current step" : "every step on time"}
        />
        <Stat icon={IconFilm} label="In the pipeline" value={inFlight} hint="not posted yet" />
        <Stat
          icon={IconCheckCircle}
          label="Posted"
          value={posted}
          hint={promised ? `of ${promised} promised this month` : "this month"}
        />
      </div>

      <div className="dash-columns">
        <div className="dash-main stack-6">
          {/* The one thing a CEO opens this page for. */}
          {ceo && approvals.length > 0 && (
            <Card>
              <CardHeader
                title="Waiting on you"
                action={
                  <Link to="/approvals" className="detail-link">
                    Review all {approvals.length}
                  </Link>
                }
              />
              <ul className="row-list">
                {approvals.slice(0, 5).map((a) => (
                  <li key={a.item.id}>
                    <Link to={`/approvals?open=${a.item.id}`} className="row">
                      <span className={cn("dash-gate", a.late && "dash-gate-late")}>
                        {stageConfig(a.item.stage).short}
                      </span>
                      <span className="row-title truncate">{a.item.title}</span>
                      <span className="dash-meta truncate">
                        {a.sender ? a.sender.name : "—"}
                        {a.waiting !== null && ` · ${a.waiting}d waiting`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Overdue"
              action={
                overdue.length > 0 ? (
                  <Link to="/content?overdue=1" className="detail-link">
                    See all {overdue.length}
                  </Link>
                ) : undefined
              }
            />
            {overdue.length === 0 ? (
              <p className="detail-empty-row">Nothing is late. Every step is on time.</p>
            ) : (
              <ul className="row-list">
                {overdue.slice(0, 6).map((item) => {
                  const field = deadlineFor(item);
                  const due = field ? toDate(item[field] as string | null) : null;
                  const who = holder(item);
                  return (
                    <li key={item.id}>
                      <Link to={`/content/${item.id}`} className="row">
                        <span className="row-ref">{refLabel(item.ref)}</span>
                        <span className="row-title truncate">{item.title}</span>
                        <span className="dash-meta truncate">
                          {item.client?.name ?? "—"}
                          {who && ` · ${who}`}
                        </span>
                        <span className="dash-late">{dueLabel(due)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="stack-6">
          {ceo && (
            <Card>
              <CardHeader
                title={`Pay for ${monthLabel(monthKey)}`}
                action={
                  <Link to="/payouts" className="detail-link">
                    Payouts
                  </Link>
                }
              />
              <div className="dash-money">
                <span className="dash-money-icon">
                  <IconWallet />
                </span>
                <div>
                  <p className="dash-money-value tabular">{formatMoney(payable)}</p>
                  <p className="dash-money-note">
                    running total, grows as work is delivered
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Clients this month"
              action={
                <Link to="/clients" className="detail-link">
                  All clients
                </Link>
              }
            />
            {byProgress.length === 0 ? (
              <p className="detail-empty-row">No active clients yet.</p>
            ) : (
              <ul className="dash-clients">
                {byProgress.map((c) => {
                  const published = stats[c.id]?.published ?? 0;
                  const pct = progressPercent(published, c.monthlyTarget);
                  return (
                    <li key={c.id}>
                      <Link to={`/clients/${c.id}`} className="dash-client">
                        <span className="dash-client-row">
                          <span className="dash-client-name truncate">{c.name}</span>
                          <span className="dash-client-count tabular">
                            {published}
                            <span className="muted"> / {c.monthlyTarget}</span>
                          </span>
                        </span>
                        <ProgressBar value={pct} className="dash-client-bar" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
