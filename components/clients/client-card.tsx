import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import type { ClientStats } from "@/lib/stats";
import { progressPercent } from "@/lib/stats";
import { accent, statusStyle } from "@/lib/theme";
import { cn, initials, parseServices } from "@/lib/utils";

export type ClientCardData = {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  accent: string;
  services: string;
  monthlyTarget: number;
};

export function ClientCard({
  client,
  stats,
}: {
  client: ClientCardData;
  stats: ClientStats;
  index?: number;
}) {
  const a = accent();
  const s = statusStyle(client.status);
  const pct = progressPercent(stats.published, client.monthlyTarget);
  const services = parseServices(client.services).slice(0, 3);

  return (
    <Link
      href={`/clients/${client.id}`}
      className="surface flex flex-col p-6 transition-shadow hover:shadow-xl hover:shadow-brand-900/10"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-medium",
            a.avatar,
          )}
        >
          {initials(client.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-stone-900">{client.name}</h3>
          <p className="truncate text-xs text-stone-500">
            {client.industry || "No industry set"}
          </p>
        </div>
        <Badge className={s.className}>{s.label}</Badge>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-stone-500">Published this month</span>
          <span className="tabular-nums text-stone-900">
            <span className="font-medium">{stats.published}</span>
            <span className="text-stone-400"> / {client.monthlyTarget}</span>
          </span>
        </div>
        <ProgressBar value={pct} className="mt-2" />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-stone-100 pt-4">
        {[
          { label: "Planned", value: stats.planned },
          { label: "In production", value: stats.inProduction },
          { label: "Published", value: stats.published },
        ].map((cell) => (
          <div key={cell.label}>
            <dt className="text-[11px] text-stone-400">{cell.label}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums">{cell.value}</dd>
          </div>
        ))}
      </dl>

      {services.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {services.map((svc) => (
            <span
              key={svc}
              className="rounded px-1.5 py-0.5 text-[11px] text-stone-500 ring-1 ring-inset ring-stone-200"
            >
              {svc}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
