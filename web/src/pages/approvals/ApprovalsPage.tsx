import { useState } from "react";
import { Link } from "react-router";
import {
  IconCamera,
  IconCheckCircle,
  IconChevronLeft,
  IconClock,
  IconPencil,
  IconScissors,
} from "@/components/icons";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stat } from "@/components/ui/Stat";
import { useViewer } from "@/lib/auth";
import { APPROVAL_STAGES, GATES, listApprovals, type Approval } from "@/lib/approvals";
import { canAdvance, canSendBack } from "@/lib/permissions";
import { priority, refLabel } from "@/lib/pipeline";
import { listMembers } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { cn, dueLabel, formatDateTime, initials } from "@/lib/utils";
import { StageActions } from "@/pages/content/StageActions";
import { buildHandoff } from "@/pages/content/handoff-info";
import type { Member, Viewer } from "@/lib/types";
import "./ApprovalsPage.css";
import "../content/MyWork.css";
import "../team/TeamPage.css";

/** An icon per gate, the same ones the sidebar uses for those people's desks. */
const GATE_ICONS: Record<string, typeof IconPencil> = {
  script_review: IconPencil,
  footage_review: IconCamera,
  edit_review: IconScissors,
};

function OpenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

/** How long it has been sitting here, in the words the CEO cares about. */
function waitLabel(a: Approval) {
  if (a.waiting === null) return "Waiting";
  if (a.waiting === 0) return "Sent today";
  if (a.waiting === 1) return "Waiting 1 day";
  return `Waiting ${a.waiting} days`;
}

