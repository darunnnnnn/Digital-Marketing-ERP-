"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { handOffStage, type ContentFormState } from "@/app/(app)/content/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PriceQuestion, type PriceAsk } from "./price-question";
import type { MemberOption } from "./types";

export type HandoffInfo = {
  verb: string;
  who: string;
  options: MemberOption[];
  defaultMemberId: string;
  defaultDue: string;
  /** Omitted for anyone who is not the CEO: only they set prices. */
  price?: PriceAsk | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Approving…" : label}
    </Button>
  );
}

function HandoffForm({
  id,
  info,
  onDone,
}: {
  id: string;
  info: HandoffInfo;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ContentFormState, FormData>(handOffStage, {});
  const err = state.errors ?? {};

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Assign to a ${info.who}`} error={err.memberId}>
          <Select name="memberId" defaultValue={info.defaultMemberId}>
            <option value="">Choose a {info.who}…</option>
            {info.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Their deadline" error={err.due}>
          <Input type="date" name="due" defaultValue={info.defaultDue} />
        </Field>
      </div>

      {info.price && <PriceQuestion ask={info.price} error={err.price} />}

      <Field label="Note for them" hint="optional, shows in the activity log">
        <Textarea name="note" rows={2} placeholder="Shoot at golden hour, two angles…" />
      </Field>

      {info.options.length === 0 && (
        <p className="rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm text-stone-600">
          Nobody on your team has the {info.who} role yet. Add them from the Team page first.
        </p>
      )}

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Submit label={info.verb} />
      </div>
    </form>
  );
}

export function HandoffButton({ id, info }: { id: string; info: HandoffInfo }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="h-auto min-h-11 py-2 text-left">
        {info.verb}
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={info.verb}
        subtitle={`Choose the ${info.who} and the date they need to be done by.`}
      >
        {open && <HandoffForm id={id} info={info} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
