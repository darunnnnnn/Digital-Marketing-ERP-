import { Link } from "react-router";
import { IconAlert, IconCheckCircle, IconClock, IconUsers } from "@/components/icons";
import { InviteButton } from "./InviteButton";
import { ActiveToggle, ExtraRoles, InviteLinkButton, RoleSelect } from "./MemberActions";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useViewer } from "@/lib/auth";
import { ROLE_STEPS, loadPerfSource, measureMember } from "@/lib/performance";
import { listMembers } from "@/lib/queries";
import { memberRoles } from "@/lib/roles";
import { useAsync } from "@/lib/use-async";
import { cn, currentMonthKey, initials, monthLabel } from "@/lib/utils";
import type { Member } from "@/lib/types";
import "./TeamPage.css";
import "../clients/ClientsPage.css";

/**
 * Sign-in now belongs to Supabase Auth, so the app can't see whether someone has
 * a password. "Invite pending" therefore means they have never signed in — which
 * is the thing the CEO actually wants to know.
 */
function statusOf(m: Member) {
  if (!m.active) return "inactive";
  return m.lastLoginAt ? "active" : "pending";
}

export function TeamPage() {
  const viewer = useViewer();
  const monthKey = currentMonthKey();

  const { data, loading, error, reload } = useAsync(async () => {
    // One fetch of the month's videos measures everyone, however big the team.
    const [members, source] = await Promise.all([
      listMembers(viewer.agencyId),
      loadPerfSource(viewer.agencyId, monthKey),
    ]);

    return {
      members,
      perf: new Map(members.map((m) => [m.id, measureMember(m, monthKey, source).summary])),
    };
  }, [viewer.agencyId, monthKey]);

  if (loading && !data) return <PageSkeleton />;
  if (error) return <EmptyState title="Couldn't load the team" description={error} />;

  const members = data?.members ?? [];
  const perf = data?.perf ?? new Map();
  const count = (s: string) => members.filter((m) => statusOf(m) === s).length;

  return (
    <div className="stack-8">
      <div className="page-head">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">
            Everyone&apos;s delivery for {monthLabel(monthKey)}. Click a name for their full
            profile.
          </p>
        </div>
        <InviteButton onInvited={reload} />
      </div>

      <div className="stat-grid">
        <Stat icon={IconUsers} label="Team members" value={members.length} />
        <Stat icon={IconCheckCircle} label="Active" value={count("active")} tone="accent" />
        <Stat icon={IconClock} label="Invite pending" value={count("pending")} />
        <Stat icon={IconAlert} label="Deactivated" value={count("inactive")} />
      </div>

      <div className="card team-scroll">
        <table className="team-table">
          <thead>
            <tr>
              <th className="cell-wide">Name</th>
              <th className="cell-wide">Role</th>
              <th>Delivered</th>
              <th>On time</th>
              <th>Overdue now</th>
              <th>Status</th>
              <th className="cell-wide team-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const s = statusOf(m);
              const self = m.id === viewer.id;
              const p = perf.get(m.id)!;
              const owns = memberRoles(m).some((r) => (ROLE_STEPS[r] ?? []).length > 0);

              return (
                <tr key={m.id} className={cn(!m.active && "team-row-off")}>
                  <td className="cell-wide">
                    <Link to={`/team/${m.id}`} className="who">
                      <span className="who-avatar">{initials(m.name)}</span>
                      <div className="who-text">
                        <p className="who-name truncate">
                          {m.name}
                          {self && <span className="who-self">(you)</span>}
                        </p>
                        <p className="who-email truncate">{m.email ?? "No email"}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="cell-wide">
                    <RoleSelect
                      id={m.id}
                      role={m.role}
                      roles={m.roles}
                      locked={self || !m.active}
                      onChanged={reload}
                    />
                    <ExtraRoles
                      id={m.id}
                      name={m.name}
                      role={m.role}
                      roles={m.roles}
                      locked={self || !m.active}
                      onChanged={reload}
                    />
                  </td>

                  {!owns ? (
                    <td colSpan={3} className="team-note">
                      Coordinates the whole board
                    </td>
                  ) : (
                    <>
                      <td>
                        <span className="team-count tabular">{p.done}</span>
                        {p.late > 0 && <span className="team-late">{p.late} late</span>}
                      </td>
                      <td className="team-rate tabular">
                        {p.onTimeRate === null ? "—" : `${p.onTimeRate}%`}
                        {p.late > 0 && <span className="team-lag">avg {p.avgLag}d late</span>}
                      </td>
                      <td>
                        {p.overdueNow > 0 ? (
                          <span className="team-overdue">{p.overdueNow} overdue</span>
                        ) : (
                          <span className="team-none">None</span>
                        )}
                      </td>
                    </>
                  )}

                  <td>
                    <span className={cn("team-status", `team-status-${s}`)}>
                      {s === "active" ? "Active" : s === "pending" ? "Invite pending" : "Deactivated"}
                    </span>
                  </td>
                  <td className="cell-wide">
                    {!self && (
                      <div className="team-actions">
                        {m.active && m.email && (
                          <InviteLinkButton id={m.id} name={m.name} pending={s === "pending"} />
                        )}
                        <ActiveToggle id={m.id} active={m.active} onChanged={reload} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
