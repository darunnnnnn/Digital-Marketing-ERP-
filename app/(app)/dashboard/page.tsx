import Link from "next/link";
import { EarningsCard } from "@/components/dashboard/earnings-card";
import {
  IconAlert,
  IconCheckCircle,
  IconChevronLeft,
  IconClock,
  IconFilm,
} from "@/components/icons";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { groupByUrgency, myWork } from "@/lib/my-work";
import { memberEarnings } from "@/lib/payouts";
import { extraRoles, shiftMonth } from "@/lib/performance";
import { canSeeDashboard } from "@/lib/permissions";
import { ROLE_LABELS, refLabel, type Role } from "@/lib/pipeline";
import { cn, currentMonthKey, formatCalendar, monthLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * One person's own page: what they owe this month, and what they have earned.
 *
 * The CEO does not get this — they are not paid through the pipeline and
 * already have the board, the team page and the full payroll. Everyone else
 * only ever sees their own numbers here; nothing on this page reads another
 * person's rate or total.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireRole(canSeeDashboard);
  const { month } = await searchParams;

  const thisMonth = currentMonthKey();
  const monthKey =
    month && /^\d{4}-\d{2}$/.test(month) && month <= thisMonth ? month : thisMonth;
  const isCurrent = monthKey === thisMonth;

  const [earnings, work] = await Promise.all([memberEarnings(user, monthKey), myWork(user)]);

  const groups = work ? groupByUrgency(work.todo) : null;
  const roleLabel = ROLE_LABELS[user.role as Role] ?? user.role;
  const also = extraRoles(earnings.roles, user.role);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-stone-500">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl lg:text-4xl">
            Hello, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500 sm:mt-2 sm:text-base">
            {roleLabel}
            {/* Earned by being assigned the step, not by anyone keeping a list. */}
            {also.length > 0 && (
              <>
                {" · also "}
                <span className="font-medium text-brand-700">
                  {also.map((r) => (ROLE_LABELS[r as Role] ?? r).toLowerCase()).join(", ")}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Month switcher, so last month's pay is still reachable. */}
        <div className="flex shrink-0 items-center justify-between gap-1 rounded-full bg-white/80 p-1 ring-1 ring-stone-200 lg:justify-start">
          <Link
            href={`/dashboard?month=${shiftMonth(monthKey, -1)}`}
            aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-full text-stone-600 transition-colors hover:bg-stone-100"
          >
            <IconChevronLeft className="h-4 w-4" />
          </Link>
          <span className="flex-1 px-2 text-center text-sm font-medium text-stone-900 sm:min-w-36 sm:flex-none">
            {monthLabel(monthKey)}
          </span>
          {isCurrent ? (
            <span className="grid h-9 w-9 place-items-center text-stone-300" aria-hidden>
              <IconChevronLeft className="h-4 w-4 rotate-180" />
            </span>
          ) : (
            <Link
              href={`/dashboard?month=${shiftMonth(monthKey, 1)}`}
              aria-label="Next month"
              className="grid h-9 w-9 place-items-center rounded-full text-stone-600 transition-colors hover:bg-stone-100"
            >
              <IconChevronLeft className="h-4 w-4 rotate-180" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
        {/* The money, first and loudest. */}
        <div className="lg:col-span-1">
          <EarningsCard earnings={earnings} />
        </div>

        <div className="space-y-5 sm:space-y-6 lg:col-span-2">
          {/* The month's delivery, which is what the pay is computed from. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Stat
              icon={IconCheckCircle}
              label="Delivered"
              value={earnings.deliveries}
              tone="accent"
              hint={isCurrent ? "so far this month" : monthLabel(monthKey)}
            />
            <Stat
              icon={IconClock}
              label="On time"
              value={work?.month.onTimeRate === null ? "—" : `${work?.month.onTimeRate ?? 0}%`}
              hint={
                work && work.month.late > 0 ? `${work.month.late} late` : "every step on time"
              }
            />
            <Stat
              icon={IconFilm}
              label="On your desk"
              value={work?.todo.length ?? 0}
              hint="waiting on you now"
            />
            <Stat
              icon={IconAlert}
              label="Overdue"
              value={groups?.overdue.length ?? 0}
              tone={groups && groups.overdue.length > 0 ? "alert" : "slate"}
              hint={groups && groups.overdue.length > 0 ? "past the deadline" : "nothing late"}
            />
          </div>

          {/* What to do next. The full queue lives on the pipeline page; this
              is the short list that decides what they open first. */}
          <Card>
            <CardHeader
              title="Next up"
              action={
                <Link
                  href="/content"
                  className="text-xs font-medium text-brand-700 transition-colors hover:text-brand-800"
                >
                  All your work
                </Link>
              }
            />

            {!work || work.todo.length === 0 ? (
              <p className="px-4 pb-5 pt-2 text-sm text-stone-400 sm:px-6">
                {work
                  ? "Nothing is waiting on you right now."
                  : "No pipeline steps are assigned to you yet."}
              </p>
            ) : (
              <ul className="divide-y divide-stone-200/70 border-t border-stone-200/70">
                {[...groups!.overdue, ...groups!.today, ...groups!.week, ...groups!.later]
                  .slice(0, 6)
                  .map((item) => {
                    const late = groups!.overdue.includes(item);
                    const due = item.due;

                    return (
                      <li key={`${item.id}-${item.verb}`}>
                        <Link
                          href={`/content/${item.id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-50/50 sm:px-6"
                        >
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-[11px]",
                              late ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600",
                            )}
                          >
                            {refLabel(item.ref)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-stone-900">
                              {item.title}
                            </span>
                            {/* The verb is per item: a mixed queue says "Write
                                the script" on one row and "Edit the video" on
                                the next. */}
                            <span className="mt-0.5 block truncate text-xs text-stone-500">
                              {item.client} · {item.verb}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-xs font-medium",
                              late ? "text-red-600" : "text-stone-400",
                            )}
                          >
                            {due ? formatCalendar(due) : "No date"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}

                {work.todo.length > 6 && (
                  <li className="px-4 py-2.5 text-xs text-stone-400 sm:px-6">
                    +{work.todo.length - 6} more on the pipeline page
                  </li>
                )}
              </ul>
            )}
          </Card>

          {/* A manager holds no pipeline step of their own unless assigned one,
              so point them at the work they actually coordinate. */}
          {!work && (
            <EmptyState
              title="You coordinate the board"
              description="No pipeline step is assigned to you, so there is nothing in a personal queue. The agency board is where your work is."
              action={<LinkButton href="/content">Go to the pipeline</LinkButton>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
