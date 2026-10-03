import type { ReactNode } from "react";
import { Link } from "react-router";
import { IconAlert, IconCheckCircle, IconClock, IconFilm } from "@/components/icons";
import { Stat } from "@/components/ui/Stat";
import { groupByUrgency, type Urgency, type WorkItem, type myWork } from "@/lib/my-work";
import { refLabel, stageConfig } from "@/lib/pipeline";
import { cn, formatCalendar } from "@/lib/utils";
import "./MyWork.css";
import "../clients/ClientsPage.css";

type Work = NonNullable<Awaited<ReturnType<typeof myWork>>>;

const GROUPS: { key: Urgency; title: string; note: string; tone: "alert" | "now" | "calm" }[] = [
  { key: "overdue", title: "Overdue", note: "Past the deadline", tone: "alert" },
  { key: "today", title: "Due today", note: "Finish these today", tone: "now" },
  { key: "week", title: "This week", note: "Coming up in the next 7 days", tone: "calm" },
  { key: "later", title: "Later", note: "Plenty of time", tone: "calm" },
  { key: "undated", title: "No deadline set", note: "Ask the CEO for a date", tone: "calm" },
];

function daysLabel(due: Date | null) {
  return due ? formatCalendar(due) : "No date";
}

function TaskRow({ item, verb, tone }: { item: WorkItem; verb: string; tone: string }) {
  return (
    <li>
      <Link to={`/content/${item.id}`} className="task">
        <span className={cn("task-ref", `task-ref-${tone}`)}>{refLabel(item.ref)}</span>

        <span className="task-main">
          <span className="task-title truncate">{item.title}</span>
          <span className="task-sub truncate">
            {item.client} · {verb}
          </span>
        </span>

        <span className="task-due">
          <span className={cn("task-due-date", tone === "alert" && "task-due-late")}>
            {daysLabel(item.due)}
          </span>
          <span className="task-due-label">deadline</span>
        </span>

        <span className="task-go">
          <svg
            viewBox="0 0 24 24"
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
    <section className="card">
      <div className="quiet-head">
        <h2 className="quiet-title">
          {title} <span className="muted">({items.length})</span>
        </h2>
        <p className="quiet-note">{note}</p>
      </div>
      <ul className="quiet-list">
        {items.slice(0, 5).map((item) => (
          <li key={item.id} className="quiet-row">
            <p className="quiet-row-title truncate">{item.title}</p>
            <p className="quiet-row-meta">
              <span className="truncate">{item.client}</span>
              <span>·</span>
              <span>{stageConfig(item.stage).label}</span>
            </p>
          </li>
        ))}
        {items.length > 5 && <li className="quiet-more">+{items.length - 5} more</li>}
      </ul>
    </section>
  );
}

export function MyWork({
  name,
  work,
  switcher,
}: {
  name: string;
  work: Work;
  /** Called after something in the queue changes, so the page can refetch. */
  onChanged?: () => void;
  /** Links to their other desks, for someone holding several roles. */
  switcher?: ReactNode;
}) {
  const groups = groupByUrgency(work.todo);
  const verb = work.task?.verb ?? "Your step";
  const noun = work.task?.noun ?? "task";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="stack-8">
      {/* Greeting */}
      <div>
        <p className="mywork-date">{today}</p>
        <h1 className="page-title mywork-hello">Hello, {name.split(" ")[0]}</h1>
        <p className="page-subtitle">
          {work.todo.length === 0
            ? "Nothing is waiting on you right now."
            : `You have ${work.todo.length} ${work.todo.length === 1 ? noun : `${noun}s`} to finish.`}
        </p>
        {switcher}
      </div>

      {/* Today at a glance */}
      <div className="stat-grid">
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
        <Stat icon={IconFilm} label="On your desk" value={work.todo.length} hint="assigned to you now" />
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

      <div className="mywork-columns">
        {/* The work itself */}
        <div className="mywork-main stack-5">
          {work.todo.length === 0 ? (
            <div className="card mywork-clear">
              <span className="mywork-clear-icon">
                <IconCheckCircle />
              </span>
              <p className="mywork-clear-title">You&apos;re all caught up</p>
              <p className="mywork-clear-note">
                New work appears here the moment the CEO assigns it to you, with the deadline
                attached.
              </p>
            </div>
          ) : (
            GROUPS.filter((g) => groups[g.key].length > 0).map((g) => (
              <section key={g.key} className="card">
                <div className={cn("group-head", `group-head-${g.tone}`)}>
                  <div>
                    <h2 className={cn("group-title", g.tone === "alert" && "group-title-alert")}>
                      {g.title}
                    </h2>
                    <p className="group-note">{g.note}</p>
                  </div>
                  <span className={cn("group-count", g.tone === "alert" && "group-count-alert")}>
                    {groups[g.key].length}
                  </span>
                </div>
                <ul className="task-list">
                  {groups[g.key].map((item) => (
                    <TaskRow key={item.id} item={item} verb={verb} tone={g.tone} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        {/* Side panel */}
        <div className="stack-5">
          <section className="card month-card">
            <h2 className="month-title">Your month</h2>
            <dl className="month-list">
              <div className="month-row">
                <dt className="muted">Delivered</dt>
                <dd className="month-value tabular">{work.month.done}</dd>
              </div>
              <div className="month-row">
                <dt className="muted">On time</dt>
                <dd className="month-value tabular">
                  {work.month.onTimeRate === null ? "—" : `${work.month.onTimeRate}%`}
                </dd>
              </div>
              {work.month.late > 0 && (
                <div className="month-row">
                  <dt className="muted">Delivered late</dt>
                  <dd className="month-value month-value-late tabular">{work.month.late}</dd>
                </div>
              )}
              {work.month.revisions > 0 && (
                <div className="month-row">
                  <dt className="muted">Sent back</dt>
                  <dd className="month-value tabular">{work.month.revisions}</dd>
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
