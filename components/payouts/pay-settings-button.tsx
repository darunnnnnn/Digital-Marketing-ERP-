"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { updatePaySettings, type PayFormState } from "@/app/(app)/payouts/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PAY_TYPES } from "@/lib/pay-rules";
import { cn } from "@/lib/utils";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save pay settings"}
    </Button>
  );
}

function SettingsForm({
  memberId,
  payType,
  rate,
  salary,
  onDone,
}: {
  memberId: string;
  payType: string;
  rate: number;
  salary: number;
  onDone: () => void;
}) {
  const [state, action] = useActionState<PayFormState, FormData>(updatePaySettings, {});
  const [type, setType] = useState(payType);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const usesRate = type === "per_task" || type === "hybrid";
  const usesSalary = type === "salary" || type === "hybrid";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="payType" value={type} />

      <div className="grid grid-cols-3 gap-2">
        {PAY_TYPES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setType(p.key)}
            className={cn(
              "rounded-2xl px-3 py-3 text-left ring-1 transition-colors",
              type === p.key
                ? "bg-brand-800 text-white ring-brand-800"
                : "bg-stone-50 text-stone-700 ring-stone-200 hover:ring-stone-300",
            )}
          >
            <span className="block text-sm font-medium">{p.label}</span>
            <span
              className={cn(
                "block text-xs",
                type === p.key ? "text-brand-100" : "text-stone-500",
              )}
            >
              {p.hint}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rate per delivery" hint="₹">
          <Input
            name="rate"
            type="number"
            min={0}
            step={50}
            defaultValue={rate}
            disabled={!usesRate}
          />
        </Field>
        <Field label="Monthly salary" hint="₹">
          <Input
            name="salary"
            type="number"
            min={0}
            step={500}
            defaultValue={salary}
            disabled={!usesSalary}
          />
        </Field>
      </div>

      <p className="text-xs text-stone-500">
        Applies to months that haven&apos;t been approved yet. Approved months keep the rates
        they were approved with.
      </p>

      {state.error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Submit />
      </div>
    </form>
  );
}

export function PaySettingsButton(props: {
  memberId: string;
  name: string;
  payType: string;
  rate: number;
  salary: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
      >
        Pay settings
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Pay settings · ${props.name}`}>
        {open && <SettingsForm {...props} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
