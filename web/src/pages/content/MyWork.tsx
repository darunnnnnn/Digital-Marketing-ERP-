import type { ReactNode } from "react";
import { Link } from "react-router";
import { IconAlert, IconCheckCircle, IconClock, IconFilm } from "@/components/icons";
import { Stat } from "@/components/ui/Stat";
import { groupByUrgency, type Urgency, type WorkItem, type myWork } from "@/lib/my-work";
import { refLabel, stageConfig, stageProgress } from "@/lib/pipeline";
import { cn, formatCalendar } from "@/lib/utils";
import "@/components/ui/Badge.css";
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

const IconArrow = () => (
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
);

/**
 * One job inside its group's card. Everything on it is real: the stage chip
 * and the progress bar come from the pipeline, the deadline from the step this
 * role owns. The action button is the point of the row — the rest of it exists
 * so someone can decide whether to press it.
 */
function TaskRow({
  item,
  verb,
  noun,
  tone,
}: {
  item: WorkItem;
  verb: string;
  noun: string;
  tone: string;
}) {
  const stage = stageConfig(item.stage);
  const progress = stageProgress(item.stage);

  return (
    <li className="work-item">
      <span className={cn("work-ref", `work-ref-${tone}`)}>{refLabel(item.ref)}</span>

      <div className="work-item-main">
        <div className="work-item-top">
          <Link to={`/content/${item.id}`} className="work-item-title truncate">
            {item.title}
          </Link>
          <span className={cn("badge", stage.chip)}>{stage.label}</span>
        </div>

        <p className="work-item-verb">{verb}</p>

        <div className="work-item-meta">
          <span className="work-item-client truncate">
            <IconFilm />
            {item.client}
          </span>
          <span className="work-item-progress" title={`${progress}% of the way to published`}>
            <span aria-hidden className="work-bar">
              <span className="work-bar-fill" style={{ width: `${progress}%` }} />
            </span>
            {progress}%
          </span>
        </div>
      </div>

      <div className="work-item-side">
        <p className="work-due">
          <span className={cn("work-due-date", tone === "alert" && "work-due-late")}>
            {daysLabel(item.due)}
          </span>
          <span className="work-due-label">deadline</span>
        </p>
        <Link to={`/content/${item.id}`} className="work-open">
          Open the {noun}
          <IconArrow />
        </Link>
      </div>
    </li>
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

      <div className="stack-5">
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
            <section key={g.key} className="card work-group">
              <div className={cn("group-head", `group-head-${g.tone}`)}>
                <span aria-hidden className={cn("group-dot", `group-dot-${g.tone}`)} />
                <h2 className={cn("group-title", g.tone === "alert" && "group-title-alert")}>
                  {g.title}
                </h2>
                <span className="group-sep" aria-hidden>
                  ·
                </span>
                <p className={cn("group-note", `group-note-${g.tone}`)}>{g.note}</p>
                <span className="group-count">
                  {groups[g.key].length} {groups[g.key].length === 1 ? noun : `${noun}s`}
                </span>
              </div>

              <ul className="work-list">
                {groups[g.key].map((item) => (
                  <TaskRow key={item.id} item={item} verb={verb} noun={noun} tone={g.tone} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
