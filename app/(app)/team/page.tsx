import { IconAlert, IconCheckCircle, IconClock, IconUsers } from "@/components/icons";
import { InviteButton } from "@/components/team/invite-button";
import { ActiveToggle, LinkButton, RoleSelect } from "@/components/team/member-actions";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTeam } from "@/lib/permissions";
import Link from "next/link";
import { extraRoles, memberPerformance, rolesByMember, stepsForRoles } from "@/lib/performance";
import { ROLE_LABELS, type Role } from "@/lib/pipeline";
import { cn, currentMonthKey, initials, monthLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Roles somebody works beyond the one in their job title, which they earn by
 * being assigned the step rather than by anyone editing a list.
 */
function AlsoDoing({ roles, declared }: { roles: string[]; declared: string }) {
  const extra = extraRoles(roles, declared);
  if (extra.length === 0) return null;

  return (
    <p className="mt-0.5 truncate text-[11px] text-brand-700">
      also {extra.map((r) => (ROLE_LABELS[r as Role] ?? r).toLowerCase()).join(", ")}
    </p>
  );
}

export default async function TeamPage() {
  const user = await requireRole(canManageTeam);

  const members = await db.member.findMany({
    where: { agencyId: user.agencyId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const status = (m: (typeof members)[number]) =>
    !m.active ? "inactive" : m.passwordHash ? "active" : "pending";

  const count = (s: string) => members.filter((m) => status(m) === s).length;

  const monthKey = currentMonthKey();
  // One roles query for the whole team, then one performance pass per person —
  // somebody's deliveries include every step they hold, not just their title's.
  const roles = await rolesByMember(user.agencyId, members);
  const perf = new Map(
    await Promise.all(
      members.map(
        async (m) =>
          [
            m.id,
            (await memberPerformance(m, monthKey, new Date(), roles.get(m.id))).summary,
          ] as const,
      ),
    ),
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl lg:text-4xl">
            Team
          </h1>
          <p className="mt-1.5 text-sm text-stone-500 sm:mt-2 sm:text-base">
            Everyone&apos;s delivery for {monthLabel(monthKey)}. Click a name for their full
            profile.
          </p>
        </div>
        <InviteButton />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={IconUsers} label="Team members" value={members.length} />
        <Stat icon={IconCheckCircle} label="Active" value={count("active")} tone="accent" />
        <Stat icon={IconClock} label="Invite pending" value={count("pending")} />
        <Stat icon={IconAlert} label="Deactivated" value={count("inactive")} />
      </div>

      {/* Phones: one card per person. The desktop table is 7 columns wide and
          turns into a sideways-scrolling strip on a small screen, where the
          name is all you can see without dragging. */}
      <ul className="space-y-3 lg:hidden">
        {members.map((m) => {
          const s = status(m);
          const self = m.id === user.id;
          const p = perf.get(m.id)!;
          const owns = stepsForRoles(roles.get(m.id) ?? [m.role]).length > 0;

          return (
            <li key={m.id} className={cn("surface p-4", !m.active && "opacity-60")}>
              <div className="flex items-start gap-3">
                <Link
                  href={`/team/${m.id}`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-medium text-brand-800"
                >
                  {initials(m.name)}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/team/${m.id}`} className="block">
                    <p className="truncate font-medium text-stone-900">
                      {m.name}
                      {self && <span className="ml-2 text-xs text-stone-400">(you)</span>}
                    </p>
                    <p className="truncate text-sm text-stone-500">{m.email ?? "No email"}</p>
                    <AlsoDoing roles={roles.get(m.id) ?? []} declared={m.role} />
                  </Link>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
                    s === "active" && "bg-brand-50 text-brand-700",
                    s === "pending" && "bg-stone-100 text-stone-600",
                    s === "inactive" && "bg-red-50 text-red-600",
                  )}
                >
                  {s === "active" ? "Active" : s === "pending" ? "Pending" : "Off"}
                </span>
              </div>

              {owns ? (
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-stone-200/70 pt-3">
                  <div>
                    <dt className="text-[11px] text-stone-400">Delivered</dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums text-stone-900">
                      {p.done}
                      {p.late > 0 && (
                        <span className="ml-1 text-[11px] font-normal text-red-600">
                          {p.late} late
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-stone-400">On time</dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums text-stone-900">
                      {p.onTimeRate === null ? "—" : `${p.onTimeRate}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-stone-400">Overdue</dt>
                    <dd
                      className={cn(
                        "mt-0.5 text-sm font-semibold tabular-nums",
                        p.overdueNow > 0 ? "text-red-600" : "text-stone-900",
                      )}
                    >
                      {p.overdueNow > 0 ? p.overdueNow : "None"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 border-t border-stone-200/70 pt-3 text-sm text-stone-400">
                  Coordinates the whole board
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RoleSelect id={m.id} role={m.role} locked={self || !m.active} />
                {!self && (
                  <div className="ml-auto flex items-center gap-1.5">
                    {m.active && m.email && <LinkButton id={m.id} pending={s === "pending"} />}
                    <ActiveToggle id={m.id} active={m.active} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="surface hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] text-left">
          <thead>
            <tr className="border-b border-stone-200/70 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-4 py-4">Delivered</th>
              <th className="px-4 py-4">On time</th>
              <th className="px-4 py-4">Overdue now</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/70">
            {members.map((m) => {
              const s = status(m);
              const self = m.id === user.id;
              return (
                <tr key={m.id} className={cn(!m.active && "opacity-60")}>
                  <td className="px-6 py-4">
                    <Link href={`/team/${m.id}`} className="group flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-medium text-brand-800 transition-colors group-hover:bg-brand-800 group-hover:text-white">
                        {initials(m.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-900 group-hover:text-brand-800">
                          {m.name}
                          {self && <span className="ml-2 text-xs text-stone-400">(you)</span>}
                        </p>
                        <p className="truncate text-sm text-stone-500">
                          {m.email ?? "No email"}
                        </p>
                        <AlsoDoing roles={roles.get(m.id) ?? []} declared={m.role} />
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <RoleSelect id={m.id} role={m.role} locked={self || !m.active} />
                  </td>
                  {(() => {
                    const p = perf.get(m.id)!;
                    const owns = stepsForRoles(roles.get(m.id) ?? [m.role]).length > 0;
                    if (!owns) {
                      return (
                        <td colSpan={3} className="px-4 py-4 text-sm text-stone-400">
                          Coordinates the whole board
                        </td>
                      );
                    }
                    return (
                      <>
                        <td className="px-4 py-4">
                          <span className="text-lg font-semibold tabular-nums text-stone-900">
                            {p.done}
                          </span>
                          {p.late > 0 && (
                            <span className="ml-1.5 text-xs text-red-600">{p.late} late</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm tabular-nums text-stone-700">
                          {p.onTimeRate === null ? "—" : `${p.onTimeRate}%`}
                          {p.late > 0 && (
                            <span className="block text-xs text-stone-400">
                              avg {p.avgLag}d late
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {p.overdueNow > 0 ? (
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                              {p.overdueNow} overdue
                            </span>
                          ) : (
                            <span className="text-sm text-stone-400">None</span>
                          )}
                        </td>
                      </>
                    );
                  })()}
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        s === "active" && "bg-brand-50 text-brand-700",
                        s === "pending" && "bg-stone-100 text-stone-600",
                        s === "inactive" && "bg-red-50 text-red-600",
                      )}
                    >
                      {s === "active"
                        ? "Active"
                        : s === "pending"
                          ? "Invite pending"
                          : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {!self && (
                      <div className="flex items-center justify-end gap-1.5">
                        {m.active && m.email && (
                          <LinkButton id={m.id} pending={s === "pending"} />
                        )}
                        <ActiveToggle id={m.id} active={m.active} />
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
