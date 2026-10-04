import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { IconChevronLeft } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { canAdvance, canSendBack } from "@/lib/permissions";
import { priority, refLabel } from "@/lib/pipeline";
import type { Approval } from "@/lib/approvals";
import type { Member, Viewer } from "@/lib/types";
import { cn, dueLabel, formatDateTime, initials } from "@/lib/utils";
import { StageActions } from "@/pages/content/StageActions";
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
 * One submission, opened full size.
 *
 * A script runs to pages and a review is the one moment someone actually reads
 * it, so it gets a sheet of its own rather than a drawer inside a list row: the
 * text sets its own height, the page behind holds still, and the approve
 * buttons stay pinned at the bottom however far down the script you are.
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

  // Escape closes; the arrow keys walk the queue. The page behind is frozen so
  // a long script scrolls inside the sheet instead of moving the list.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onStep(-1);
      if (e.key === "ArrowRight") onStep(1);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onStep]);

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
              <h2 className="review-title">{item.title}</h2>
              <p className="review-head-sub">
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

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="review-close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="review-head-meta">
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
        </header>

        {/* Everything they sent. This is the part that scrolls. */}
        <div className="review-body">
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
              <p className={cn("review-note-text", n.text.length > 240 && "review-note-script")}>
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
        </div>

        {/* Pinned, so the decision is reachable from anywhere in a long script. */}
        <footer className="review-foot">
          <StageActions
            item={item}
            canForward={canAdvance(viewer, item)}
            canBack={canSendBack(viewer, item)}
            handoff={buildHandoff(item, team)}
            team={team}
            actor={viewer.name}
            onChanged={onChanged}
          />
          <Link to={`/content/${item.id}`} className="review-open">
            Open the video
            <OpenIcon />
          </Link>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
