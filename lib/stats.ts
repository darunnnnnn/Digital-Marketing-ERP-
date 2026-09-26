import { db } from "./db";
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

/** Month-to-date content counts for a set of clients, keyed by client id. */
export async function statsForClients(
  clientIds: string[],
  monthKey = currentMonthKey(),
): Promise<Record<string, ClientStats>> {
  const out: Record<string, ClientStats> = {};
  for (const id of clientIds) {
    out[id] = { planned: 0, published: 0, inProduction: 0, target: 0, byStage: emptyByStage() };
  }
  if (clientIds.length === 0) return out;

  const rows = await db.contentItem.groupBy({
    by: ["clientId", "stage"],
    where: { clientId: { in: clientIds }, monthKey },
    _count: { _all: true },
  });

  for (const row of rows) {
    const bucket = out[row.clientId];
    if (!bucket) continue;
    const count = row._count._all;
    bucket.planned += count;
    if (STAGES.includes(row.stage as Stage)) bucket.byStage[row.stage as Stage] = count;
    if (row.stage === "published") bucket.published += count;
    else bucket.inProduction += count;
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
