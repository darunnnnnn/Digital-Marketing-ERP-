import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { IconChevronLeft } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { canAdvance, canSendBack } from "@/lib/permissions";
import { priority, refLabel, stageConfig } from "@/lib/pipeline";
import { sendBack } from "@/lib/queries";
import type { Approval } from "@/lib/approvals";
import type { Member, Viewer } from "@/lib/types";
import { cn, dueLabel, formatDateTime, initials } from "@/lib/utils";
import { GateForm } from "@/pages/content/gate-forms";
import { buildHandoff } from "@/pages/content/handoff-info";
import "./ApprovalReview.css";

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

/**
 * The decision, sat beside the work rather than on top of it.
 *
 * This used to be a dialog opened from a button, which meant the form covered
 * the script the moment you decided to act on it — you had to read, remember,
 * then fill in blind. Approve and send-back are two halves of one choice, so
 * they share one panel and one switch instead of two buttons that each open
 * something different.
 */
function Decision({
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
  const { item } = approval;
  const [mode, setMode] = useState<"approve" | "changes">("approve");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const config = stageConfig(item.stage);
  const canApproveThis = canAdvance(viewer, item);
  const canReject = canSendBack(viewer, item);
  const handoff = canApproveThis ? buildHandoff(item, team) : null;

  async function requestChanges(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await sendBack(item, note, viewer.name);
      onChanged();
    } catch (err) {
      toast.warn(err instanceof Error ? err.message : "Couldn't send this back.");
    }
    setBusy(false);
  }

  return (
    <div className="decide">
      <div className="decide-switch" role="tablist" aria-label="Your decision">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "approve"}
          className={cn("decide-tab", mode === "approve" && "decide-tab-on")}
          onClick={() => setMode("approve")}
          disabled={!canApproveThis}
        >
          Approve
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "changes"}
          className={cn("decide-tab", mode === "changes" && "decide-tab-off-on")}
          onClick={() => setMode("changes")}
          disabled={!canReject}
        >
          {config.sendBack ?? "Request changes"}
        </button>
      </div>

      <div className="decide-body">
        {mode === "approve" ? (
          handoff ? (
            <>
              <p className="decide-note">
                Approving hands this straight to the next person, so pick who and by when.
              </p>
              {/* The same form as the video page's dialog, laid out for a column. */}
              <GateForm
                item={item}
                info={handoff}
                team={team}
                actor={viewer.name}
                layout="inline"
                onDone={onChanged}
              />
            </>
          ) : (
            <p className="stage-hint">You can&apos;t approve this step.</p>
          )
        ) : (
          <form onSubmit={requestChanges} className="stack-5">
            <p className="decide-note">
              This moves the video back a stage and logs a revision against it.
            </p>
            <Field label="What needs changing?" hint="optional, shows in the activity log">
              <Textarea
                rows={5}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Hook is too slow — tighten the first 3 seconds."
              />
            </Field>
            <div className="gate-actions">
              <Button type="submit" variant="danger" disabled={busy}>
                {busy ? "Sending…" : (config.sendBack ?? "Request changes")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * One submission, opened full size.
 *
 * A script runs to pages and a review is the one moment someone actually reads
 * it, so it gets a sheet of its own: the work on the left, scrolling as far as
 * it needs to, and the decision pinned beside it on the right, where it stays
 * readable the whole way down.
 *
 * Prev/next walk the queue in the order the page lists it, so a backlog can be
 * cleared without closing and reopening for every video.
 */
export function ApprovalReview({
  approval,
  position,
  team,
  viewer,
  onClose,
  onStep,
  onChanged,
}: {
  approval: Approval;
  /** Where this sits in the whole queue, for "3 of 11" and the arrows. */
  position: { index: number; total: number };
  team: Member[];
  viewer: Viewer;
  onClose: () => void;
  onStep: (delta: number) => void;
  onChanged: () => void;
}) {
  const { item, gate, sender, alsoFrom, sentAt, late, due, links, notes, facts } = approval;
  const p = priority(item.priority);

  // Escape closes. The page behind is frozen so a long script scrolls inside
  // the sheet instead of moving the list. Arrow keys are deliberately not bound
  // here: the panel is full of text fields where they mean something else.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div className="review-layer">
      <div className="review-scrim" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${gate.heading}: ${item.title}`}
        className="review"
      >
        <header className="review-head">
          <div className="review-head-top">
            <span className={cn("review-ref", late && "review-ref-late")}>
              {refLabel(item.ref)}
            </span>
            <div className="review-head-main">
              <h2 className="review-title truncate">{item.title}</h2>
              <p className="review-head-sub truncate">
                {[item.client?.name, gate.heading].filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Walking the queue without going back to the list. */}
            <div className="review-steps">
              <button
                type="button"
                className="review-step"
                onClick={() => onStep(-1)}
                disabled={position.index === 0}
                aria-label="Previous submission"
              >
                <IconChevronLeft />
              </button>
              <span className="review-count">
                {position.index + 1} of {position.total}
              </span>
              <button
                type="button"
                className="review-step"
                onClick={() => onStep(1)}
                disabled={position.index === position.total - 1}
                aria-label="Next submission"
              >
                <IconChevronLeft className="flip" />
              </button>
            </div>

            <button type="button" onClick={onClose} aria-label="Close" className="review-close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="review-cols">
          {/* What they sent. This is the column that scrolls. */}
          <div className="review-main">
            <div className="review-sender-row">
              <div className="review-sender">
                <span className="who-avatar">{initials(sender?.name ?? "?")}</span>
                <div className="who-text">
                  <p className="review-sender-name truncate">
                    {sender?.name ?? "Nobody assigned"}
                    {alsoFrom.map((person) => (
                      <span key={person.name} className="review-sender-also">
                        {" + "}
                        {person.name}
                      </span>
                    ))}
                  </p>
                  <p className="review-sender-meta truncate">
                    {sender?.role ?? "assignment cleared"}
                    {sentAt ? ` · sent ${formatDateTime(sentAt)}` : ""}
                  </p>
                </div>
              </div>

              <div className="review-chips">
                {item.priority !== "normal" && <Badge className={p.chip}>{p.label}</Badge>}
                {late && <Badge className="chip-alert">Overdue</Badge>}
                <span className={cn("review-wait", late && "review-wait-late")}>
                  {due ? `Deadline ${dueLabel(due)}` : "No deadline set"}
                </span>
              </div>
            </div>

            {links.length > 0 && (
              <div className="review-links">
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="review-link"
                  >
                    {l.label}
                    <OpenIcon />
                  </a>
                ))}
              </div>
            )}

            {facts.length > 0 && (
              <dl className="review-facts">
                {facts.map((f) => (
                  <div key={f.label} className="review-fact">
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {notes.map((n) => (
              <section key={n.label} className="review-note">
                <h3 className="review-note-label">{n.label}</h3>
                {/* A script reads better monospaced — the beats line up, as on
                    the video page. Short notes stay in the body face. */}
                <p
                  className={cn("review-note-text", n.text.length > 240 && "review-note-script")}
                >
                  {n.text}
                </p>
              </section>
            ))}

            {links.length === 0 && notes.length === 0 && facts.length === 0 && (
              <p className="review-nothing">
                They sent this on without attaching anything. Open the video to see the whole
                trail.
              </p>
            )}

            <Link to={`/content/${item.id}`} className="review-open">
              Open the full video page
              <OpenIcon />
            </Link>
          </div>

          {/* The decision, always in view beside the work. */}
          <aside className="review-side">
            <Decision approval={approval} team={team} viewer={viewer} onChanged={onChanged} />
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
