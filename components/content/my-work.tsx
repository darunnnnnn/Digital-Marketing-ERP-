import Link from "next/link";
import { IconAlert, IconCheckCircle, IconClock, IconFilm } from "@/components/icons";
import { Stat } from "@/components/ui/stat";
import { groupByUrgency, type Urgency, type WorkItem } from "@/lib/my-work";
import { refLabel, stageConfig } from "@/lib/pipeline";
import { cn, formatCalendar } from "@/lib/utils";

type Work = NonNullable<Awaited<ReturnType<typeof import("@/lib/my-work").myWork>>>;

const GROUPS: { key: Urgency; title: string; note: string; tone: "alert" | "now" | "calm" }[] =
  [
    { key: "overdue", title: "Overdue", note: "Past the deadline", tone: "alert" },
    { key: "today", title: "Due today", note: "Finish these today", tone: "now" },
    { key: "week", title: "This week", note: "Coming up in the next 7 days", tone: "calm" },
    { key: "later", title: "Later", note: "Plenty of time", tone: "calm" },
    { key: "undated", title: "No deadline set", note: "Ask the CEO for a date", tone: "calm" },
  ];

function daysLabel(due: Date | null, tone: string) {
  if (!due) return "No date";
  if (tone === "alert" || tone === "now") return formatCalendar(due);
  return formatCalendar(due);
}

function TaskRow({ item, verb, tone }: { item: WorkItem; verb: string; tone: string }) {
  return (
    <li>
      <Link
        href={`/content/${item.id}`}
        className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-brand-50/50 sm:gap-4 sm:px-5 sm:py-4"
      >
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-[11px] sm:h-11 sm:w-11 sm:text-xs",
            tone === "alert"
              ? "bg-red-50 text-red-700"
              : tone === "now"
                ? "bg-brand-100 text-brand-800"
                : "bg-stone-100 text-stone-600",
          )}
        >
          {refLabel(item.ref)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-stone-900 sm:text-base">
            {item.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-stone-500 sm:text-sm">
            {item.client} · {verb}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block text-xs font-medium sm:text-sm",
              tone === "alert" ? "text-red-600" : "text-stone-700",
            )}
          >
            {daysLabel(item.due, tone)}
          </span>
          <span className="hidden text-xs text-stone-400 sm:block">deadline</span>
        </span>

        <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-500 transition-colors group-hover:bg-brand-800 group-hover:text-white sm:grid">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
    </li>
  );
}

