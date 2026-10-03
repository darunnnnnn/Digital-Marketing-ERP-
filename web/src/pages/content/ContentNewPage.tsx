import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { LinkButton } from "@/components/ui/Button";
import { PageSkeleton } from "@/components/PageSkeleton";
import { IconChevronLeft } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { useViewer } from "@/lib/auth";
import { FORMATS } from "@/lib/pipeline";
import { hasRole } from "@/lib/roles";
import { listClients, listMembers, plannedPerClient, planContent } from "@/lib/queries";
import { STEPS, defaultCycleStart, scheduleFrom, type DeadlineField } from "@/lib/schedule";
import { useAsync } from "@/lib/use-async";
import { cn, currentMonthKey, dateInputValue, parseDateInput } from "@/lib/utils";
import { validatePlan, type PlanValues } from "./plan-fields";
import type { ClientOption, MemberOption } from "./types";
import "../clients/ClientFormPage.css";
import "./ContentNewPage.css";

function datesFromWeek(week: string): Record<DeadlineField, string> {
  const start = parseDateInput(week);
  const schedule = start ? scheduleFrom(start) : null;
  return STEPS.reduce(
    (acc, step) => ({
      ...acc,
      [step.field]: schedule ? dateInputValue(schedule[step.field]) : "",
    }),
    {} as Record<DeadlineField, string>,
  );
}

