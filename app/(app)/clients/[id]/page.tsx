import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import {
  IconChevronLeft,
  IconFilm,
  IconMail,
  IconPencil,
  IconPhone,
  IconUser,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { refLabel, stageConfig } from "@/lib/pipeline";
import { STAGES, STAGE_LABELS, progressPercent, statsForClient } from "@/lib/stats";
import { accent, statusStyle } from "@/lib/theme";
import {
  cn,
  currentMonthKey,
  formatMoney,
  initials,
  monthLabel,
  parseServices,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { agency } = await requireRole(canManageClients);
  const client = await db.client.findFirst({ where: { id, agencyId: agency.id } });

  if (!client) notFound();

  const monthKey = currentMonthKey();
  const stats = await statsForClient(client.id, monthKey);
  const recent = await db.contentItem.findMany({
    where: { clientId: client.id, monthKey },
    orderBy: [{ updatedAt: "desc" }],
    take: 8,
    select: { id: true, ref: true, title: true, stage: true },
  });

  const a = accent(client.accent);
  const s = statusStyle(client.status);
  const pct = progressPercent(stats.published, client.monthlyTarget);
  const remaining = Math.max(0, client.monthlyTarget - stats.published);
  const services = parseServices(client.services);

  const contacts = [
    { icon: IconUser, value: client.contactName },
    { icon: IconMail, value: client.contactEmail },
    { icon: IconPhone, value: client.contactPhone },
  ].filter((c) => c.value);

  return (
    <div className="space-y-8">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
      >
        <IconChevronLeft className="h-4 w-4" />
        All clients
      </Link>

      {/* Header */}
      <div className="surface flex flex-col gap-5 p-7 lg:flex-row lg:items-center">
        <span
          className={cn(
            "grid h-16 w-16 shrink-0 place-items-center rounded-xl text-xl font-semibold  ",
            a.avatar,
          )}
        >
          {initials(client.name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
              {client.name}
            </h1>
            <Badge className={s.className}>{s.label}</Badge>
          </div>
          <p className="mt-0.5 text-sm font-medium text-stone-500">
            {client.industry || "No industry set"}
            {client.retainer > 0 && (
              <>
                {" · "}
                <span className="font-medium text-stone-700">
                  {formatMoney(client.retainer)}
                </span>
                /month
              </>
            )}
          </p>
          {services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {services.map((svc) => (
                <span
                  key={svc}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-medium",
                    a.soft,
                    a.text,
                  )}
                >
                  {svc}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <LinkButton href={`/content?client=${client.id}`} size="sm">
            <IconFilm className="h-4 w-4" />
            Pipeline
          </LinkButton>
          <LinkButton href={`/clients/${client.id}/edit`} variant="secondary" size="sm">
            <IconPencil className="h-4 w-4" />
            Edit
          </LinkButton>
          <DeleteClientButton id={client.id} name={client.name} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Month progress */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={`${monthLabel(monthKey)} progress`}
            action={
              <span className="text-xs font-medium text-stone-400">
                {remaining > 0 ? `${remaining} to go` : "Target met"}
              </span>
            }
          />
          <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
            <ProgressRing value={pct} label={`${pct}%`} sublabel="published" />

            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">Published against target</span>
                  <span className="font-semibold tabular-nums">
                    {stats.published} / {client.monthlyTarget}
                  </span>
                </div>
                <ProgressBar value={pct} barClass={a.bar} className="mt-2" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Stat label="Planned" value={stats.planned} />
                <Stat label="In production" value={stats.inProduction} tone="slate" />
                <Stat label="Published" value={stats.published} tone="slate" />
              </div>
            </div>
          </div>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader title="Point of contact" />
          <div className="space-y-3 p-5">
            {contacts.length === 0 ? (
              <p className="text-sm text-stone-400">
                No contact saved yet. Add one from the Edit screen.
              </p>
            ) : (
              contacts.map((c, i) => {
                const Icon = c.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-semibold">{c.value}</span>
                  </div>
                );
              })
            )}

            {client.notes && (
              <div className="mt-4 rounded-xl bg-stone-50 p-3.5">
                <p className="text-[11px] font-medium text-stone-400">Notes</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
                  {client.notes}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Pipeline snapshot */}
      <Card>
        <CardHeader title="Pipeline this month" />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 lg:grid-cols-7">
          {STAGES.map((stage) => {
            const count = stats.byStage[stage];
            return (
              <div
                key={stage}
                className={cn(
                  "rounded-xl border px-3 py-3 text-center transition-colors",
                  count > 0 ? "border-stone-200 bg-stone-50" : "border-dashed border-stone-200",
                )}
              >
                <p
                  className={cn(
                    "text-xl font-semibold tabular-nums",
                    count > 0 ? a.text : "text-stone-300",
                  )}
                >
                  {count}
                </p>
                <p className="mt-0.5 text-[11px] font-medium uppercase leading-tight tracking-wide text-stone-400">
                  {STAGE_LABELS[stage]}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent content */}
      <Card>
        <CardHeader
          title="Recent content"
          action={
            <Link
              href={`/content?client=${client.id}`}
              className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-500"
            >
              Open pipeline
            </Link>
          }
        />
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-stone-400">
            Nothing planned for {monthLabel(monthKey)} yet.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/content/${item.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-stone-100"
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", a.dot)} />
                  <span className="shrink-0 font-mono text-[11px] font-medium text-stone-300">
                    {refLabel(item.ref)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {item.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
                      stageConfig(item.stage).chip,
                    )}
                  >
                    {STAGE_LABELS[item.stage as keyof typeof STAGE_LABELS] ?? item.stage}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
