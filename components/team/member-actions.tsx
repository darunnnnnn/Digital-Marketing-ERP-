"use client";

import { useActionState, useRef, useState } from "react";
import {
  changeRole,
  newInviteLink,
  setActive,
  type InviteState,
} from "@/app/(app)/team/actions";
import { Modal } from "@/components/ui/modal";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/pipeline";
import { InviteLink } from "./invite-link";

export function RoleSelect({
  id,
  role,
  locked,
}: {
  id: string;
  role: string;
  locked: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);

  if (locked) {
    return <span className="text-sm text-stone-700">{ROLE_LABELS[role as Role] ?? role}</span>;
  }

  return (
    <form ref={ref} action={changeRole}>
      <input type="hidden" name="id" value={id} />
      <select
        name="role"
        defaultValue={role}
        onChange={() => ref.current?.requestSubmit()}
        className="cursor-pointer rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-800 outline-none focus:border-brand-500"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </form>
  );
}

export function LinkButton({ id, pending }: { id: string; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<InviteState, FormData>(newInviteLink, {});

  return (
    <>
      <form
        action={(fd) => {
          setOpen(true);
          action(fd);
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
        >
          {pending ? "Invite link" : "Reset link"}
        </button>
      </form>
      <Modal
        open={open && Boolean(state.link)}
        onClose={() => setOpen(false)}
        title={pending ? "New invite link" : "Password reset link"}
        subtitle={
          pending
            ? "Any earlier invite link for this person stops working."
            : "They'll set a new password. Their current one keeps working until they do."
        }
      >
        {state.link && <InviteLink name={state.name} link={state.link} />}
      </Modal>
    </>
  );
}

export function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  return (
    <form action={setActive}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        type="submit"
        className={
          active
            ? "rounded-full bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
            : "rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
        }
      >
        {active ? "Deactivate" : "Reactivate"}
      </button>
    </form>
  );
}