function PlanForm({
  clients,
  members,
  defaultClientId,
}: {
  clients: ClientOption[];
  members: MemberOption[];
  defaultClientId?: string;
}) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const toast = useToast();
  const byRole = (role: string) => members.filter((m) => hasRole(m, role));
  const writers = byRole("scriptwriter");

  const [v, setV] = useState<PlanValues>(() => ({
    clientId: defaultClientId ?? clients[0]?.id ?? "",
    mode: "ideas",
    ideas: "",
    count: "5",
    planMode: "script",
    weekStart: defaultCycleStart(),
    format: "reel",
    priority: "normal",
    scriptwriterId: "",
    referenceUrl: "",
    cameramanId: "",
    editorId: "",
    publisherId: "",
    dates: datesFromWeek(defaultCycleStart()),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof PlanValues>(key: K, value: PlanValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  /** Picking a start week fills in all six deadlines; each can then be changed. */
  function applyWeek(value: string) {
    setV((prev) => ({
      ...prev,
      weekStart: value,
      dates: parseDateInput(value) ? datesFromWeek(value) : prev.dates,
    }));
  }

  // A step can't be due before the one it depends on.
  const outOfOrder = STEPS.findIndex(
    (step, i) =>
      i > 0 &&
      v.dates[step.field] &&
      v.dates[STEPS[i - 1].field] &&
      v.dates[step.field] < v.dates[STEPS[i - 1].field],
  );

  const selected = clients.find((c) => c.id === v.clientId);
  const lines =
    v.mode === "count" ? Number(v.count) || 0 : v.ideas.split("\n").filter((l) => l.trim()).length;
  const remaining = selected ? Math.max(0, selected.monthlyTarget - selected.planned) : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { errors: found, titles, deadlines, assignees } = validatePlan(v, members);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const ids = await planContent({
        agencyId: viewer.agencyId,
        actor: viewer.name,
        titles,
        clientId: v.clientId,
        clientName: selected?.name ?? "this client",
        format: v.format,
        priority: v.priority,
        // Blank in script-only mode, so no later deadline is invented.
        weekStart: v.planMode === "full" ? v.weekStart : "",
        scriptwriterId: v.scriptwriterId,
        referenceUrl: v.referenceUrl.trim(),
        deadlines,
        assignees,
      });

      toast.say(ids.length === 1 ? "Video planned." : `${ids.length} videos planned.`);
      navigate(ids.length === 1 ? `/content/${ids[0]}` : `/content?client=${v.clientId}`);
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't plan that.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack-5">
      <div className="form-grid">
        <Field label="Client" error={errors.clientId}>
          <Select value={v.clientId} onChange={(e) => set("clientId", e.target.value)}>
            {clients.length === 0 && <option value="">No clients yet</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {v.planMode === "full" ? (
          <Field label="Cycle starts" hint="the Monday script work begins">
            <Input type="date" value={v.weekStart} onChange={(e) => applyWeek(e.target.value)} />
          </Field>
        ) : (
          <Field label="Script ready by" hint="the writer's deadline" error={errors.scriptDue}>
            <Input
              type="date"
              value={v.dates.scriptDue}
              onChange={(e) => set("dates", { ...v.dates, scriptDue: e.target.value })}
            />
          </Field>
        )}
      </div>

      <div className="plan-box">
        <div className="plan-box-head">
          <p className="plan-box-title">Deadlines</p>
          <div className="plan-switch">
            {(
              [
                ["script", "Script only"],
                ["full", "Whole cycle"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => set("planMode", key)}
                className={cn("plan-switch-btn", v.planMode === key && "plan-switch-on")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {v.planMode === "script" ? (
          <p className="plan-explain">
            Only the writer gets a deadline now. You&apos;ll set the shoot, edit and posting dates
            later, each time you approve the work and hand it on.
          </p>
        ) : (
          <>
            <div className="plan-dates">
              {STEPS.map((step, i) => (
                <Field
                  key={step.field}
                  label={step.label}
                  hint={step.who.toLowerCase()}
                  error={i === outOfOrder && !errors.schedule ? " " : undefined}
                >
                  <Input
                    type="date"
                    value={v.dates[step.field]}
                    onChange={(e) => set("dates", { ...v.dates, [step.field]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            {(outOfOrder > 0 || errors.schedule) && (
              <p className="plan-error">
                {errors.schedule ??
                  `"${STEPS[outOfOrder].label}" is due before "${STEPS[outOfOrder - 1].label}".`}
              </p>
            )}

            <p className="plan-assign-label">Assign now (optional)</p>
            <div className="form-grid-3">
              {(
                [
                  ["cameramanId", "cameraman", "Cameraman"],
                  ["editorId", "editor", "Editor"],
                  ["publisherId", "publisher", "Posting"],
                ] as const
              ).map(([field, role, label]) => (
                <Field key={field} label={label} error={errors[field]}>
                  <Select value={v[field]} onChange={(e) => set(field, e.target.value)}>
                    <option value="">Decide at the gate</option>
                    {byRole(role).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && selected.monthlyTarget > 0 && (
        <div className="plan-target">
          <span className="plan-target-name">{selected.name}</span>
          <span className="muted">
            has {selected.planned} of {selected.monthlyTarget} planned this month
          </span>
          {remaining > 0 && <span className="plan-target-left">{remaining} to plan</span>}
        </div>
      )}

      <div className="stack-3">
        <div className="tabs">
          {(
            [
              ["ideas", "I have the ideas"],
              ["count", "Writer proposes them"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => set("mode", key)}
              className={cn("tab", v.mode === key && "tab-active")}
            >
              {label}
            </button>
          ))}
        </div>

        {v.mode === "ideas" ? (
          <Field label="Ideas" hint="one per line — each becomes its own video" error={errors.ideas}>
            <Textarea
              rows={6}
              value={v.ideas}
              onChange={(e) => set("ideas", e.target.value)}
              autoFocus
            />
          </Field>
        ) : (
          <Field
            label="How many scripts?"
            hint="the writer names and writes each one"
            error={errors.count}
          >
            <Input
              type="number"
              min={1}
              max={50}
              value={v.count}
              onChange={(e) => set("count", e.target.value)}
              autoFocus
            />
          </Field>
        )}
      </div>

      <Field
        label="Reference link"
        hint="optional — an example video to work from"
        error={errors.referenceUrl}
      >
        <Input
          type="url"
          value={v.referenceUrl}
          onChange={(e) => set("referenceUrl", e.target.value)}
          placeholder="https://instagram.com/reel/…"
        />
      </Field>

      <div className="form-grid-3">
        <Field label="Format">
          <Select value={v.format} onChange={(e) => set("format", e.target.value)}>
            {FORMATS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priority">
          <Select value={v.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </Field>

        <Field
          label="Scriptwriter"
          hint={v.mode === "count" ? "required" : "optional"}
          error={errors.scriptwriterId}
        >
          <Select
            value={v.scriptwriterId}
            onChange={(e) => set("scriptwriterId", e.target.value)}
          >
            <option value="">Leave in Planned</option>
            {writers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <p className="plan-footnote">
        Assigning a scriptwriter now sends these straight to the Scripting column. Otherwise they
        wait in Planned.
      </p>

      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={() => navigate("/content")}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Planning…" : lines > 1 ? `Plan ${lines} videos` : "Plan video"}
        </Button>
      </div>
    </form>
  );
}

export function ContentNewPage() {
  const viewer = useViewer();
  const [params] = useSearchParams();
  const wanted = params.get("client") ?? "";
  const monthKey = currentMonthKey();

  const { data, loading } = useAsync(async () => {
    // All independent — one round trip.
    const [clients, members, planned] = await Promise.all([
      listClients(viewer.agencyId),
      listMembers(viewer.agencyId, true),
      // Feeds the "x of y planned this month" hint.
      plannedPerClient(viewer.agencyId, monthKey),
    ]);

    return {
      clients: clients
        .filter((c) => c.status !== "archived")
        .map((c) => ({
          id: c.id,
          name: c.name,
          accent: c.accent,
          monthlyTarget: c.monthlyTarget,
          planned: planned.get(c.id) ?? 0,
        })),
      members,
    };
  }, [viewer.agencyId, monthKey]);

  if (loading && !data) return <PageSkeleton />;

  const clients = data?.clients ?? [];
  const members = data?.members ?? [];
  const defaultClientId = clients.some((c) => c.id === wanted) ? wanted : undefined;

  return (
    <div className="form-page stack-5">
      <Link to="/content" className="back-link">
        <IconChevronLeft />
        Back to content
      </Link>

      <div>
        <h1 className="page-title">Plan content</h1>
        <p className="page-subtitle">
          Drop in a week&apos;s worth of ideas at once — one line per video.
        </p>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title="Add a client first"
          description="Content is always planned against a client. Create one, then come back here."
          action={<LinkButton to="/clients/new">Add a client</LinkButton>}
        />
      ) : (
        <Card className="card-body">
          <PlanForm clients={clients} members={members} defaultClientId={defaultClientId} />
        </Card>
      )}
    </div>
  );
}
