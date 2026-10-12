import { useState } from "react";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Picker } from "@/components/ui/Picker";
import { Modal } from "@/components/ui/Modal";
import { useViewer } from "@/lib/auth";
import { sendInvite, type InviteResult } from "@/lib/invites";
import { createMember } from "@/lib/queries";
import { ROLES, ROLE_LABELS } from "@/lib/pipeline";
import { InviteSent } from "./InviteLink";

function InviteForm({ onDone }: { onDone: () => void }) {
  const viewer = useViewer();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = "Name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      found.email = "That doesn't look like a valid email.";
    }
    if (!ROLES.includes(role as never)) found.role = "Pick a role.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const result = await createMember({
      agencyId: viewer.agencyId,
      name: name.trim(),
      email: email.trim(),
      role,
    });

    if ("error" in result) {
      setErrors({ email: result.error });
      setBusy(false);
      return;
    }

    try {
      setResult(await sendInvite(result.member.id));
    } catch (e) {
      // The person exists either way; it is only their link that didn't go.
      // Say so on the email field, which is the thing that would be wrong.
      setErrors({ email: e instanceof Error ? e.message : "Couldn't send the invite." });
    }
    setBusy(false);
  }

  if (result) {
    return (
      <div className="stack-5">
        <InviteSent name={name} result={result} />
        <div className="modal-actions">
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="stack-5">
      <div className="panel-pair">
        <Field label="Name" error={errors.name}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Joel Thomas"
            autoFocus
          />
        </Field>
        <Field label="Email" error={errors.email} hint="they'll sign in with this">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="joel@agency.com"
          />
        </Field>
      </div>
      <Field label="Role" error={errors.role}>
        <Picker
          label="Role"
          clearable={false}
          value={role}
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          onChange={setRole}
        />
      </Field>
      <div className="modal-actions">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}

export function InviteButton({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus />
        Invite member
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a team member"
        subtitle="We'll email them a link to set their own password."
      >
        {open && (
          <InviteForm
            onDone={() => {
              setOpen(false);
              onInvited();
            }}
          />
        )}
      </Modal>
    </>
  );
}
