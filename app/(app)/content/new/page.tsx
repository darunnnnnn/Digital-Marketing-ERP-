import Link from "next/link";
import { PlanForm } from "@/components/content/plan-form";
import { IconChevronLeft } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { canPlan } from "@/lib/permissions";
import { currentMonthKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlanContentPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const { agencyId } = await requireRole(canPlan);
  const monthKey = currentMonthKey();

  // All independent — one round trip.
  const [clients, members, planned] = await Promise.all([
    db.client.findMany({
      where: { agencyId, status: { not: "archived" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, accent: true, monthlyTarget: true },
    }),
    db.member.findMany({
      where: { agencyId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, accent: true },
    }),
    // Feeds the "x of y planned this month" hint.
    db.contentItem.groupBy({
      by: ["clientId"],
      where: { agencyId, monthKey },
      _count: { _all: true },
    }),
  ]);

  const plannedMap = new Map(planned.map((r) => [r.clientId, r._count._all]));
  const clientOptions = clients.map((c) => ({ ...c, planned: plannedMap.get(c.id) ?? 0 }));
  const defaultClientId = clientOptions.some((c) => c.id === client) ? client : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/content"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
      >
        <IconChevronLeft className="h-4 w-4" />
        Back to content
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl lg:text-4xl">
          Plan content
        </h1>
        <p className="mt-1.5 text-sm text-stone-500 sm:mt-2 sm:text-base">
          Drop in a week&apos;s worth of ideas at once — one line per video.
        </p>
      </div>

      {clientOptions.length === 0 ? (
        <EmptyState
          title="Add a client first"
          description="Content is always planned against a client. Create one, then come back here."
          action={<LinkButton href="/clients/new">Add a client</LinkButton>}
        />
      ) : (
        <Card className="p-4 sm:p-6">
          <PlanForm
            clients={clientOptions}
            members={members}
            defaultClientId={defaultClientId}
          />
        </Card>
      )}
    </div>
  );
}
