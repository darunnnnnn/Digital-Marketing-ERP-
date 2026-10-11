import { useState } from "react";
import { Input } from "@/components/ui/Field";
import { PRICE_FIELDS, priceLabel, type PriceField } from "@/lib/pricing";
import "./PriceQuestion.css";

export type PriceAsk = {
  field: PriceField;
  /** The price in force right now, resolved against the client's standard rate. */
  amount: number | null;
  /** True when that number is the client's rate rather than this video's own. */
  inherited: boolean;
};

/**
 * "Does the price need changing?" — asked inside a CEO gate, answered by
 * doing nothing most of the time.
 *
 * The checkbox is the whole point. Left alone, the gate's write never touches
 * the stored price, so approving a video never quietly reprices it. Ticked, it
 * reveals the amount prefilled with what is in force, so the common edit is a
 * couple of keystrokes.
 */
export function PriceQuestion({
  ask,
  value,
  onChange,
  error,
}: {
  ask: PriceAsk;
  /** Undefined means "not changing it" — the caller must not send a price then. */
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  error?: string;
}) {
  const [changing, setChanging] = useState(value !== undefined);
  const meta = PRICE_FIELDS[ask.field];

  function toggle(next: boolean) {
    setChanging(next);
    onChange(next ? (ask.amount === null ? "" : String(ask.amount)) : undefined);
  }

  return (
    <div className="price-question">
      <div className="price-question-row">
        <p className="price-question-label">{meta.label}</p>
        <p className="price-question-amount">
          {priceLabel(ask.amount)}
          {ask.inherited && <span className="price-question-inherited">client&apos;s rate</span>}
        </p>
      </div>

      <label className="price-question-toggle">
        <input
          type="checkbox"
          checked={changing}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>Change what this {meta.noun} is worth</span>
      </label>

      {changing && (
        <div className="price-question-input">
          <Input
            type="text"
            inputMode="numeric"
            autoFocus
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. 5000 — or blank for no price"
            aria-label={`${meta.label} in rupees`}
          />
          {error ? (
            <p className="price-question-error">{error}</p>
          ) : (
            <p className="price-question-hint">
              Whole rupees. Applies to this {meta.noun} only, not the client&apos;s rate.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
