import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  IconChevronLeft,
  IconFilm,
  IconMail,
  IconPencil,
  IconPhone,
  IconTrash,
  IconUser,
} from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar, ProgressRing } from "@/components/ui/Progress";
import { Stat } from "@/components/ui/Stat";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useToast } from "@/components/ui/Toast";
import { deleteClient, getClient } from "@/lib/queries";
import { refLabel, stageConfig } from "@/lib/pipeline";
import { STAGES, STAGE_LABELS, progressPercent, statsForClient } from "@/lib/stats";
import { accent, statusStyle } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { useAsync } from "@/lib/use-async";
import {
  cn,
  currentMonthKey,
  formatMoney,
  initials,
  monthLabel,
  parseServices,
} from "@/lib/utils";
import "./ClientDetailPage.css";

function DeleteClientButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function remove() {
    setBusy(true);
    try {
      await deleteClient(id);
      toast.say(`${name} deleted.`);
      navigate("/clients");
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't delete that client.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <IconTrash />
        Delete
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Delete ${name}?`}>
        <p className="prose-sm">
          This removes the client and every content record attached to them. It cannot be undone.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Keep client
          </Button>
          <Button type="button" variant="danger" onClick={remove} disabled={busy}>
            {busy ? "Deleting…" : "Yes, delete"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function ClientDetailPage() {
  const { id = "" } = useParams();
  const monthKey = currentMonthKey();

  const { data, loading } = useAsync(async () => {
    const client = await getClient(id);
    if (!client) return { client: null };

    // Independent of each other — one round trip instead of two.
    const [stats, recent] = await Promise.all([
      statsForClient(client.id, monthKey),
      supabase
        .from("ContentItem")
        .select("id, ref, title, stage")
        .eq("clientId", client.id)
        .eq("monthKey", monthKey)
        .order("updatedAt", { ascending: false })
        .limit(8),
    ]);

    return {
      client,
      stats,
      recent: (recent.data ?? []) as { id: string; ref: number; title: string; stage: string }[],
    };
  }, [id, monthKey]);

  if (loading && !data) return <PageSkeleton />;

  const client = data?.client;
  if (!client) {
    return (
      <EmptyState
        title="Client not found"
        description="This client may have been deleted, or belongs to another agency."
        action={
          <LinkButton to="/clients" size="sm" variant="secondary">
            All clients
          </LinkButton>
        }
      />
    );
  }

  const stats = data!.stats!;
  const recent = data!.recent!;

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
    <div className="stack-8">
      <Link to="/clients" className="back-link">
        <IconChevronLeft />
        All clients
      </Link>

      {/* Header */}
      <div className="card detail-head">
        <span className={cn(a.avatar, "detail-avatar")}>{initials(client.name)}</span>

        <div className="detail-head-main">
          <div className="detail-title-row">
            <h1 className="page-title">{client.name}</h1>
            <Badge className={s.className}>{s.label}</Badge>
          </div>
          <p className="detail-meta">
            {client.industry || "No industry set"}
            {client.retainer > 0 && (
              <>
                {" · "}
                <span className="detail-meta-strong">{formatMoney(client.retainer)}</span>/month
              </>
            )}
            {client.monthlyPostTarget > 0 && (
              <>
                {" · "}
                <span className="detail-meta-strong">{client.monthlyPostTarget}</span> posts/month
              </>
            )}
          </p>
          {services.length > 0 && (
            <div className="detail-services">
              {services.map((svc) => (
                <span key={svc} className={cn("service-tag", a.soft, a.text)}>
                  {svc}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="detail-actions">
          <LinkButton to={`/content?client=${client.id}`} size="sm">
            <IconFilm />
            Pipeline
          </LinkButton>
          <LinkButton to={`/clients/${client.id}/edit`} variant="secondary" size="sm">
            <IconPencil />
            Edit
          </LinkButton>
          <DeleteClientButton id={client.id} name={client.name} />
        </div>
      </div>

      <div className="detail-columns">
        {/* Month progress */}
        <Card className="detail-wide">
          <CardHeader
            title={`${monthLabel(monthKey)} progress`}
            action={
              <span className="detail-note">{remaining > 0 ? `${remaining} to go` : "Target met"}</span>
            }
          />
          <div className="detail-progress">
            <ProgressRing value={pct} label={`${pct}%`} sublabel="published" />

            <div className="detail-progress-main stack-4">
              <div>
                <div className="detail-progress-row">
                  <span className="detail-progress-label">Published against target</span>
                  <span className="detail-progress-value tabular">
                    {stats.published} / {client.monthlyTarget}
                  </span>
                </div>
                <ProgressBar value={pct} color={a.bar} className="detail-progress-bar" />
              </div>

              <div className="detail-three">
                <Stat label="Planned" value={stats.planned} />
                <Stat label="In production" value={stats.inProduction} />
                <Stat label="Published" value={stats.published} />
              </div>
            </div>
          </div>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader title="Point of contact" />
          <div className="detail-contacts stack-3">
            {contacts.length === 0 ? (
              <p className="detail-empty">No contact saved yet. Add one from the Edit screen.</p>
            ) : (
              contacts.map((c, i) => {
                const Icon = c.icon;
                return (
                  <div key={i} className="detail-contact">
                    <span className="detail-contact-icon">
                      <Icon />
                    </span>
                    <span className="detail-contact-value truncate">{c.value}</span>
                  </div>
                );
              })
            )}

            {client.notes && (
              <div className="detail-notes">
                <p className="detail-notes-label">Notes</p>
                <p className="detail-notes-body">{client.notes}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Pipeline snapshot */}
      <Card>
        <CardHeader title="Pipeline this month" />
        <div className="stage-grid">
          {STAGES.map((stage) => {
            const count = stats.byStage[stage];
            return (
              <div key={stage} className={cn("stage-cell", count === 0 && "stage-cell-empty")}>
                <p className={cn("stage-count", "tabular", count === 0 && "stage-count-zero")}>
                  {count}
                </p>
                <p className="stage-name">{STAGE_LABELS[stage]}</p>
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
            <Link to={`/content?client=${client.id}`} className="detail-link">
              Open pipeline
            </Link>
          }
        />
        {recent.length === 0 ? (
          <p className="detail-empty-row">Nothing planned for {monthLabel(monthKey)} yet.</p>
        ) : (
          <ul className="row-list">
            {recent.map((item) => (
              <li key={item.id}>
                <Link to={`/content/${item.id}`} className="row">
                  <span className="row-dot" style={{ background: a.dot }} />
                  <span className="row-ref">{refLabel(item.ref)}</span>
                  <span className="row-title truncate">{item.title}</span>
                  <span className={cn("row-stage", stageConfig(item.stage).chip)}>
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
