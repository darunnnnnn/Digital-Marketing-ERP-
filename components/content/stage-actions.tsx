"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { advanceStage, sendBack } from "@/app/(app)/content/actions";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { stageConfig } from "@/lib/pipeline";
import { HandoffButton, type HandoffInfo } from "./handoff-button";

function AdvanceButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Moving…" : label}
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    </Button>
  );
}

export function StageActions({
  id,
  stage,
  canForward,
  canBack,
  handoff,
}: {
  id: string;
  stage: string;
  canForward: boolean;
  canBack: boolean;
  /** Set when this stage is a CEO gate: approving also assigns the next person. */
  handoff?: HandoffInfo | null;
}) {
  const [open, setOpen] = useState(false);
  const config = stageConfig(stage);

  return (
    <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
      {config.sendBack && canBack && (
        <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
          {config.sendBack}
        </Button>
      )}

      {config.advance && canForward && handoff && <HandoffButton id={id} info={handoff} />}

      {config.advance && canForward && !handoff && (
        <form action={advanceStage}>
          <input type="hidden" name="id" value={id} />
          <AdvanceButton label={config.advance} />
        </form>
      )}

      {config.advance && !canForward && (
        <span className="rounded-full bg-stone-100 px-4 py-2.5 text-sm text-stone-600">
          Waiting on {config.owner === "ceo" ? "CEO approval" : `the ${config.owner}`}
        </span>
      )}

      {!config.advance && (
        <span className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm font-medium text-brand-600">
          Live and counted
        </span>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={config.sendBack ?? "Send back"}
        subtitle="This moves the video back a stage and logs a revision against it."
      >
        <form action={sendBack} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <Field label="What needs changing?" hint="optional, shows in the activity log">
            <Textarea
              name="note"
              rows={3}
              placeholder="Hook is too slow — tighten the first 3 seconds."
              autoFocus
            />
          </Field>
          <div className="flex flex-col-reverse gap-2.5 border-t border-stone-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              {config.sendBack}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
