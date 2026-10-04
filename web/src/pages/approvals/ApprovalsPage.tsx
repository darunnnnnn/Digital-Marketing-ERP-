import { useState } from "react";
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
import { priority, refLabel } from "@/lib/pipeline";
import { listMembers } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { cn, dueLabel } from "@/lib/utils";
import { ApprovalReview } from "./ApprovalReview";
import "./ApprovalsPage.css";
import "../content/MyWork.css";
import "../team/TeamPage.css";

/** An icon per gate, the same ones the sidebar uses for those people's desks. */
const GATE_ICONS: Record<string, typeof IconPencil> = {
  script_review: IconPencil,
  footage_review: IconCamera,
  edit_review: IconScissors,
};

/** How long it has been sitting here, in the words the CEO cares about. */
function waitLabel(a: Approval) {
  if (a.waiting === null) return "Waiting";
  if (a.waiting === 0) return "Sent today";
  if (a.waiting === 1) return "Waiting 1 day";
  return `Waiting ${a.waiting} days`;
}

function ApprovalRow({
  approval,
  onOpen,
}: {
  approval: Approval;
  onOpen: () => void;
}) {
  const { item, late, due, sender } = approval;
  const p = priority(item.priority);

  return (
    <li className="appr">
      {/* The gist: enough to know what it is and who sent it. The submission
          itself opens full size, because a script is read, not glanced at. */}
      <button type="button" className="appr-gist" onClick={onOpen}>
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
    </li>
  );
}

export function ApprovalsPage() {
  const viewer = useViewer();
  const [openId, setOpenId] = useState<string | null>(null);

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

  // The queue in the order the page lists it, so the sheet's prev/next arrows
  // move the way the eye does. An approved video drops out of `approvals` on
  // reload, which closes the sheet by itself — there is nothing left to review.
  const ordered = APPROVAL_STAGES.flatMap((stage) =>
    approvals.filter((a) => a.item.stage === stage),
  );
  const openIndex = ordered.findIndex((a) => a.item.id === openId);
  const open = openIndex === -1 ? null : ordered[openIndex];

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
                    onOpen={() => setOpenId(a.item.id)}
                  />
                ))}
              </ul>
            </Card>
          );
        })
      )}

      {open && (
        <ApprovalReview
          approval={open}
          position={{ index: openIndex, total: ordered.length }}
          team={team}
          viewer={viewer}
          onClose={() => setOpenId(null)}
          onStep={(delta) => {
            const next = ordered[openIndex + delta];
            if (next) setOpenId(next.item.id);
          }}
          onChanged={reload}
        />
      )}
    </div>
  );
}
