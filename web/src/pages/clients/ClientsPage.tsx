import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ClientCard } from "./ClientCard";
import { ClientToolbar } from "./ClientToolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { PageSkeleton } from "@/components/PageSkeleton";
import { IconCheckCircle, IconClock, IconPlus, IconTarget, IconUsers } from "@/components/icons";
import { useViewer } from "@/lib/auth";
import { listClients } from "@/lib/queries";
import { statsForClients } from "@/lib/stats";
import { useAsync } from "@/lib/use-async";
import { currentMonthKey, monthLabel } from "@/lib/utils";
import "./ClientsPage.css";

/**
 * A plain link to /clients/new, not a modal — a full page for a form this
 * size renders the same way every time, with none of an overlay's edge cases
 * (scroll position, backdrop coverage, viewport height) to get wrong.
 */
function NewClientButton({ label = "New client" }: { label?: string }) {
  return (
    <LinkButton to="/clients/new">
      <IconPlus />
      {label}
    </LinkButton>
  );
}

export function ClientsPage() {
  const viewer = useViewer();
  const [params] = useSearchParams();
  const status = params.get("status") ?? "all";
  const urlQuery = params.get("q") ?? "";
  const monthKey = currentMonthKey();

  // Typing filters as you go, so the request is held back a moment rather than
  // fired on every keystroke.
  const [q, setQ] = useState(urlQuery);
  useEffect(() => {
    const t = setTimeout(() => setQ(urlQuery), 250);
    return () => clearTimeout(t);
  }, [urlQuery]);

  const { data, loading, error } = useAsync(async () => {
    // The tab counts always cover every client, whatever the current filter.
    const [all, shown] = await Promise.all([
      listClients(viewer.agencyId),
      listClients(viewer.agencyId, { q, status }),
    ]);

    const stats = await statsForClients(
      shown.map((c) => c.id),
      monthKey,
    );
    return { all, shown, stats };
  }, [viewer.agencyId, q, status, monthKey]);

  if (loading && !data) return <PageSkeleton />;
  if (error) {
    return <EmptyState title="Couldn't load clients" description={error} />;
  }

  const { all = [], shown = [], stats = {} } = data ?? {};

  const counts: Record<string, number> = { all: all.length, active: 0, paused: 0, archived: 0 };
  for (const c of all) counts[c.status] = (counts[c.status] ?? 0) + 1;

  const totalTarget = shown.reduce((sum, c) => sum + c.monthlyTarget, 0);
  const totalPublished = shown.reduce((sum, c) => sum + (stats[c.id]?.published ?? 0), 0);
  const totalInProduction = shown.reduce((sum, c) => sum + (stats[c.id]?.inProduction ?? 0), 0);

  return (
    <div className="stack-8">
      <div className="page-head">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            Every account you produce content for, with {monthLabel(monthKey)} at a glance.
          </p>
        </div>
        <NewClientButton />
      </div>

      <div className="stat-grid">
        <Stat icon={IconUsers} label="Clients" value={counts.all} hint={`${counts.active} active`} />
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
          hint="not published yet"
        />
        <Stat
          icon={IconCheckCircle}
          label="Published"
          value={totalPublished}
          hint={totalTarget ? `${Math.round((totalPublished / totalTarget) * 100)}% of target` : "—"}
        />
      </div>

      <ClientToolbar counts={counts} />

      {shown.length === 0 ? (
        counts.all === 0 ? (
          <EmptyState
            title="No clients yet"
            description="Add your first client and set their monthly content target. Scripts, shoots, edits and posts all hang off this record."
            action={<NewClientButton label="Add your first client" />}
          />
        ) : (
          <EmptyState
            title="Nothing matches that"
            description="Try a different search term, or switch back to the All tab to see every client in the workspace."
          />
        )
      ) : (
        <div className="client-grid">
          {shown.map((client) => (
            <ClientCard key={client.id} client={client} stats={stats[client.id]} />
          ))}
        </div>
      )}
    </div>
  );
}
