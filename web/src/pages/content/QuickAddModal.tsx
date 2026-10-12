import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Picker } from "@/components/ui/Picker";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useViewer } from "@/lib/auth";
import { craftByAssign, hasRole } from "@/lib/roles";
import { stageConfig, type Stage } from "@/lib/pipeline";
import { PRICE_FIELDS, parsePrice, type PriceField } from "@/lib/pricing";
import { quickAddContent } from "@/lib/queries";
import type { MemberOption, QuickAddClient } from "./types";
import "./QuickAddModal.css";

/** Which rate this stage's work is paid against — the same one the hand-off
 *  gate for it would offer to change. Posting has no price of its own. */
const PRICE_BY_CRAFT: Partial<Record<string, PriceField>> = {
  scriptwriter: "scriptPrice",
  cameraman: "shootPrice",
  editor: "editPrice",
};

/**
 * Drops one video straight onto a stage, instead of walking it through the
 * ones before — a script a client sent over, footage shot outside the app,
 * anything that should land directly on the person doing that part. Opened
 * from the "+" on a board column.
 */
export function QuickAddModal({
  stage,
  clients,
  members,
  defaultClientId,
  onClose,
  onAdded,
}: {
  stage: Stage;
  clients: QuickAddClient[];
  members: MemberOption[];
  defaultClientId?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const viewer = useViewer();
  const toast = useToast();
  const config = stageConfig(stage);
  const craft = config.assign ? craftByAssign(config.assign) : null;
  const priceField = craft ? PRICE_BY_CRAFT[craft.role] : undefined;

  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const assignees = craft ? members.filter((m) => hasRole(m, craft.role)) : [];
  const client = clients.find((c) => c.id === clientId);
  const clientRate = priceField ? client?.[priceField] : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!clientId) found.clientId = "Pick a client.";
    if (!title.trim()) found.title = "Give it a title.";
    if (craft && !assigneeId) found.assigneeId = `Pick a ${craft.role === "cameraman" ? "cameraman" : craft.role}.`;
    if (referenceUrl.trim() && !/^https?:\/\//i.test(referenceUrl.trim())) {
      found.referenceUrl = "Links need to start with http:// or https://";
    }
    const parsedPrice = parsePrice(price);
    if (parsedPrice.error) found.price = parsedPrice.error;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await quickAddContent({
        agencyId: viewer.agencyId,
        clientId,
        clientName: client?.name ?? "this client",
        title: title.trim(),
        stage,
        assigneeId: assigneeId || undefined,
        dueDate,
        priority,
        referenceUrl,
        actor: viewer.name,
        clientScriptPrice: client?.scriptPrice ?? 0,
        clientShootPrice: client?.shootPrice ?? 0,
        clientEditPrice: client?.editPrice ?? 0,
        priceField,
        price: parsedPrice.value,
      });
      toast.say(`Added straight to ${config.label}.`);
      onAdded();
      onClose();
    } catch (err) {
      toast.warn(err instanceof Error ? err.message : "Couldn't add that.");
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add to ${config.label}`}
      subtitle={
        craft
          ? `Skips straight past the steps before it, assigned to a ${craft.role === "cameraman" ? "cameraman" : craft.role} now.`
          : "Skips straight past the steps before it."
      }
    >
      <form onSubmit={onSubmit} className="stack-5">
        <Field label="Client" error={errors.clientId}>
          <Picker
            label="Client"
            clearable={false}
            placeholder={clients.length === 0 ? "No clients yet" : "Choose a client…"}
            value={clientId}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            onChange={setClientId}
          />
        </Field>

        <Field label="Title" error={errors.title}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this video?"
            autoFocus
          />
        </Field>

        {craft && (
          <Field label={craft.role === "cameraman" ? "Cameraman" : craft.label} error={errors.assigneeId}>
            <Picker
              label="Assign to"
              placeholder="Choose who picks this up"
              value={assigneeId}
              options={assignees.map((m) => ({ value: m.id, label: m.name }))}
              onChange={setAssigneeId}
            />
          </Field>
        )}

        <Field
          label="Reference link"
          hint="optional — an example to work from"
          error={errors.referenceUrl}
        >
          <Input
            type="url"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            placeholder="https://instagram.com/reel/…"
          />
        </Field>

        <div className="quick-add-grid">
          <Field label="Due" hint="optional">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Priority">
            <Picker
              label="Priority"
              clearable={false}
              value={priority}
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
              ]}
              onChange={setPriority}
            />
          </Field>
        </div>

        {priceField && (
          <Field
            label={PRICE_FIELDS[priceField].label}
            hint={
              clientRate
                ? `optional — client rate is ₹${clientRate.toLocaleString("en-IN")}`
                : "optional — no client rate set"
            }
            error={errors.price}
          >
            <Input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={clientRate ? String(clientRate) : "0"}
            />
          </Field>
        )}

        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || clients.length === 0}>
            {busy ? "Adding…" : `Add to ${config.short}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
