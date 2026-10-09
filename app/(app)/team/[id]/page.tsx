import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconAlert,
  IconCheckCircle,
  IconChevronLeft,
  IconClock,
  IconPencil,
} from "@/components/icons";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { computePay, payTypeLabel } from "@/lib/pay-rules";
import { ROLE_STEPS, memberPerformance, shiftMonth, type WorkRow } from "@/lib/performance";
import { canManageTeam } from "@/lib/permissions";
import { ROLE_LABELS, refLabel, type Role } from "@/lib/pipeline";
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
} from "@/lib/utils";

export const dynamic = "force-dynamic";

function LatePill({ days, open = false }: { days: number; open?: boolean }) {
  if (days === 0) {
    return (
      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
        {open ? "On track" : "On time"}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      {days}d late
    </span>
  );
}

function WorkLink({ row }: { row: WorkRow }) {
  return (
    <Link href={`/content/${row.id}`} className="min-w-0 hover:text-brand-800">
      <p className="truncate text-sm font-medium text-stone-900">{row.title}</p>
      <p className="truncate text-xs text-stone-500">
        <span className="font-mono">{refLabel(row.ref)}</span> · {row.client}
      </p>
    </Link>
  );
}

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireRole(canManageTeam);
  const { id } = await params;
  const { month } = await searchParams;

  const member = await db.member.findFirst({ where: { id, agencyId: user.agencyId } });
  if (!member) notFound();

  const thisMonth = currentMonthKey();
  const monthKey =
    month && /^\d{4}-\d{2}$/.test(month) && month <= thisMonth ? month : thisMonth;
  const isCurrent = monthKey === thisMonth;

  const perf = await memberPerformance(member, monthKey);
  const payout = await db.payout.findUnique({
    where: { memberId_monthKey: { memberId: member.id, monthKey } },
  });
  const pay = payout
    ? { total: payout.amount, status: payout.status === "paid" ? "Paid" : "Approved" }
    : {
        total: computePay(member.payType, perf.summary.done, member.rate, member.salary).total,
        status: isCurrent ? "Running total" : "Not approved yet",
      };
  const s = perf.summary;
  const steps = ROLE_STEPS[member.role] ?? [];
  const roleLabel = ROLE_LABELS[member.role as Role] ?? member.role;
  const doneLabel =
    steps.length === 1 ? steps[0].label : steps.length ? "Approvals" : "Completed";
  const status = !member.active
    ? "Deactivated"
    : member.passwordHash
      ? "Active"
      : "Invite pending";

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link
        href="/team"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
      >
        <IconChevronLeft className="h-4 w-4" />
        Team
      </Link>

      {/* Header */}
      <div className="surface flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:gap-6">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-800 text-lg font-medium text-white shadow-lg shadow-brand-900/20 sm:h-16 sm:w-16 sm:text-xl">
          {initials(member.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              {member.name}
            </h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                status === "Active" && "bg-brand-50 text-brand-700",
                status === "Invite pending" && "bg-stone-100 text-stone-600",
                status === "Deactivated" && "bg-red-50 text-red-600",
              )}
            >
              {status}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            {roleLabel} · {member.email ?? "No email"} · last sign-in{" "}
            {member.lastLoginAt ? timeAgo(member.lastLoginAt) : "never"}
          </p>
        </div>

        {/* Month switcher */}
        <div className="flex shrink-0 items-center justify-between gap-1 rounded-full bg-stone-100 p-1 lg:justify-start">
          <Link
            href={`/team/${member.id}?month=${shiftMonth(monthKey, -1)}`}
            aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-full text-stone-600 transition-colors hover:bg-white"
          >
            <IconChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-36 px-2 text-center text-sm font-medium text-stone-900">
            {monthLabel(monthKey)}
          </span>
          {isCurrent ? (
            <span className="grid h-9 w-9 place-items-center text-stone-300" aria-hidden>
              <IconChevronLeft className="h-4 w-4 rotate-180" />
            </span>
          ) : (
            <Link
              href={`/team/${member.id}?month=${shiftMonth(monthKey, 1)}`}
              aria-label="Next month"
              className="grid h-9 w-9 place-items-center rounded-full text-stone-600 transition-colors hover:bg-white"
            >
              <IconChevronLeft className="h-4 w-4 rotate-180" />
            </Link>
          )}
        </div>
      </div>

      {steps.length === 0 ? (
        <div className="surface px-7 py-10 text-center">
          <p className="text-base font-medium text-stone-900">No personal pipeline step</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-stone-500">
            A {roleLabel.toLowerCase()} plans and coordinates rather than owning one step, so
            there&apos;s no per-person delivery count. Their work shows across the whole content
            board.
          </p>
        </div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              hint={
                s.done ? `${s.onTime} of ${s.done} on or before deadline` : "nothing finished"
              }
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
            <Stat
              icon={IconPencil}
              label="Sent back"
              value={s.revisions}
              hint="revisions requested"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Completed this month */}
            <Card className="lg:col-span-2">
              <CardHeader
                title={`Delivered in ${monthLabel(monthKey)}`}
                action={<span className="text-sm text-stone-400">{s.done} total</span>}
              />
              {perf.completed.length === 0 ? (
                <p className="px-6 pb-8 pt-4 text-sm text-stone-400">
                  Nothing delivered this month.
                </p>
              ) : (
                <>
                  {/* Phones: a list, since five columns cannot share 360px. */}
                  <ul className="divide-y divide-stone-200/70 border-t border-stone-200/70 lg:hidden">
                    {perf.completed.map((row) => (
                      <li
                        key={`m-${row.id}-${row.step}`}
                        className="flex items-start gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <WorkLink row={row} />
                          <p className="mt-1 text-[11px] text-stone-400">
                            {steps.length > 1 ? `${row.step} · ` : ""}
                            due {formatCalendar(row.due) ?? "—"} · delivered{" "}
                            {formatDate(row.doneAt)}
                          </p>
                        </div>
                        <span className="shrink-0">
                          <LatePill days={row.lateDays} />
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[560px] text-left">
                      <thead>
                        <tr className="border-y border-stone-200/70 text-xs font-semibold uppercase tracking-wider text-stone-500">
                          <th className="px-6 py-3">Video</th>
                          {steps.length > 1 && <th className="px-3 py-3">Step</th>}
                          <th className="px-3 py-3">Due</th>
                          <th className="px-3 py-3">Delivered</th>
                          <th className="px-6 py-3 text-right">Timing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200/70">
                        {perf.completed.map((row) => (
                          <tr key={`${row.id}-${row.step}`}>
                            <td className="max-w-72 px-6 py-3.5">
                              <WorkLink row={row} />
                            </td>
                            {steps.length > 1 && (
                              <td className="px-3 py-3.5 text-sm text-stone-600">{row.step}</td>
                            )}
                            <td className="px-3 py-3.5 text-sm text-stone-600">
                              {formatCalendar(row.due) ?? "—"}
                            </td>
                            <td className="px-3 py-3.5 text-sm text-stone-600">
                              {formatDate(row.doneAt)}
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <LatePill days={row.lateDays} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>

            <div className="space-y-6">
              {/* Pay */}
              <Card>
                <CardHeader
                  title={`Pay for ${monthLabel(monthKey)}`}
                  action={
                    <Link
                      href={`/payouts?month=${monthKey}`}
                      className="text-sm font-medium text-brand-700 hover:text-brand-800"
                    >
                      Payouts
                    </Link>
                  }
                />
                <div className="px-6 pb-6 pt-1">
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-stone-900 sm:text-3xl">
                    {formatMoney(pay.total)}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
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
                  action={<span className="text-sm text-stone-400">{s.inProgress}</span>}
                />
                {perf.open.length === 0 ? (
                  <p className="px-6 pb-6 pt-2 text-sm text-stone-400">
                    Nothing waiting on them.
                  </p>
                ) : (
                  <ul className="divide-y divide-stone-200/70 pb-2">
                    {perf.open.slice(0, 8).map((row) => (
                      <li
                        key={`${row.id}-${row.step}`}
                        className="flex items-center gap-3 px-6 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <WorkLink row={row} />
                        </div>
                        {row.lateDays > 0 ? (
                          <LatePill days={row.lateDays} open />
                        ) : (
                          <span className="shrink-0 text-xs text-stone-500">
                            {dueLabel(row.due) ?? "No date"}
                          </span>
                        )}
                      </li>
                    ))}
                    {perf.open.length > 8 && (
                      <li className="px-6 py-3 text-xs text-stone-400">
                        +{perf.open.length - 8} more
                      </li>
                    )}
                  </ul>
                )}
              </Card>

              {/* By client */}
              <Card>
                <CardHeader title="By client" />
                {perf.byClient.length === 0 ? (
                  <p className="px-6 pb-6 pt-2 text-sm text-stone-400">No deliveries yet.</p>
                ) : (
                  <ul className="space-y-4 px-6 pb-6 pt-2">
                    {perf.byClient.map((c) => (
                      <li key={c.client}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="truncate font-medium text-stone-800">
                            {c.client}
                          </span>
                          <span className="shrink-0 tabular-nums text-stone-500">
                            {c.done}
                            {c.late > 0 && (
                              <span className="text-red-600"> · {c.late} late</span>
                            )}
                          </span>
                        </div>
                        <ProgressBar value={(c.done / s.done) * 100} className="mt-1.5" />
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
