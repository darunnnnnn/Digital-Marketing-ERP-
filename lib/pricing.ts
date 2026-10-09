import { formatMoney } from "./utils";

/**
 * What a piece of content is worth.
 *
 * Two prices, both optional, both whole rupees:
 *   scriptPrice — what the client pays for the script
 *   videoPrice  — what the client pays for the finished video
 *
 * A client carries the standard price for each. Every video planned for that
 * client starts at those numbers, and the CEO can then change the price on one
 * video at each of their gates, because the standard rate stops being true the
 * moment a one-hour shoot turns into a three-day one.
 *
 * Nothing here is required. A client with no prices agreed simply has none,
 * and the UI shows "Not priced" rather than a misleading 0.
 */

export type PriceField = "videoPrice" | "scriptPrice";

export const PRICE_FIELDS: Record<PriceField, { label: string; noun: string }> = {
  videoPrice: { label: "Video price", noun: "video" },
  scriptPrice: { label: "Script price", noun: "script" },
};

/** Whole rupees, nothing silly. Kept well above any realistic invoice. */
export const MAX_PRICE = 100_000_000;

/**
 * Reads a price out of a form. Three outcomes, deliberately distinct:
 *   { skip: true }        — leave the stored price exactly as it is
 *   { value: null }       — clear the price
 *   { value: <number> }   — set it
 */
export function parsePrice(raw: string): { value?: number | null; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };

  // Accept what people actually type: "5,000", "₹5000", "5000.00".
  const cleaned = trimmed.replace(/[₹,\s]/g, "");
  const n = Number(cleaned);

  if (!Number.isFinite(n)) return { error: "Enter an amount in rupees, or leave it blank." };
  if (n < 0) return { error: "A price can't be negative." };
  if (n > MAX_PRICE) return { error: "That price looks wrong — check the number." };

  return { value: Math.round(n) };
}

/**
 * The price in force for one video: its own if it has ever been priced,
 * otherwise the client's standard rate. `null` means genuinely unpriced.
 */
export function effectivePrice(
  item: Partial<Record<PriceField, number | null>>,
  client: Partial<Record<PriceField, number | null>> | null,
  field: PriceField,
): { amount: number | null; inherited: boolean } {
  const own = item[field];
  if (own !== null && own !== undefined) return { amount: own, inherited: false };

  const standard = client?.[field];
  if (standard !== null && standard !== undefined && standard > 0) {
    return { amount: standard, inherited: true };
  }
  return { amount: null, inherited: false };
}

/** For display. A deliberate 0 is "Free", an absent price is "Not priced". */
export function priceLabel(amount: number | null) {
  if (amount === null) return "Not priced";
  if (amount === 0) return "Free";
  return formatMoney(amount);
}
