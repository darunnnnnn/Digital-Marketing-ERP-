import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { issueInvite } from "@/lib/invites";
import { updateMember } from "@/lib/queries";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { InviteLink } from "./InviteLink";
import "./MemberActions.css";

export function RoleSelect({
  id,
  role,
  locked,
  onChanged,
}: {
  id: string;
  role: string;
  locked: boolean;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(role);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (locked) {
    return <span className="role-fixed">{ROLE_LABELS[role as Role] ?? role}</span>;
  }

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setBusy(true);
    try {
      await updateMember(id, { role: next });
      onChanged();
    } catch (e) {
      setValue(previous);
      toast.warn(e instanceof Error ? e.message : "Couldn't change that role.");
    }
    setBusy(false);
  }

  return (
    <select
      value={value}
      disabled={busy}
      onChange={(e) => void change(e.target.value)}
      aria-label="Role"
      className="role-select"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

/**
 * Issues a fresh invite link. Used both for someone who hasn't signed in yet and
 * as a password reset — in both cases they set their own password from the link,
 * and nobody here ever sees or types it.
 */
export function InviteLinkButton({
  id,
  name,
  pending,
}: {
  id: string;
  name: string;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const toast = useToast();

  async function create() {
    try {
      setLink(await issueInvite(id));
      setOpen(true);
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't create a link.");
    }
  }

  return (
    <>
      <button type="button" onClick={create} className="row-action row-action-brand">
        {pending ? "Invite link" : "Reset link"}
      </button>
      <Modal
        open={open && Boolean(link)}
        onClose={() => setOpen(false)}
        title={pending ? "New invite link" : "Password reset link"}
        subtitle={
          pending
            ? "Any earlier invite link for this person stops working."
            : "They'll set a new password. Their current one keeps working until they do."
        }
      >
        {link && <InviteLink name={name} link={link} />}
      </Modal>
    </>
  );
}

export function ActiveToggle({
  id,
  active,
  onChanged,
}: {
  id: string;
  active: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function toggle() {
    setBusy(true);
    try {
      await updateMember(id, { active: !active });
      onChanged();
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't change that.");
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={cn("row-action", active ? "row-action-danger" : "row-action-brand-soft")}
    >
      {active ? "Deactivate" : "Reactivate"}
    </button>
  );
}
