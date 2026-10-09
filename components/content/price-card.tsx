"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setPrice, type ContentFormState } from "@/app/(app)/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PRICE_FIELDS, priceLabel } from "@/lib/pricing";
import type { PriceAsk } from "./price-question";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

function PriceRow({ id, ask, editable }: { id: string; ask: PriceAsk; editable: boolean }) {
  const [state, action] = useActionState<ContentFormState, FormData>(setPrice, {});
  const meta = PRICE_FIELDS[ask.field];
  const err = state.errors?.price;

  if (!editable) {
    return (
      <div className="flex items-baseline justify-between gap-3 px-2.5 py-2">
        <p className="text-sm text-stone-500">{meta.label}</p>
        <p className="text-sm font-semibold tabular-nums text-stone-900">
          {priceLabel(ask.amount)}
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="rounded-xl px-2.5 py-2 transition-colors hover:bg-stone-50"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={ask.field} />

      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm text-stone-500" htmlFor={`${ask.field}-${id}`}>
          {meta.label}
        </label>
        {ask.inherited && (
          <span className="text-[11px] text-stone-400">client&apos;s rate</span>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <Input
          id={`${ask.field}-${id}`}
          name="price"
          type="text"
          inputMode="numeric"
          defaultValue={ask.amount === null ? "" : String(ask.amount)}
          placeholder="Not priced"
          className="py-2"
        />
        <SaveButton />
      </div>

      {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
    </form>
  );
}

/**
 * What this one video is worth, on the video's own page.
 *
 * The CEO is prompted about the price at each of their gates, but they should
 * not have to wait for a gate to correct a number — so the same two prices are
 * editable here. A blank field clears the price and the video falls back to the
 * client's standard rate.
 */
export function PriceCard({
  id,
  asks,
  editable,
}: {
  id: string;
  asks: PriceAsk[];
  editable: boolean;
}) {
  return (
    <div className="space-y-0.5 p-3">
      {asks.map((ask) => (
        <PriceRow key={ask.field} id={id} ask={ask} editable={editable} />
      ))}
      <p className="px-2.5 pt-1.5 text-[11px] leading-relaxed text-stone-400">
        {editable
          ? "Applies to this video only. Clear a field to fall back to the client's rate."
          : "Set by the CEO against this video."}
      </p>
    </div>
  );
}
