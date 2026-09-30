import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { IconChevronLeft } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { useViewer } from "@/lib/auth";
import { getClient, saveClient } from "@/lib/queries";
import { accent } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";
import { initials } from "@/lib/utils";
import {
  EMPTY_CLIENT,
  clientToValues,
  validateClient,
  type ClientValues,
} from "./client-fields";
import "./ClientFormPage.css";

/** Both /clients/new and /clients/:id/edit — the same form, one place. */
export function ClientFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const viewer = useViewer();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: client, loading } = useAsync(
    () => (id ? getClient(id) : Promise.resolve(null)),
    [id],
  );

  const [values, setValues] = useState<ClientValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (editing && loading) return <PageSkeleton />;
  if (editing && !client) {
    return (
      <EmptyState
        title="Client not found"
        description="This client may have been deleted, or belongs to another agency."
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate("/clients")}>
            Back to clients
          </Button>
        }
      />
    );
  }

  // First render after the client arrives: seed the form from what's saved.
  const form = values ?? (client ? clientToValues(client) : EMPTY_CLIENT);
  const set = (key: keyof ClientValues) => (v: string) => setValues({ ...form, [key]: v });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { errors: found, data } = validateClient(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const savedId = await saveClient(data, viewer.agencyId, client?.id);
      toast.say(editing ? "Changes saved." : `${data.name} added.`);
      navigate(`/clients/${savedId}`);
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't save that.");
      setBusy(false);
    }
  }

  const a = accent();

  return (
    <div className="form-page stack-5">
      <Link to={client ? `/clients/${client.id}` : "/clients"} className="back-link">
        <IconChevronLeft />
        {client ? `Back to ${client.name}` : "Back to clients"}
      </Link>

      <div>
        <h1 className="page-title">{editing ? "Edit client" : "Add a client"}</h1>
        <p className="page-subtitle">
          {editing
            ? "Changes apply to this month's targets and every report from here on."
            : "Set the monthly content target now — every report in Agency OS counts against it."}
        </p>
      </div>

      <Card className="card-body">
        <form onSubmit={onSubmit} className="stack-5">
          <div className="form-identity">
            <span className={a.avatar}>{initials(form.name || "New Client")}</span>
            <p className="form-identity-name truncate">{form.name || "New client"}</p>
          </div>

          <div className="form-grid">
            <Field label="Client name" error={errors.name} className="span-2">
              <Input
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="ABC Restaurant"
                autoFocus
              />
            </Field>

            <Field label="Industry" hint="optional">
              <Input
                value={form.industry}
                onChange={(e) => set("industry")(e.target.value)}
                placeholder="Food & Beverage"
              />
            </Field>

            <Field label="Status">
              <Select value={form.status} onChange={(e) => set("status")(e.target.value)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>

            <Field label="Monthly content target" hint="videos / month" error={errors.monthlyTarget}>
              <Input
                type="number"
                min={0}
                max={999}
                value={form.monthlyTarget}
                onChange={(e) => set("monthlyTarget")(e.target.value)}
              />
            </Field>

            <Field label="Monthly post target" hint="posts / month" error={errors.monthlyPostTarget}>
              <Input
                type="number"
                min={0}
                max={999}
                value={form.monthlyPostTarget}
                onChange={(e) => set("monthlyPostTarget")(e.target.value)}
              />
            </Field>

            <Field label="Monthly retainer" hint="₹, optional" error={errors.retainer}>
              <Input
                type="number"
                min={0}
                step={500}
                value={form.retainer}
                onChange={(e) => set("retainer")(e.target.value)}
              />
            </Field>

            <Field label="Services" hint="comma separated" className="span-2">
              <Input
                value={form.services}
                onChange={(e) => set("services")(e.target.value)}
                placeholder="Reels, Shoots, Post design, Ads"
              />
            </Field>
          </div>

          <div className="form-box">
            <p className="form-box-label">Point of contact</p>
            <div className="form-grid-3">
              <Field label="Name" hint="optional">
                <Input
                  value={form.contactName}
                  onChange={(e) => set("contactName")(e.target.value)}
                  placeholder="Priya"
                />
              </Field>
              <Field label="Email" hint="optional" error={errors.contactEmail}>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail")(e.target.value)}
                  placeholder="priya@abc.com"
                />
              </Field>
              <Field label="Phone" hint="optional">
                <Input
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone")(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </Field>
            </div>
          </div>

          <Field label="Notes" hint="optional">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              placeholder="Brand tone, do's and don'ts, approval preferences…"
            />
          </Field>

          <div className="form-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(client ? `/clients/${client.id}` : "/clients")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create client"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
