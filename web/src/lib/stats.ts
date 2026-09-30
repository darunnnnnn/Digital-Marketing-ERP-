import { supabase } from "./supabase";
import { STAGES, type Stage } from "./pipeline";
import { currentMonthKey } from "./utils";

export { STAGES, STAGE_LABELS } from "./pipeline";
export type { Stage } from "./pipeline";

export type ClientStats = {
  planned: number;
  published: number;
  inProduction: number;
  target: number;
  byStage: Record<Stage, number>;
};

function emptyByStage(): Record<Stage, number> {
  return Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
}

/**
 * Month-to-date content counts for a set of clients, keyed by client id.
 * PostgREST has no groupBy, so the two columns needed are fetched and tallied
 * here — still one round trip, whatever the number of clients.
 */
export async function statsForClients(
  clientIds: string[],
  monthKey = currentMonthKey(),
): Promise<Record<string, ClientStats>> {
  const out: Record<string, ClientStats> = {};
  for (const id of clientIds) {
    out[id] = { planned: 0, published: 0, inProduction: 0, target: 0, byStage: emptyByStage() };
  }
  if (clientIds.length === 0) return out;

  const { data, error } = await supabase
    .from("ContentItem")
    .select("clientId, stage")
    .in("clientId", clientIds)
    .eq("monthKey", monthKey);
  if (error) throw new Error(`Couldn't load client progress: ${error.message}`);

  for (const row of (data ?? []) as { clientId: string; stage: string }[]) {
    const bucket = out[row.clientId];
    if (!bucket) continue;
    bucket.planned++;
    if (STAGES.includes(row.stage as Stage)) bucket.byStage[row.stage as Stage]++;
    if (row.stage === "published") bucket.published++;
    else bucket.inProduction++;
  }

  return out;
}

export async function statsForClient(clientId: string, monthKey = currentMonthKey()) {
  const all = await statsForClients([clientId], monthKey);
  return all[clientId];
}

export function progressPercent(published: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((published / target) * 100));
}
