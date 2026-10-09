"use client";

import { useState } from "react";
import { Input } from "@/components/ui/field";
import { PRICE_FIELDS, priceLabel, type PriceField } from "@/lib/pricing";

export type PriceAsk = {
  field: PriceField;
  /** The price in force right now, resolved against the client's standard rate. */
  amount: number | null;
  /** True when that number is the client's rate rather than this video's own. */
  inherited: boolean;
};

/**
 * "Does the price need changing?" — asked at a CEO gate, answered by doing
 * nothing most of the time.
 *
 * The checkbox is the whole point. Left alone, no price is submitted and the
 * stored value is untouched, so approving a video never quietly reprices it.
 * Ticked, it reveals the amount prefilled with what is in force, so the common
 * edit is a couple of keystrokes.
 */
export function PriceQuestion({ ask, error }: { ask: PriceAsk; error?: string }) {
  const [changing, setChanging] = useState(false);
  const meta = PRICE_FIELDS[ask.field];

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-stone-700">{meta.label}</p>
        <p className="text-sm font-semibold tabular-nums text-stone-900">
          {priceLabel(ask.amount)}
          {ask.inherited && (
            <span className="ml-1.5 text-xs font-normal text-stone-400">
              client&apos;s rate
            </span>
          )}
        </p>
      </div>

      <label className="mt-2.5 flex items-center gap-2.5">
        {/* name="repriced" is what the action keys off: absent means "leave it". */}
        <input
          type="checkbox"
          name="repriced"
          value="1"
          checked={changing}
          onChange={(e) => setChanging(e.target.checked)}
          className="h-4 w-4 shrink-0 cursor-pointer rounded border-stone-300 text-brand-700 accent-brand-700"
        />
        <span className="text-sm text-stone-600">Change what this {meta.noun} is worth</span>
      </label>

      {changing && (
        <div className="mt-3">
          <Input
            name="price"
            type="text"
            inputMode="numeric"
            autoFocus
            defaultValue={ask.amount === null ? "" : String(ask.amount)}
            placeholder="e.g. 5000 — or blank for no price"
            aria-label={`${meta.label} in rupees`}
          />
          {error ? (
            <p className="mt-1.5 text-xs text-red-600">{error}</p>
          ) : (
            <p className="mt-1.5 text-xs text-stone-400">
              Whole rupees. Applies to this {meta.noun} only, not the client&apos;s rate.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
