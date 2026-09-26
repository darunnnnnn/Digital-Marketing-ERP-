"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ClientFormState } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { accent } from "@/lib/theme";
import { cn, initials } from "@/lib/utils";

export type ClientDefaults = {
  name?: string;
  industry?: string | null;
  status?: string;
  accent?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  monthlyTarget?: number;
  retainer?: number;
  services?: string;
  notes?: string | null;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function ClientForm({
  action,
  defaults = {},
  submitLabel,
  onCancel,
}: {
  action: (prev: ClientFormState, fd: FormData) => Promise<ClientFormState>;
  defaults?: ClientDefaults;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const [state, formAction] = useActionState<ClientFormState, FormData>(action, {});
  const prev = state.values ?? {};

  const [name, setName] = useState(prev.name ?? defaults.name ?? "");

  const err = state.errors ?? {};
  const a = accent();

  return (
    <form action={formAction} className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-stone-200 p-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-medium",
            a.avatar,
          )}
        >
          {initials(name || "New Client")}
        </span>
        <p className="min-w-0 truncate text-sm font-medium">{name || "New client"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" error={err.name} className="sm:col-span-2">
          <Input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ABC Restaurant"
            autoFocus
          />
        </Field>

        <Field label="Industry" hint="optional">
          <Input
            name="industry"
            defaultValue={prev.industry ?? defaults.industry ?? ""}
            placeholder="Food & Beverage"
          />
        </Field>

        <Field label="Status">
          <Select name="status" defaultValue={prev.status ?? defaults.status ?? "active"}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>

        <Field label="Monthly content target" hint="videos / month" error={err.monthlyTarget}>
          <Input
            name="monthlyTarget"
            type="number"
            min={0}
            max={999}
            defaultValue={prev.monthlyTarget ?? defaults.monthlyTarget ?? 12}
          />
        </Field>

        <Field label="Monthly retainer" hint="₹, optional" error={err.retainer}>
          <Input
            name="retainer"
            type="number"
            min={0}
            step={500}
            defaultValue={prev.retainer ?? defaults.retainer ?? 0}
          />
        </Field>

        <Field label="Services" hint="comma separated" className="sm:col-span-2">
          <Input
            name="services"
            defaultValue={prev.services ?? defaults.services ?? ""}
            placeholder="Reels, Shoots, Post design, Ads"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-stone-200 p-4">
        <p className="mb-3 text-[11px] font-medium text-stone-400">Point of contact</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" hint="optional">
            <Input
              name="contactName"
              defaultValue={prev.contactName ?? defaults.contactName ?? ""}
              placeholder="Priya"
            />
          </Field>
          <Field label="Email" hint="optional" error={err.contactEmail}>
            <Input
              name="contactEmail"
              type="email"
              defaultValue={prev.contactEmail ?? defaults.contactEmail ?? ""}
              placeholder="priya@abc.com"
            />
          </Field>
          <Field label="Phone" hint="optional">
            <Input
              name="contactPhone"
              defaultValue={prev.contactPhone ?? defaults.contactPhone ?? ""}
              placeholder="+91 98765 43210"
            />
          </Field>
        </div>
      </div>

      <Field label="Notes" hint="optional">
        <Textarea
          name="notes"
          rows={3}
          defaultValue={prev.notes ?? defaults.notes ?? ""}
          placeholder="Brand tone, do's and don'ts, approval preferences…"
        />
      </Field>

      <div className="flex items-center justify-end gap-2.5 border-t border-stone-200 pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
