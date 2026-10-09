"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { approveOne, type PayFormState } from "@/app/(app)/payouts/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { payTypeLabel } from "@/lib/pay-rules";
import { formatMoney } from "@/lib/utils";

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

function Submit({ total }: { total: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Approving…" : `Approve ${formatMoney(total)}`}
    </Button>
  );
}

function ApproveForm({ row, month, onDone }: { row: Row; month: string; onDone: () => void }) {
  const [state, action] = useActionState<PayFormState, FormData>(approveOne, {});
  const [adjustment, setAdjustment] = useState("");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const adj = Number(adjustment) || 0;
  const total = row.taskPay + row.base + adj;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="memberId" value={row.memberId} />
      <input type="hidden" name="month" value={month} />

      <dl className="divide-y divide-stone-200/70 rounded-2xl bg-stone-50 px-4 text-sm">
        <div className="flex justify-between py-3">
          <dt className="text-stone-500">Pay type</dt>
          <dd className="font-medium text-stone-900">{payTypeLabel(row.payType)}</dd>
        </div>
        {(row.payType === "per_task" || row.payType === "hybrid") && (
          <div className="flex justify-between py-3">
            <dt className="text-stone-500">
              {row.deliveries} deliveries × {formatMoney(row.rate)}
            </dt>
            <dd className="font-medium tabular-nums text-stone-900">
              {formatMoney(row.taskPay)}
            </dd>
          </div>
        )}
        {(row.payType === "salary" || row.payType === "hybrid") && (
          <div className="flex justify-between py-3">
            <dt className="text-stone-500">Monthly salary</dt>
            <dd className="font-medium tabular-nums text-stone-900">{formatMoney(row.base)}</dd>
          </div>
        )}
        {adj !== 0 && (
          <div className="flex justify-between py-3">
            <dt className="text-stone-500">{adj > 0 ? "Bonus" : "Deduction"}</dt>
            <dd className={adj > 0 ? "font-medium text-brand-700" : "font-medium text-red-600"}>
              {adj > 0 ? "+" : "−"}
              {formatMoney(Math.abs(adj))}
            </dd>
          </div>
        )}
        <div className="flex justify-between py-3 text-base">
          <dt className="font-semibold text-stone-900">Total</dt>
          <dd className="font-semibold tabular-nums text-stone-900">{formatMoney(total)}</dd>
        </div>
      </dl>

      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Field label="Adjustment" hint="₹, optional">
          <Input
            name="adjustment"
            type="number"
            step={100}
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="e.g. 1000 or -500"
          />
        </Field>
        <Field label="Reason" hint={adj !== 0 ? "required" : "optional"}>
          <Input name="note" placeholder="Festival bonus, missed shoot…" />
        </Field>
      </div>

      <p className="text-xs text-stone-500">
        Approving locks these numbers. You can reopen an approval until it&apos;s marked paid.
      </p>

      {state.error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Submit total={total} />
      </div>
    </form>
  );
}

export function ApproveButton({ row, month }: { row: Row; month: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Approve
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Approve pay · ${row.name}`}>
        {open && <ApproveForm row={row} month={month} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
