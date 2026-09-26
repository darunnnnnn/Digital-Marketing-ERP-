"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { inviteMember, type InviteState } from "@/app/(app)/team/actions";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ROLES, ROLE_LABELS } from "@/lib/pipeline";
import { InviteLink } from "./invite-link";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create invite"}
    </Button>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState<InviteState, FormData>(inviteMember, {});
  const err = state.errors ?? {};

  if (state.link) {
    return (
      <div className="space-y-5">
        <InviteLink name={state.name} link={state.link} />
        <div className="flex justify-end">
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={err.name}>
          <Input
            name="name"
            defaultValue={state.values?.name}
            placeholder="Joel Thomas"
            autoFocus
          />
        </Field>
        <Field label="Email" error={err.email} hint="they'll sign in with this">
          <Input
            name="email"
            type="email"
            defaultValue={state.values?.email}
            placeholder="joel@agency.com"
          />
        </Field>
      </div>
      <Field label="Role" error={err.role}>
        <Select name="role" defaultValue={state.values?.role ?? "editor"}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end gap-2.5 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Submit />
      </div>
    </form>
  );
}

export function InviteButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus className="h-4 w-4" />
        Invite member
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a team member"
        subtitle="You'll get a link to send them. No email is sent automatically."
      >
        {open && <InviteForm onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