function QuietList({ title, note, items }: { title: string; note: string; items: WorkItem[] }) {
  return (
    <section className="surface overflow-hidden">
      <div className="px-5 pb-2 pt-4">
        <h2 className="text-sm font-medium text-stone-900">
          {title} <span className="text-stone-400">({items.length})</span>
        </h2>
        <p className="mt-0.5 text-xs text-stone-500">{note}</p>
      </div>
      <ul className="divide-y divide-stone-200/70">
        {items.slice(0, 5).map((item) => (
          <li key={item.id} className="px-5 py-3">
            <p className="truncate text-sm text-stone-700">{item.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-400">
              <span className="truncate">{item.client}</span>
              <span>·</span>
              <span className="shrink-0">{stageConfig(item.stage).label}</span>
            </p>
          </li>
        ))}
        {items.length > 5 && (
          <li className="px-5 py-2.5 text-xs text-stone-400">+{items.length - 5} more</li>
        )}
      </ul>
    </section>
  );
}

export function MyWork({ name, work }: { name: string; work: Work }) {
  const groups = groupByUrgency(work.todo);
  const verb = work.task?.verb ?? "Your step";
  const noun = work.task?.noun ?? "task";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting */}
      <div>
        <p className="text-sm text-stone-500">{today}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl lg:text-4xl">
          Hello, {name.split(" ")[0]}
        </h1>
        <p className="mt-1.5 text-sm text-stone-500 sm:mt-2 sm:text-base">
          {work.todo.length === 0
            ? "Nothing is waiting on you right now."
            : `You have ${work.todo.length} ${work.todo.length === 1 ? noun : `${noun}s`} to finish.`}
        </p>
      </div>

      {/* Today at a glance */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          icon={IconAlert}
          label="Overdue"
          value={groups.overdue.length}
          tone={groups.overdue.length ? "alert" : "slate"}
          hint={groups.overdue.length ? "needs attention first" : "nothing late"}
        />
        <Stat
          icon={IconClock}
          label="Due today"
          value={groups.today.length}
          tone={groups.today.length ? "accent" : "slate"}
          hint={`${groups.week.length} more this week`}
        />
        <Stat
          icon={IconFilm}
          label="On your desk"
          value={work.todo.length}
          hint="assigned to you now"
        />
        <Stat
          icon={IconCheckCircle}
          label="Done this month"
          value={work.month.done}
          hint={
            work.month.onTimeRate === null
              ? "nothing finished yet"
              : `${work.month.onTimeRate}% on time`
          }
        />
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
        {/* The work itself */}
        <div className="space-y-5 lg:col-span-2">
          {work.todo.length === 0 ? (
            <div className="surface px-5 py-12 text-center sm:px-6 sm:py-16">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <IconCheckCircle className="h-6 w-6" />
              </span>
              <p className="mt-4 text-base font-medium text-stone-900">
                You&apos;re all caught up
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-stone-500">
                New work appears here the moment the CEO assigns it to you, with the deadline
                attached.
              </p>
            </div>
          ) : (
            GROUPS.filter((g) => groups[g.key].length > 0).map((g) => (
              <section key={g.key} className="surface overflow-hidden">
                <div
                  className={cn(
                    "flex items-baseline justify-between gap-3 px-5 py-3.5",
                    g.tone === "alert" && "bg-red-50/70",
                    g.tone === "now" && "bg-brand-50/70",
                  )}
                >
                  <div>
                    <h2
                      className={cn(
                        "text-sm font-semibold",
                        g.tone === "alert" ? "text-red-700" : "text-stone-900",
                      )}
                    >
                      {g.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-500">{g.note}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                      g.tone === "alert"
                        ? "bg-red-100 text-red-700"
                        : "bg-white text-stone-600 ring-1 ring-stone-200",
                    )}
                  >
                    {groups[g.key].length}
                  </span>
                </div>
                <ul className="divide-y divide-stone-200/70 border-t border-stone-200/70">
                  {groups[g.key].map((item) => (
                    <TaskRow key={item.id} item={item} verb={verb} tone={g.tone} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-5">
          <section className="surface px-5 py-4">
            <h2 className="text-sm font-medium text-stone-900">Your month</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-stone-500">Delivered</dt>
                <dd className="font-medium tabular-nums text-stone-900">{work.month.done}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-stone-500">On time</dt>
                <dd className="font-medium tabular-nums text-stone-900">
                  {work.month.onTimeRate === null ? "—" : `${work.month.onTimeRate}%`}
                </dd>
              </div>
              {work.month.late > 0 && (
                <div className="flex items-baseline justify-between">
                  <dt className="text-stone-500">Delivered late</dt>
                  <dd className="font-medium tabular-nums text-red-600">{work.month.late}</dd>
                </div>
              )}
              {work.month.revisions > 0 && (
                <div className="flex items-baseline justify-between">
                  <dt className="text-stone-500">Sent back</dt>
                  <dd className="font-medium tabular-nums text-stone-900">
                    {work.month.revisions}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {work.upcoming.length > 0 && (
            <QuietList
              title="Coming to you"
              note="Assigned, but an earlier step is still running."
              items={work.upcoming}
            />
          )}

          {work.handedOn.length > 0 && (
            <QuietList
              title="Handed on"
              note="Your part is done. Nothing to do here."
              items={work.handedOn}
            />
          )}
        </div>
      </div>
    </div>
  );
}
