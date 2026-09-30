import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { advanceStage, handOff, sendBack } from "@/lib/queries";
import { stageConfig } from "@/lib/pipeline";
import type { ContentItem, Member } from "@/lib/types";
import type { MemberOption } from "./types";
import "./StageActions.css";

export type HandoffInfo = {
  verb: string;
  who: string;
  options: MemberOption[];
  defaultMemberId: string;
  defaultDue: string;
};

function Arrow() {
  return (
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
}

/**
 * Approving at a CEO gate does three things at once: moves the video on, picks
 * who does the next step, and sets their deadline. Keeping them in one dialog is
 * what stops work sitting in a column with nobody's name and no date on it.
 */
function HandoffDialog({
  item,
  info,
  team,
  actor,
  onDone,
}: {
  item: ContentItem;
  info: HandoffInfo;
  team: Member[];
  actor?: string;
  onDone: () => void;
}) {
  const [memberId, setMemberId] = useState(info.defaultMemberId);
  const [due, setDue] = useState(info.defaultDue);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const message = await handOff(item, { memberId, due, note, actor }, team);
    setBusy(false);
    if (message) return setError(message);
    onDone();
  }

  return (
    <form onSubmit={submit} className="stack-5">
      <div className="panel-pair">
        <Field label={`Assign to a ${info.who}`}>
          <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Choose a {info.who}…</option>
            {info.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Their deadline">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>

      <Field label="Note for them" hint="optional, shows in the activity log">
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Shoot at golden hour, two angles…"
        />
      </Field>

      {info.options.length === 0 && (
        <p className="stage-hint">
          Nobody on your team has the {info.who} role yet. Add them from the Team page first.
        </p>
      )}

      {error && <p className="panel-error">{error}</p>}

      <div className="modal-actions">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Approving…" : info.verb}
        </Button>
      </div>
    </form>
  );
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
          onClick={() => void run(() => advanceStage(item, actor), "Couldn't move this video on.")}
        >
          {busy ? "Moving…" : config.advance}
          <Arrow />
        </Button>
      )}

      {config.advance && !canForward && (
        <span className="stage-waiting">
          Waiting on {config.owner === "ceo" ? "CEO approval" : `the ${config.owner}`}
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
          subtitle={`Choose the ${handoff.who} and the date they need to be done by.`}
        >
          <HandoffDialog
            item={item}
            info={handoff}
            team={team}
            actor={actor}
            onDone={() => {
              setGateOpen(false);
              onChanged();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
