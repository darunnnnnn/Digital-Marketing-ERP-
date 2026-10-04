import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { YesNoField } from "@/components/ui/YesNoField";
import { approveScript, handOff } from "@/lib/queries";
import type { ContentItem, Member } from "@/lib/types";
import type { MemberOption } from "./types";
// Both stylesheets, because these forms are used outside the video page too:
// .panel-pair and .panel-error live in PanelForm.css, which only that page
// used to pull in.
import "./PanelForm.css";
import "./StageActions.css";

/**
 * The forms behind the CEO's three gates.
 *
 * They live apart from the buttons that open them because they are used two
 * ways: as a dialog on the video page, and inline beside the script on the
 * approvals page, where putting them in a dialog would cover the very thing
 * being approved. Same fields, same writes, same validation either way.
 */

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

/** In a dialog the actions sit in a right-aligned row; inline they fill the width. */
export type FormLayout = "modal" | "inline";

export function Arrow() {
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

/** The submit row, shared so both layouts press the same button. */
function Actions({
  layout,
  busy,
  label,
  onCancel,
}: {
  layout: FormLayout;
  busy: boolean;
  label: string;
  onCancel?: () => void;
}) {
  return (
    <div className={layout === "inline" ? "gate-actions" : "modal-actions"}>
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Approving…" : label}
      </Button>
    </div>
  );
}

/**
 * Approving at a CEO gate does three things at once: moves the video on, picks
 * who does the next step, and sets their deadline. Keeping them together is
 * what stops work sitting in a column with nobody's name and no date on it.
 */
export function HandoffForm({
  item,
  info,
  team,
  actor,
  layout = "modal",
  onDone,
  onCancel,
}: {
  item: ContentItem;
  info: HandoffInfo;
  team: Member[];
  actor?: string;
  layout?: FormLayout;
  onDone: () => void;
  onCancel?: () => void;
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

      <Actions layout={layout} busy={busy} label={info.verb} onCancel={onCancel} />
    </form>
  );
}

/**
 * The script gate. The CEO says whether the video needs a shoot or can reuse
 * footage that already exists, and — if the scriptwriter asked for a voice over —
 * who records it. Whoever is picked here is who the work lands on.
 */
export function ScriptGateForm({
  item,
  info,
  team,
  actor,
  layout = "modal",
  onDone,
  onCancel,
}: {
  item: ContentItem;
  info: HandoffInfo & { script: ScriptGateInfo };
  team: Member[];
  actor?: string;
  layout?: FormLayout;
  onDone: () => void;
  onCancel?: () => void;
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
          <Field label="Existing footage link" hint="optional — where the editor finds the files">
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
        <p className="stage-hint">The scriptwriter marked this video as needing no voice over.</p>
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

      <Actions layout={layout} busy={busy} label={info.verb} onCancel={onCancel} />
    </form>
  );
}

/** Picks the right form for the gate the video is sitting on. */
export function GateForm(props: {
  item: ContentItem;
  info: HandoffInfo;
  team: Member[];
  actor?: string;
  layout?: FormLayout;
  onDone: () => void;
  onCancel?: () => void;
}) {
  return props.info.script ? (
    <ScriptGateForm {...props} info={{ ...props.info, script: props.info.script }} />
  ) : (
    <HandoffForm {...props} />
  );
}