/** Who sent it, and anyone else whose work is in the same submission. */
function Sender({ approval }: { approval: Approval }) {
  const { sender, alsoFrom, sentAt } = approval;

  return (
    <div className="appr-sender">
      <span className="who-avatar">{initials(sender?.name ?? "?")}</span>
      <div className="who-text">
        <p className="appr-sender-name truncate">
          {sender?.name ?? "Nobody assigned"}
          {alsoFrom.map((p) => (
            <span key={p.name} className="appr-sender-also">
              {" + "}
              {p.name}
            </span>
          ))}
        </p>
        <p className="appr-sender-meta truncate">
          {sender?.role ?? "assignment cleared"}
          {sentAt ? ` · sent ${formatDateTime(sentAt)}` : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * What they sent. Links open in a new tab, because reviewing footage means
 * leaving the page and coming back to the same queue; a script is read in
 * place, folded away so twenty rows stay scannable.
 */
function Submission({ approval }: { approval: Approval }) {
  const { links, notes, facts } = approval;

  if (links.length === 0 && notes.length === 0 && facts.length === 0) {
    return (
      <p className="appr-nothing">
        They sent this on without attaching anything. Open the video to see the whole trail.
      </p>
    );
  }

  return (
    <div className="appr-sent">
      {links.length > 0 && (
        <div className="appr-links">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="appr-link"
            >
              {l.label}
              <OpenIcon />
            </a>
          ))}
        </div>
      )}

      {facts.length > 0 && (
        <dl className="appr-facts">
          {facts.map((f) => (
            <div key={f.label} className="appr-fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {notes.map((n) =>
        // A script runs to pages; a shoot note is a line or two and reads better open.
        n.text.length > 240 ? (
          <details key={n.label} className="appr-read">
            <summary className="appr-read-summary">
              <span className="appr-read-closed">Read the {n.label.toLowerCase()}</span>
              <span className="appr-read-open">Hide the {n.label.toLowerCase()}</span>
            </summary>
            <pre className="appr-body">{n.text}</pre>
          </details>
        ) : (
          <div key={n.label} className="appr-note">
            <p className="appr-note-label">{n.label}</p>
            <p className="appr-note-text">{n.text}</p>
          </div>
        ),
      )}
    </div>
  );
}

function ApprovalRow({
  approval,
  team,
  viewer,
  onChanged,
}: {
  approval: Approval;
  team: Member[];
  viewer: Viewer;
  onChanged: () => void;
}) {
  const { item, late, due, sender } = approval;
  const p = priority(item.priority);
  const [open, setOpen] = useState(false);

  return (
    <li className={cn("appr", open && "appr-open-row")}>
      {/* The gist: enough to know what it is and who sent it. Click for the rest. */}
      <button
        type="button"
        className="appr-gist"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn("appr-ref", late && "appr-ref-late")}>{refLabel(item.ref)}</span>

        <span className="appr-gist-main">
          <span className="appr-title">{item.title}</span>
          <span className="appr-gist-sub truncate">
            {[item.client?.name, sender ? `from ${sender.name}` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>

        <span className="appr-gist-tags">
          {item.priority !== "normal" && <Badge className={p.chip}>{p.label}</Badge>}
          {late && <Badge className="chip-alert">Overdue</Badge>}
        </span>

        <span className="appr-when">
          <span className={cn("appr-wait", late && "appr-wait-late")}>{waitLabel(approval)}</span>
          <span className="appr-due">
            {due ? `Deadline ${dueLabel(due)}` : "No deadline set"}
          </span>
        </span>

        <span className="appr-chevron" aria-hidden>
          <IconChevronLeft />
        </span>
      </button>

      {open && (
        <div className="appr-details">
          <Sender approval={approval} />
          <Submission approval={approval} />

          <div className="appr-foot">
            {/* The same buttons and dialogs as the video page; the checks are
                asked for rather than assumed. */}
            <StageActions
              item={item}
              canForward={canAdvance(viewer, item)}
              canBack={canSendBack(viewer, item)}
              handoff={buildHandoff(item, team)}
              team={team}
              actor={viewer.name}
              onChanged={onChanged}
            />
            <Link to={`/content/${item.id}`} className="appr-open">
              Open the video
              <OpenIcon />
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

export function ApprovalsPage() {
  const viewer = useViewer();

  const { data, loading, error, reload } = useAsync(async () => {
    // The team list is needed either way — to name the voice over person on a
    // submission, and to fill the assignee dropdown in every approve dialog.
    const team = await listMembers(viewer.agencyId, true);
    return { team, approvals: await listApprovals(viewer.agencyId, team) };
  }, [viewer.agencyId]);

  if (loading && !data) return <PageSkeleton />;
  if (error) return <EmptyState title="Couldn't load your approvals" description={error} />;

  const team = data?.team ?? [];
  const approvals = data?.approvals ?? [];
  const overdue = approvals.filter((a) => a.late).length;
  const longest = approvals.reduce((max, a) => Math.max(max, a.waiting ?? 0), 0);
  const count = (stage: string) => approvals.filter((a) => a.item.stage === stage).length;

  return (
    <div className="stack-8">
      <div className="page-head">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">
            Everything the team has sent you, oldest first. Approving here hands the video
            straight to the next person.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <Stat
          icon={IconClock}
          label="Waiting on you"
          value={approvals.length}
          tone="accent"
          hint={approvals.length === 1 ? "one submission" : "submissions to clear"}
        />
        <Stat
          icon={IconPencil}
          label="Scripts"
          value={count("script_review")}
          hint="to read and approve"
        />
        <Stat
          icon={IconCamera}
          label="Footage"
          value={count("footage_review")}
          hint="shot and sent in"
        />
        <Stat
          icon={IconCheckCircle}
          label="Final cuts"
          value={count("edit_review")}
          hint="one look from going live"
        />
      </div>

      {(overdue > 0 || longest >= 2) && (
        <div className="appr-notice">
          <IconClock />
          <p>
            {overdue > 0 &&
              `${overdue === 1 ? "One of these is" : `${overdue} of these are`} past the deadline of the step you're reviewing. `}
            {longest >= 1 &&
              `The longest has been on your desk ${longest} ${longest === 1 ? "day" : "days"}. `}
            Work is stopped until you clear it.
          </p>
        </div>
      )}

      {approvals.length === 0 ? (
        <div className="card mywork-clear">
          <span className="mywork-clear-icon">
            <IconCheckCircle />
          </span>
          <p className="mywork-clear-title">Nothing is waiting on you</p>
          <p className="mywork-clear-note">
            Scripts, footage and final cuts land here the moment the team sends them in. Until
            then the pipeline is theirs to move.
          </p>
        </div>
      ) : (
        APPROVAL_STAGES.filter((stage) => count(stage) > 0).map((stage) => {
          const gate = GATES[stage];
          const Icon = GATE_ICONS[stage];
          const rows = approvals.filter((a) => a.item.stage === stage);

          return (
            <Card key={stage}>
              <CardHeader
                title={gate.heading}
                action={<span className="appr-section-count">{rows.length}</span>}
              />
              <p className="appr-section-note">
                <Icon />
                {gate.note}
              </p>
              <ul className="appr-list">
                {rows.map((a) => (
                  <ApprovalRow
                    key={a.item.id}
                    approval={a}
                    team={team}
                    viewer={viewer}
                    onChanged={reload}
                  />
                ))}
              </ul>
            </Card>
          );
        })
      )}
    </div>
  );
}
