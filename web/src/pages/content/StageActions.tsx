import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { YesNoField } from "@/components/ui/YesNoField";
import { advanceStage, approveScript, completeTrack, handOff, sendBack } from "@/lib/queries";
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
  /** Set only at the script gate, which decides how the video is made. */
  script?: ScriptGateInfo;
};

/** What the script gate needs beyond the single person the other gates pick. */
export type ScriptGateInfo = {
  /** The scriptwriter asked for a voice over. */
  voNeeded: boolean;
  editors: MemberOption[];
  voiceovers: MemberOption[];
  defaults: {
    cameramanId: string;
    shootDue: string;
    editorId: string;
    editDue: string;
    voiceoverId: string;
    voDue: string;
    footageUrl: string;
  };
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

function PersonSelect({
  label,
  value,
  options,
  noun,
  onChange,
}: {
  label: string;
  value: string;
  options: MemberOption[];
  noun: string;
  onChange: (id: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a {noun}…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/**
 * The script gate. The CEO says whether the video needs a shoot or can reuse
 * footage that already exists, and — if the scriptwriter asked for a voice over —
 * who records it. Whoever is picked here is who the work lands on.
 */
function ScriptGateDialog({
  item,
  info,
  team,
  actor,
  onDone,
}: {
  item: ContentItem;
  info: HandoffInfo & { script: ScriptGateInfo };
  team: Member[];
  actor?: string;
  onDone: () => void;
}) {
  const { script } = info;
  const [shootNeeded, setShootNeeded] = useState(true);
  const [cameramanId, setCameramanId] = useState(script.defaults.cameramanId);
  const [shootDue, setShootDue] = useState(script.defaults.shootDue);
  const [footageUrl, setFootageUrl] = useState(script.defaults.footageUrl);
  const [editorId, setEditorId] = useState(script.defaults.editorId);
  const [editDue, setEditDue] = useState(script.defaults.editDue);
  const [voiceoverId, setVoiceoverId] = useState(script.defaults.voiceoverId);
  const [voDue, setVoDue] = useState(script.defaults.voDue);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const message = await approveScript(
      item,
      {
        shootNeeded,
        cameramanId,
        shootDue,
        footageUrl,
        editorId,
        editDue,
        voiceoverId,
        voDue,
        note,
        actor,
      },
      team,
    );
    setBusy(false);
    if (message) return setError(message);
    onDone();
  }

  return (
    <form onSubmit={submit} className="stack-5">
      <YesNoField
        label="Does this video need a shoot?"
        hint="choose No to use footage you already have"
        name="shootNeeded"
        value={shootNeeded}
        onChange={setShootNeeded}
      />

      {shootNeeded ? (
        <div className="panel-pair">
          <PersonSelect
            label="Assign to a cameraman"
            value={cameramanId}
            options={info.options}
            noun="cameraman"
            onChange={setCameramanId}
          />
          <Field label="Shoot deadline">
            <Input type="date" value={shootDue} onChange={(e) => setShootDue(e.target.value)} />
          </Field>
        </div>
      ) : (
        <>
          <Field
            label="Existing footage link"
            hint="optional — where the editor finds the files"
          >
            <Input
              type="url"
              value={footageUrl}
              onChange={(e) => setFootageUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
            />
          </Field>
          <div className="panel-pair">
            <PersonSelect
              label="Assign to an editor"
              value={editorId}
              options={script.editors}
              noun="editor"
              onChange={setEditorId}
            />
            <Field label="Edit deadline">
              <Input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
            </Field>
          </div>
        </>
      )}

      {script.voNeeded ? (
        <div className="panel-pair">
          <PersonSelect
            label="Voice over, assign to"
            value={voiceoverId}
            options={script.voiceovers}
            noun="voice over person"
            onChange={setVoiceoverId}
          />
          <Field label="Voice over deadline">
            <Input type="date" value={voDue} onChange={(e) => setVoDue(e.target.value)} />
          </Field>
        </div>
      ) : (
        <p className="stage-hint">
          The scriptwriter marked this video as needing no voice over.
        </p>
      )}

      <Field label="Note for them" hint="optional, shows in the activity log">
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Shoot at golden hour, two angles…"
        />
      </Field>

      {shootNeeded && info.options.length === 0 && (
        <p className="stage-hint">
          Nobody on your team has the cameraman role yet. Add them from the Team page first.
        </p>
      )}
      {script.voNeeded && script.voiceovers.length === 0 && (
        <p className="stage-hint">
          Nobody on your team has the voice over role yet. Add them from the Team page first.
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
          {handoff.script ? (
            <ScriptGateDialog
              item={item}
              info={{ ...handoff, script: handoff.script }}
              team={team}
              actor={actor}
              onDone={() => {
                setGateOpen(false);
                onChanged();
              }}
            />
          ) : (
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
          )}
        </Modal>
      )}
    </div>
  );
}
