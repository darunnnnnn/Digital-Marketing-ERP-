import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Picker } from "@/components/ui/Picker";
import { useToast } from "@/components/ui/Toast";
import { sendInvite, type InviteResult } from "@/lib/invites";
import { updateMember } from "@/lib/queries";
import { isManager } from "@/lib/permissions";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/pipeline";
import { CRAFTS, memberRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { InviteSent } from "./InviteLink";
import "./MemberActions.css";

/**
 * The roles column to store: empty when it is just the primary one, so the
 * common case looks exactly like a row from before roles existed.
 */
function storedRoles(primary: string, all: string[]) {
  const unique = [primary, ...all.filter((r) => r !== primary)];
  return unique.length > 1 ? unique : [];
}

export function RoleSelect({
  id,
  role,
  roles,
  locked,
  onChanged,
}: {
  id: string;
  role: string;
  roles?: string[] | null;
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
      // Swaps the primary in place and keeps any other roles they hold. Managers
      // see the whole board, so extra roles mean nothing for them.
      const kept = memberRoles({ role: previous, roles }).filter((r) => r !== previous);
      await updateMember(id, {
        role: next,
        roles: isManager({ id, role: next }) ? [] : storedRoles(next, kept),
      });
      onChanged();
    } catch (e) {
      setValue(previous);
      toast.warn(e instanceof Error ? e.message : "Couldn't change that role.");
    }
    setBusy(false);
  }

  return (
    <Picker
      label="Role"
      clearable={false}
      value={value}
      disabled={busy}
      options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
      onChange={(next) => void change(next)}
      className="role-select"
    />
  );
}

/**
 * The other jobs someone does besides their main role: the editor who also
 * writes and shoots. Each one gets its own page in their sidebar, and they can
 * be picked for that step anywhere a person is assigned.
 */
export function ExtraRoles({
  id,
  name,
  role,
  roles,
  locked,
  onChanged,
}: {
  id: string;
  name: string;
  role: string;
  roles?: string[] | null;
  locked: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Managers already see every video; there is nothing extra to give them.
  if (isManager({ id, role })) return null;

  const extras = memberRoles({ role, roles }).filter((r) => r !== role);
  const label = extras.length
    ? `Also ${extras.map((r) => ROLE_LABELS[r as Role] ?? r).join(", ")}`
    : "Also does…";

  if (locked) {
    return extras.length ? <span className="role-extra role-extra-fixed">{label}</span> : null;
  }

  function show() {
    setPicked(extras);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      await updateMember(id, { roles: storedRoles(role, picked) });
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't save those roles.");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" onClick={show} className="role-extra">
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`What else does ${name.split(" ")[0]} do?`}
        subtitle="Each role gets its own page in their sidebar, with the work assigned for it."
      >
        <div className="role-picks">
          {CRAFTS.map((c) => {
            const primary = c.role === role;
            const on = primary || picked.includes(c.role);
            return (
              <label key={c.role} className={cn("role-pick", primary && "role-pick-fixed")}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={primary || busy}
                  onChange={(e) =>
                    setPicked((prev) =>
                      e.target.checked ? [...prev, c.role] : prev.filter((r) => r !== c.role),
                    )
                  }
                />
                <span>{ROLE_LABELS[c.role as Role]}</span>
                {primary && <span className="role-pick-note">Main role</span>}
              </label>
            );
          })}
        </div>
        <div className="role-picks-foot">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save roles"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/**
 * Emails someone a fresh link to set a password. Used both for someone who
 * hasn't signed in yet and as a password reset — in both cases they choose it
 * themselves from the link, and nobody here ever sees or types it.
 *
 * On success this is a toast and nothing else: the mail has gone, and putting a
 * dialog in the way would only ask the CEO to dismiss something to learn that
 * nothing is required of them. The dialog is kept for the case that does need
 * them — a send that failed and a link that has to be passed on by hand.
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
  const [failure, setFailure] = useState<InviteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function issue() {
    setBusy(true);
    try {
      const result = await sendInvite(id);
      if (result.sent) {
        toast.say(
          pending ? `Invite sent to ${result.email}` : `Reset link sent to ${result.email}`,
        );
      } else {
        setFailure(result);
      }
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't send that.");
    }
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={issue}
        disabled={busy}
        className="row-action row-action-brand"
      >
        {busy ? "Sending…" : pending ? "Send invite" : "Send reset"}
      </button>
      <Modal
        open={Boolean(failure)}
        onClose={() => setFailure(null)}
        title="The email didn't go"
        subtitle="The link is good either way — it just has to reach them another way."
      >
        {failure && <InviteSent name={name} result={failure} />}
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
