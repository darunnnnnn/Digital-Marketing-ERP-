import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PAY_TYPES, payTypeLabel } from "@/lib/pay-rules";
import { approvePayout, savePaySettings } from "@/lib/payouts";
import { useViewer } from "@/lib/auth";
import { cn, formatMoney } from "@/lib/utils";
import "./PayoutDialogs.css";

type Row = {
  memberId: string;
  name: string;
  payType: string;
  deliveries: number;
  rate: number;
  salary: number;
  taskPay: number;
  base: number;
};

function ApproveForm({
  row,
  month,
  onDone,
}: {
  row: Row;
  month: string;
  onDone: (saved: boolean) => void;
}) {
  const viewer = useViewer();
  const [adjustment, setAdjustment] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const adj = Number(adjustment) || 0;
  const total = row.taskPay + row.base + adj;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (adj !== 0 && !note.trim()) return setError("Say why you're adjusting this.");

    setBusy(true);
    const ok = await approvePayout({
      agencyId: viewer.agencyId,
      memberId: row.memberId,
      monthKey: month,
      adjustment: adj,
      note: note.trim() || null,
      approvedBy: viewer.name,
    });
    setBusy(false);

    if (!ok) return setError("Couldn't approve this — it may already be approved.");
    onDone(true);
  }

  return (
    <form onSubmit={submit} className="stack-5">
      <dl className="breakdown">
        <div className="breakdown-row">
          <dt className="muted">Pay type</dt>
          <dd className="breakdown-value">{payTypeLabel(row.payType)}</dd>
        </div>
        {(row.payType === "per_task" || row.payType === "hybrid") && (
          <div className="breakdown-row">
            <dt className="muted">
              {row.deliveries} deliveries × {formatMoney(row.rate)}
            </dt>
            <dd className="breakdown-value tabular">{formatMoney(row.taskPay)}</dd>
          </div>
        )}
        {(row.payType === "salary" || row.payType === "hybrid") && (
          <div className="breakdown-row">
            <dt className="muted">Monthly salary</dt>
            <dd className="breakdown-value tabular">{formatMoney(row.base)}</dd>
          </div>
        )}
        {adj !== 0 && (
          <div className="breakdown-row">
            <dt className="muted">{adj > 0 ? "Bonus" : "Deduction"}</dt>
            <dd className={adj > 0 ? "breakdown-up" : "breakdown-down"}>
              {adj > 0 ? "+" : "−"}
              {formatMoney(Math.abs(adj))}
            </dd>
          </div>
        )}
        <div className="breakdown-row breakdown-total">
          <dt>Total</dt>
          <dd className="tabular">{formatMoney(total)}</dd>
        </div>
      </dl>

      <div className="adjust-grid">
        <Field label="Adjustment" hint="₹, optional">
          <Input
            type="number"
            step={100}
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="e.g. 1000 or -500"
          />
        </Field>
        <Field label="Reason" hint={adj !== 0 ? "required" : "optional"}>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Festival bonus, missed shoot…"
          />
        </Field>
      </div>

      <p className="dialog-note">
        Approving locks these numbers. You can reopen an approval until it&apos;s marked paid.
      </p>

      {error && <p className="auth-alert">{error}</p>}

      <div className="modal-actions">
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Approving…" : `Approve ${formatMoney(total)}`}
        </Button>
      </div>
    </form>
  );
}

export function ApproveButton({
  row,
  month,
  onApproved,
}: {
  row: Row;
  month: string;
  onApproved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Approve
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Approve pay · ${row.name}`}>
        {open && (
          <ApproveForm
            row={row}
            month={month}
            onDone={(saved) => {
              setOpen(false);
              if (saved) onApproved();
            }}
          />
        )}
      </Modal>
    </>
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
  onDone: (saved: boolean) => void;
}) {
  const viewer = useViewer();
  const [type, setType] = useState(payType);
  const [rateValue, setRateValue] = useState(String(rate));
  const [salaryValue, setSalaryValue] = useState(String(salary));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usesRate = type === "per_task" || type === "hybrid";
  const usesSalary = type === "salary" || type === "hybrid";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const message = await savePaySettings(viewer.agencyId, memberId, {
      payType: type,
      rate: Math.round(Number(rateValue) || 0),
      salary: Math.round(Number(salaryValue) || 0),
    });
    setBusy(false);
    if (message) return setError(message);
    onDone(true);
  }

  return (
    <form onSubmit={submit} className="stack-5">
      <div className="paytypes">
        {PAY_TYPES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setType(p.key)}
            className={cn("paytype", type === p.key && "paytype-on")}
          >
            <span className="paytype-label">{p.label}</span>
            <span className="paytype-hint">{p.hint}</span>
          </button>
        ))}
      </div>

      <div className="panel-pair">
        <Field label="Rate per delivery" hint="₹">
          <Input
            type="number"
            min={0}
            step={50}
            value={rateValue}
            onChange={(e) => setRateValue(e.target.value)}
            disabled={!usesRate}
          />
        </Field>
        <Field label="Monthly salary" hint="₹">
          <Input
            type="number"
            min={0}
            step={500}
            value={salaryValue}
            onChange={(e) => setSalaryValue(e.target.value)}
            disabled={!usesSalary}
          />
        </Field>
      </div>

      <p className="dialog-note">
        Applies to months that haven&apos;t been approved yet. Approved months keep the rates they
        were approved with.
      </p>

      {error && <p className="auth-alert">{error}</p>}

      <div className="modal-actions">
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save pay settings"}
        </Button>
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
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { onSaved, ...row } = props;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="row-action row-action-quiet">
        Pay settings
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Pay settings · ${props.name}`}>
        {open && (
          <SettingsForm
            {...row}
            onDone={(saved) => {
              setOpen(false);
              if (saved) onSaved();
            }}
          />
        )}
      </Modal>
    </>
  );
}
