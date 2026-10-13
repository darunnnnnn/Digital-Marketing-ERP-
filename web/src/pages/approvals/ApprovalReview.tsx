import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { IconChevronLeft } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { canAdvance, canEditPanel, canSendBack } from "@/lib/permissions";
import { priority, refLabel, stageConfig } from "@/lib/pipeline";
import { editGateText, sendBack } from "@/lib/queries";
import type { Approval, GateNote } from "@/lib/approvals";
import type { ContentItemWithNames, Member, Viewer } from "@/lib/types";
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

/** The approve form's id, so the button above it can submit it. */
const FORM_ID = "approve-gate-form";

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Lifting a script out of the sheet to paste it somewhere else. */
function CopyScript({ text }: { text: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      toast.warn("Your browser wouldn't let us copy that.");
    }
  }

  return (
    <button type="button" className="review-copy" onClick={copy}>
      <CopyIcon />
      {done ? "Copied" : "Copy script"}
    </button>
  );
}

/**
 * One piece of what they sent, and — for a script — the chance to fix it here.
 *
 * Most things sent back a stage come back with two words changed. That costs
 * the writer a revision against their name and the video a day in the queue,
 * for a typo the reader had already found. So the text the gate is built around
 * is editable in place by anyone who may edit that panel, which is the CEO and
 * the manager: small change, save, approve. Anything bigger than a small change
 * still belongs in "Request changes", where the writer learns from it.
 */
function ReviewNote({
  note,
  item,
  viewer,
  onSaved,
}: {
  note: GateNote;
  item: ContentItemWithNames;
  viewer: Viewer;
  onSaved: () => void;
}) {
  // A script reads better monospaced — the beats line up, as on the video
  // page — and it is long enough to be worth copying out.
  const isScript = note.text.length > 240;
  const mayEdit = note.edit ? canEditPanel(viewer, item, note.edit.panel) : false;

  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const editing = draft !== null;

  async function save() {
    if (!note.edit || draft === null) return;
    setBusy(true);
    try {
      await editGateText(item, note.edit.field, draft, viewer.name);
      setDraft(null);
      toast.say("Saved.");
      onSaved();
    } catch (err) {
      toast.warn(err instanceof Error ? err.message : "Couldn't save your change.");
    }
    setBusy(false);
  }

  return (
    <section className="review-note">
      <div className="review-note-head">
        <h3 className="review-note-label">{note.label}</h3>
        {editing ? (
          <div className="review-edit-actions">
            <button
              type="button"
              className="review-edit-cancel"
              onClick={() => setDraft(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <Button type="button" variant="secondary" size="sm" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <div className="review-note-tools">
            {mayEdit && (
              <button type="button" className="review-copy" onClick={() => setDraft(note.text)}>
                <PencilIcon />
                Edit
              </button>
            )}
            {isScript && <CopyScript text={note.text} />}
          </div>
        )}
      </div>

      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={isScript ? 20 : 6}
          aria-label={`Edit ${note.label.toLowerCase()}`}
          className={cn("review-edit-field", isScript && "review-edit-script")}
        />
      ) : (
        <p className={cn("review-note-text", isScript && "review-note-script")}>{note.text}</p>
      )}
    </section>
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
  const handoff = canApproveThis ? buildHandoff(item, team, item.client) : null;

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
      {/*
       * Both ways out, at the top, where the decision is made — not at the foot
       * of a form you have to scroll to reach. The fields underneath are the
       * terms of the approval, so Approve submits them from up here through
       * `form=`, and the live half of the pair is the one that is filled in.
       */}
      <div className="decide-actions">
        {mode === "approve" ? (
          <Button
            type="submit"
            form={FORM_ID}
            className="decide-go"
            disabled={!canApproveThis || busy}
          >
            {busy ? "Approving…" : "Approve"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="decide-go"
            onClick={() => setMode("approve")}
            disabled={!canApproveThis}
          >
            Approve
          </Button>
        )}
        <button
          type="button"
          className={cn("decide-back", mode === "changes" && "decide-back-on")}
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
              {/* The same form as the video page's dialog, laid out for a column
                  and submitted by the button above it. */}
              <GateForm
                item={item}
                info={handoff}
                team={team}
                actor={viewer.name}
                layout="inline"
                formId={FORM_ID}
                onBusy={setBusy}
                onDone={onChanged}
              />
              <p className="decide-foot">
                Whoever you pick is emailed the moment you approve.
              </p>
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
            <Button type="submit" variant="danger" className="decide-send" disabled={busy}>
              {busy ? "Sending…" : (config.sendBack ?? "Request changes")}
            </Button>
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
        {/* The header carries only what names the thing and what moves between
            them: title, where it came from, and the pager. Everything about the
            submission itself — who, when, how late — belongs beside the work. */}
        <header className="review-head">
          <span className={cn("review-ref", late && "review-ref-late")}>
            {refLabel(item.ref)}
          </span>

          <div className="review-head-main">
            <h2 className="review-title truncate">{item.title}</h2>
            <p className="review-head-sub truncate">
              {[item.client?.name, gate.heading].filter(Boolean).join(" · ")}
            </p>
          </div>

          {/* Walking the queue without going back to the list. One track, so
              the two arrows and the counter read as a single control. */}
          <div className="review-pager">
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
        </header>

        <div className="review-cols">
          {/* What they sent. This is the column that scrolls. */}
          <div className="review-main">
            {/* Who sent it, when, and how late — one card, because it is one
                fact about the submission rather than part of the work. */}
            <div className="review-byline">
              <span className="who-avatar">{initials(sender?.name ?? "?")}</span>
              <div className="review-byline-text">
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

              <div className="review-chips">
                {item.priority !== "normal" && <Badge className={p.chip}>{p.label}</Badge>}
                {late && <Badge className="chip-alert">Overdue</Badge>}
                <span className={cn("review-wait", late && "review-wait-late")}>
                  {due ? `Deadline ${dueLabel(due)}` : "No deadline set"}
                </span>
              </div>
            </div>

            {links.length > 0 && (
              <div className="review-shelf">
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
              // Keyed by the video too: the pager swaps the item under the same
              // labels, and a draft left in the editor must not follow it.
              <ReviewNote
                key={`${item.id}-${n.label}`}
                note={n}
                item={item}
                viewer={viewer}
                onSaved={onChanged}
              />
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
