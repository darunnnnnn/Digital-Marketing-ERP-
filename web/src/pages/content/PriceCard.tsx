import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { setContentPrice } from "@/lib/queries";
import { parsePrice, PRICE_FIELDS, priceLabel, type PriceField } from "@/lib/pricing";
import type { ContentItem } from "@/lib/types";
import type { PriceAsk } from "./PriceQuestion";
import "./PriceCard.css";

function PriceRow({
  item,
  ask,
  editable,
  actor,
  onChanged,
}: {
  item: ContentItem;
  ask: PriceAsk;
  editable: boolean;
  actor?: string;
  onChanged?: () => void;
}) {
  const meta = PRICE_FIELDS[ask.field];
  const [value, setValue] = useState(ask.amount === null ? "" : String(ask.amount));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (!editable) {
    return (
      <div className="price-row">
        <p className="price-row-label">{meta.label}</p>
        <p className="price-row-amount">{priceLabel(ask.amount)}</p>
      </div>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parsePrice(value);
    if (parsed.error) return setError(parsed.error);
    setError(null);
    setBusy(true);
    try {
      await setContentPrice(item, ask.field, parsed.value ?? null, actor);
      onChanged?.();
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't save that price.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="price-row price-row-editable">
      <div className="price-row-head">
        <label className="price-row-label">{meta.label}</label>
        {ask.inherited && <span className="price-row-inherited">client&apos;s rate</span>}
      </div>
      <div className="price-row-controls">
        <Input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Not priced"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && <p className="price-row-error">{error}</p>}
    </form>
  );
}

/**
 * What this one video is worth, on the video's own page.
 *
 * The CEO is prompted about the price at the script and approval gates, but
 * should not have to wait for a gate to correct a number — so the same two
 * prices are editable here. A blank field clears the price and the video
 * falls back to the client's standard rate.
 */
export function PriceCard({
  item,
  asks,
  editable,
  actor,
  onChanged,
}: {
  item: ContentItem;
  asks: PriceAsk[];
  editable: boolean;
  actor?: string;
  onChanged?: () => void;
}) {
  return (
    <div className="price-card">
      {asks.map((ask) => (
        <PriceRow
          key={ask.field}
          item={item}
          ask={ask}
          editable={editable}
          actor={actor}
          onChanged={onChanged}
        />
      ))}
      <p className="price-card-hint">
        {editable
          ? "Applies to this video only. Clear a field to fall back to the client's rate."
          : "Set by the CEO against this video."}
      </p>
    </div>
  );
}

export type { PriceField };
