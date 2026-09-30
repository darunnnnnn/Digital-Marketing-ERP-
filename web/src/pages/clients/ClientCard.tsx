import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import type { ClientStats } from "@/lib/stats";
import { progressPercent } from "@/lib/stats";
import { accent, statusStyle } from "@/lib/theme";
import { initials, parseServices } from "@/lib/utils";
import "./ClientCard.css";

export type ClientCardData = {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  accent: string;
  services: string;
  monthlyTarget: number;
};

export function ClientCard({ client, stats }: { client: ClientCardData; stats: ClientStats }) {
  const a = accent();
  const s = statusStyle(client.status);
  const pct = progressPercent(stats.published, client.monthlyTarget);
  const services = parseServices(client.services).slice(0, 3);

  return (
    <Link to={`/clients/${client.id}`} className="client-card">
      <div className="client-card-top">
        <span className={a.avatar}>{initials(client.name)}</span>
        <div className="client-card-id">
          <h3 className="client-card-name truncate">{client.name}</h3>
          <p className="client-card-industry truncate">{client.industry || "No industry set"}</p>
        </div>
        <Badge className={s.className}>{s.label}</Badge>
      </div>

      <div className="client-card-progress">
        <div className="client-card-progress-row">
          <span className="muted">Published this month</span>
          <span className="tabular">
            <strong>{stats.published}</strong>
            <span className="client-card-of"> / {client.monthlyTarget}</span>
          </span>
        </div>
        <ProgressBar value={pct} className="client-card-bar" />
      </div>

      <dl className="client-card-cells">
        {[
          { label: "Planned", value: stats.planned },
          { label: "In production", value: stats.inProduction },
          { label: "Published", value: stats.published },
        ].map((cell) => (
          <div key={cell.label}>
            <dt className="client-card-cell-label">{cell.label}</dt>
            <dd className="client-card-cell-value tabular">{cell.value}</dd>
          </div>
        ))}
      </dl>

      {services.length > 0 && (
        <div className="client-card-services">
          {services.map((svc) => (
            <span key={svc} className="tag">
              {svc}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
