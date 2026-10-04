import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { advanceStage, completeTrack, sendBack } from "@/lib/queries";
import { stageConfig } from "@/lib/pipeline";
import type { ContentItem, Member } from "@/lib/types";
import { Arrow, GateForm, type HandoffInfo, type ScriptGateInfo } from "./gate-forms";
import "./StageActions.css";

// The gate forms themselves live in ./gate-forms, because the approvals page
// shows them inline beside the script instead of in a dialog.
export type { HandoffInfo, ScriptGateInfo };

/**
 * The shoot and the voice over each finish on their own; the video waits on the
 * shoot stage until both parts it needs are in. This is the cameraman's and the
 * voice over person's own button, in place of the generic "send it on".
 */
export function TrackActions({
  item,
  track,
  actor,
  onChanged,
}: {
  item: ContentItem;
  track: "shoot" | "vo";
  actor?: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const done = track === "shoot" ? Boolean(item.shootCompletedAt) : Boolean(item.voCompletedAt);
  const other =
    track === "shoot"
      ? item.voNeeded && !item.voCompletedAt
        ? "the voice over"
        : null
      : item.shootNeeded !== false && !item.shootCompletedAt
        ? "the shoot"
        : null;

  if (done) {
    return (
      <span className="stage-waiting">
        {track === "shoot" ? "Footage" : "Voice over"} sent
        {other ? ` — waiting on ${other}` : ""}
      </span>
    );
  }

  const label = track === "shoot" ? "Send footage" : "Send voice over";

  return (
    <div className="stage-actions">
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await completeTrack(item, track, actor);
            onChanged();
          } catch (e) {
            toast.warn(e instanceof Error ? e.message : "Couldn't send that.");
          }
          setBusy(false);
        }}
      >
        {busy ? "Sending…" : label}
        <Arrow />
      </Button>
      {other && (
        <span className="stage-waiting">The video moves on once {other} is in too</span>
      )}
    </div>
  );
}

/** Who a video on the shoot stage is still waiting for, in plain words. */
function shootWaiting(item: ContentItem) {
  const parts = [];
  if (item.shootNeeded !== false && !item.shootCompletedAt) parts.push("the cameraman");
  if (item.voNeeded && !item.voCompletedAt) parts.push("the voice over");
  return parts.length ? parts.join(" and ") : "the team";
}

export function StageActions({
  item,
  canForward,
  canBack,
  handoff,
  team,
  actor,
  onChanged,
}: {
  item: ContentItem;
  canForward: boolean;
  canBack: boolean;
  /** Set when this stage is a CEO gate: approving also assigns the next person. */
  handoff?: HandoffInfo | null;
  team: Member[];
  actor?: string;
  onChanged: () => void;
}) {
  const [backOpen, setBackOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const config = stageConfig(item.stage);

  async function run(work: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await work();
      onChanged();
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : failure);
    }
    setBusy(false);
  }

  return (
    <div className="stage-actions">
      {config.sendBack && canBack && (
        <Button variant="secondary" size="md" onClick={() => setBackOpen(true)}>
          {config.sendBack}
        </Button>
      )}

      {config.advance && canForward && handoff && (
        <Button onClick={() => setGateOpen(true)}>
          {handoff.verb}
          <Arrow />
        </Button>
      )}

      {config.advance && canForward && !handoff && (
        <Button
          disabled={busy}
          onClick={() =>
            void run(() => advanceStage(item, actor), "Couldn't move this video on.")
          }
        >
          {busy ? "Moving…" : config.advance}
          <Arrow />
        </Button>
      )}

      {config.advance && !canForward && (
        <span className="stage-waiting">
          Waiting on{" "}
          {config.owner === "ceo"
            ? "CEO approval"
            : item.stage === "shooting"
              ? shootWaiting(item)
              : `the ${config.owner}`}
        </span>
      )}

      {!config.advance && <span className="stage-live">Live and counted</span>}

      <Modal
        open={backOpen}
        onClose={() => setBackOpen(false)}
        title={config.sendBack ?? "Send back"}
        subtitle="This moves the video back a stage and logs a revision against it."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await sendBack(item, note, actor);
              setBackOpen(false);
              setNote("");
            }, "Couldn't send this back.");
          }}
          className="stack-4"
        >
          <Field label="What needs changing?" hint="optional, shows in the activity log">
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Hook is too slow — tighten the first 3 seconds."
              autoFocus
            />
          </Field>
          <div className="modal-actions stage-modal-actions">
            <Button type="button" variant="ghost" onClick={() => setBackOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {config.sendBack}
            </Button>
          </div>
        </form>
      </Modal>

      {handoff && (
        <Modal
          open={gateOpen}
          onClose={() => setGateOpen(false)}
          title={handoff.verb}
          subtitle={
            handoff.script
              ? "Decide how this video is made, then choose who does each part and by when."
              : `Choose the ${handoff.who} and the date they need to be done by.`
          }
        >
          <GateForm
            item={item}
            info={handoff}
            team={team}
            actor={actor}
            onDone={() => {
              setGateOpen(false);
              onChanged();
            }}
            onCancel={() => setGateOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
