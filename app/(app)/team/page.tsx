import { IconAlert, IconCheckCircle, IconClock, IconUsers } from "@/components/icons";
import { InviteButton } from "@/components/team/invite-button";
import { ActiveToggle, LinkButton, RoleSelect } from "@/components/team/member-actions";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTeam } from "@/lib/permissions";
import Link from "next/link";
import { ROLE_STEPS, memberPerformance } from "@/lib/performance";
import { cn, currentMonthKey, initials, monthLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
  const perf = new Map(
    await Promise.all(
      members.map(async (m) => [m.id, (await memberPerformance(m, monthKey)).summary] as const),
    ),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Team</h1>
          <p className="mt-2 text-base text-stone-500">
            Everyone&apos;s delivery for {monthLabel(monthKey)}. Click a name for their full
            profile.
          </p>
        </div>
        <InviteButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={IconUsers} label="Team members" value={members.length} />
        <Stat icon={IconCheckCircle} label="Active" value={count("active")} tone="accent" />
        <Stat icon={IconClock} label="Invite pending" value={count("pending")} />
        <Stat icon={IconAlert} label="Deactivated" value={count("inactive")} />
      </div>

      <div className="surface overflow-x-auto">
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
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <RoleSelect id={m.id} role={m.role} locked={self || !m.active} />
                  </td>
                  {(() => {
                    const p = perf.get(m.id)!;
                    const owns = (ROLE_STEPS[m.role] ?? []).length > 0;
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
