import { Suspense } from "react";
import { ClientCard } from "@/components/clients/client-card";
import { ClientToolbar } from "@/components/clients/client-toolbar";
import { NewClientButton } from "@/components/clients/new-client-button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCheckCircle, IconClock, IconTarget, IconUsers } from "@/components/icons";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { insensitive } from "@/lib/search";
import { statsForClients } from "@/lib/stats";
import { currentMonthKey, monthLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "all" } = await searchParams;
  const { agency } = await requireRole(canManageClients);
  const monthKey = currentMonthKey();

  // Independent of each other — run together instead of one after the other,
  // which matters a lot when every round trip crosses to Tokyo.
  const [grouped, clients] = await Promise.all([
    db.client.groupBy({
      by: ["status"],
      where: { agencyId: agency.id },
      _count: { _all: true },
    }),
    db.client.findMany({
      where: {
        agencyId: agency.id,
        ...(status !== "all" ? { status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, ...insensitive } },
                { industry: { contains: q, ...insensitive } },
                { contactName: { contains: q, ...insensitive } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
  ]);

  const counts: Record<string, number> = { all: 0, active: 0, paused: 0, archived: 0 };
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.all += row._count._all;
  }

  const stats = await statsForClients(
    clients.map((c) => c.id),
    monthKey,
  );

  const totalTarget = clients.reduce((sum, c) => sum + c.monthlyTarget, 0);
  const totalPublished = clients.reduce((sum, c) => sum + (stats[c.id]?.published ?? 0), 0);
  const totalInProduction = clients.reduce(
    (sum, c) => sum + (stats[c.id]?.inProduction ?? 0),
    0,
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl lg:text-4xl">
            Clients
          </h1>
          <p className="mt-1.5 text-sm text-stone-500 sm:mt-2 sm:text-base">
            Every account you produce content for, with {monthLabel(monthKey)} at a glance.
          </p>
        </div>
        <NewClientButton />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          icon={IconUsers}
          label="Clients"
          value={counts.all}
          hint={`${counts.active} active`}
        />
        <Stat
          icon={IconTarget}
          label="Monthly commitment"
          value={totalTarget}
          tone="accent"
          hint="videos promised"
        />
        <Stat
          icon={IconClock}
          label="In production"
          value={totalInProduction}
          tone="slate"
          hint="not published yet"
        />
        <Stat
          icon={IconCheckCircle}
          label="Published"
          value={totalPublished}
          tone="slate"
          hint={
            totalTarget ? `${Math.round((totalPublished / totalTarget) * 100)}% of target` : "—"
          }
        />
      </div>

      <Suspense fallback={null}>
        <ClientToolbar counts={counts} />
      </Suspense>

      {clients.length === 0 ? (
        counts.all === 0 ? (
          <EmptyState
            title="No clients yet"
            description="Add your first client and set their monthly content target. Scripts, shoots, edits and posts will all hang off this record in the next phase."
            action={<NewClientButton label="Add your first client" />}
          />
        ) : (
          <EmptyState
            title="Nothing matches that"
            description="Try a different search term, or switch back to the All tab to see every client in the workspace."
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client, i) => (
            <ClientCard key={client.id} client={client} stats={stats[client.id]} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
