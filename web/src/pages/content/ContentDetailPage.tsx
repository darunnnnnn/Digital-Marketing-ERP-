import { useState } from "react";
import { Link, useParams } from "react-router";
import { AssigneeSelect } from "./AssigneeSelect";
import { PanelForm } from "./PanelForm";
import { StageActions, type HandoffInfo } from "./StageActions";
import { StageRail } from "./StageRail";
import { TaskView } from "./TaskView";
import { Timeline } from "./Timeline";
import { IconChevronLeft, IconPencil, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { LinkButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useToast } from "@/components/ui/Toast";
import { useViewer } from "@/lib/auth";
import { ROLE_PANEL } from "@/lib/my-work";
import {
  canAdvance,
  canAssign,
  canDeleteContent,
  canEditPanel,
  canSeeItem,
  canSendBack,
  isManager,
} from "@/lib/permissions";
import { deleteContent, getContent, listEvents, listMembers } from "@/lib/queries";
import {
  FORMATS,
  handoff,
  isOverdue,
  priority,
  refLabel,
  stageConfig,
  stageProgress,
} from "@/lib/pipeline";
import { accent } from "@/lib/theme";
import { STAGE_DEADLINE, STEPS, stepStatus } from "@/lib/schedule";
import { useAsync } from "@/lib/use-async";
import {
  cn,
  dateInputValue,
  dueLabel,
  formatCalendar,
  formatDate,
  toDate,
} from "@/lib/utils";
import { useNavigate } from "react-router";
import "./ContentDetailPage.css";

function DeleteContentButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function remove() {
    setBusy(true);
    try {
      await deleteContent(id);
      toast.say("Deleted.");
      navigate("/content");
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : "Couldn't delete that.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="icon-danger"
        aria-label="Delete this content"
      >
        <IconTrash />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete this content?">
        <p className="prose-sm">
          <strong>{title}</strong> and its whole activity log will be removed. This cannot be
          undone.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button type="button" variant="danger" onClick={remove} disabled={busy}>
            {busy ? "Deleting…" : "Yes, delete"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** A panel's small right-hand status line — "Approved 12 Sep", "Not live". */
function PanelStatus({ done, tone = "ok" }: { done: string | null; tone?: "ok" | "quiet" }) {
  return <span className={cn("panel-status", tone === "quiet" && "panel-status-quiet")}>{done}</span>;
}

export function ContentDetailPage() {
  const { id = "" } = useParams();
  const viewer = useViewer();
  const manager = isManager(viewer);

  const { data, loading, reload } = useAsync(async () => {
    const item = await getContent(id);
    if (!item || !canSeeItem(viewer, item)) return { item: null };

    const [events, team] = await Promise.all([
      listEvents(item.id),
      // Creative roles don't need the team list, and shouldn't be sent it.
      manager ? listMembers(viewer.agencyId, true) : Promise.resolve([]),
    ]);
    return { item, events, team };
  }, [id, viewer.id, manager]);

  if (loading && !data) return <PageSkeleton />;

  const item = data?.item;
  // Someone not assigned to this video gets the same page as a missing one.
  if (!item) {
    return (
      <EmptyState
        title="Content not found"
        description="This video may have been deleted, or it isn't assigned to you."
        action={
          <LinkButton to="/content" size="sm" variant="secondary">
            Content pipeline
          </LinkButton>
        }
      />
    );
  }

  const events = data!.events ?? [];
  const team = data!.team ?? [];

  const panel = ROLE_PANEL[viewer.role];
  if (!manager && panel) {
    return (
      <TaskView
        item={item}
        events={events}
        role={viewer.role}
        panel={panel}
        actor={viewer.name}
        canSubmit={canAdvance(viewer, item)}
        canSendBack={canSendBack(viewer, item)}
        onChanged={reload}
      />
    );
  }

  const byRole = (...roles: string[]) => team.filter((m) => roles.includes(m.role));

  const stage = stageConfig(item.stage);
  const clientAccent = accent(item.client?.accent);
  const stepField = STAGE_DEADLINE[item.stage];
  const stepDue = stepField ? toDate(item[stepField]) : null;
  const late = isOverdue(stepDue, item.stage);
  const p = priority(item.priority);

  // At a CEO gate, approving also picks the next person and their deadline.
  // Only built for someone who can actually approve, so the team list and
  // default assignee never reach anyone else's page.
  const gate = canAdvance(viewer, item) ? handoff(item.stage) : null;
  const handoffInfo: HandoffInfo | null = gate
    ? {
        verb: gate.verb,
        who: gate.who,
        options: byRole(gate.role),
        defaultMemberId: (item[gate.assign] as string | null) ?? "",
        defaultDue: dateInputValue(toDate(item[gate.deadline as keyof typeof item] as string | null)),
      }
    : null;

  const meta = [
    { label: "Format", value: FORMATS.find((f) => f.key === item.format)?.label ?? item.format },
    { label: "This step due", value: dueLabel(stepDue) ?? "—", danger: late },
    { label: "Posting by", value: formatCalendar(toDate(item.publishDue)) ?? "Not scheduled" },
    { label: "Revisions", value: String(item.revisions) },
  ];

  return (
    <div className="stack-8">
      <Link to="/content" className="back-link">
        <IconChevronLeft />
        Content pipeline
      </Link>

      {/* Header */}
      <div className="card video-head">
        <div className="video-head-top">
          <div className="video-head-main">
            <div className="video-tags">
              <span className="video-ref">{refLabel(item.ref)}</span>
              <span className={cn("video-tag", stage.chip)}>{stage.label}</span>
              {item.priority !== "normal" && (
                <span className={cn("video-tag", p.chip)}>{p.label} priority</span>
              )}
              {late && <span className="video-tag chip-alert">Overdue</span>}
            </div>

            <h1 className="video-title">{item.title}</h1>

            {item.client && (
              <Link to={`/clients/${item.client.id}`} className="video-client">
                <span className="video-client-dot" style={{ background: clientAccent.dot }} />
                {item.client.name}
              </Link>
            )}

            <p className="video-blurb">{stage.blurb}</p>
          </div>

          <div className="video-head-actions">
            <StageActions
              item={item}
              canForward={canAdvance(viewer, item)}
              canBack={canSendBack(viewer, item)}
              handoff={handoffInfo}
              team={team}
              actor={viewer.name}
              onChanged={reload}
            />
            {canDeleteContent(viewer) && (
              <DeleteContentButton id={item.id} title={item.title} />
            )}
          </div>
        </div>

        <div className="video-rail">
          <StageRail item={item} />
        </div>

        <div className="video-meta">
          {meta.map((m) => (
            <div key={m.label} className="video-meta-cell">
              <p className="video-meta-label">{m.label}</p>
              <p className={cn("video-meta-value", m.danger && "video-meta-late")}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="video-columns">
        <div className="video-main stack-6">
          {/* Schedule */}
          <Card>
            <CardHeader
              title="Schedule"
              action={
                <span className="panel-status panel-status-quiet">
                  {item.cycleStart
                    ? `Cycle started ${formatCalendar(toDate(item.cycleStart))}`
                    : "Not scheduled"}
                </span>
              }
            />
            <ol className="steps">
              {STEPS.map((step, i) => {
                const status = stepStatus(toDate(item[step.field]), toDate(item[step.done]));
                const current = step.field === stepField;
                return (
                  <li key={step.field} className={cn("step", current && "step-current")}>
                    <span
                      className={cn(
                        "step-num",
                        status.kind === "done" && "step-num-done",
                        status.kind !== "done" && current && "step-num-current",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="step-main">
                      <p className="step-label">{step.label}</p>
                      <p className="step-who">
                        {step.who} · due {formatCalendar(toDate(item[step.field])) ?? "—"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "step-status",
                        status.kind === "done" && !status.late && "step-status-done",
                        status.kind === "done" && status.late && "step-status-neutral",
                        status.kind === "late" && "step-status-late",
                        status.kind === "due" && "step-status-neutral",
                        status.kind === "unscheduled" && "step-status-none",
                      )}
                    >
                      {status.kind === "done"
                        ? `${status.late ? "Done late" : "Done"} · ${formatDate(status.at)}`
                        : status.kind === "late"
                          ? `${status.days}d late`
                          : status.kind === "due"
                            ? status.days === 0
                              ? "Due today"
                              : `In ${status.days}d`
                            : "No date"}
                    </span>
                  </li>
                );
              })}
            </ol>
            {canEditPanel(viewer, item, "schedule") && (
              <details className="edit-drawer">
                <summary className="edit-drawer-summary">
                  <IconPencil />
                  <span className="edit-drawer-closed">Edit deadlines</span>
                  <span className="edit-drawer-open">Editing deadlines</span>
                </summary>
                <PanelForm id={item.id} panel="schedule" onSaved={reload}>
                  <div className="panel-trio">
                    {STEPS.map((step) => (
                      <Field key={step.field} label={step.label} hint={step.who.toLowerCase()}>
                        <Input
                          type="date"
                          name={step.field}
                          defaultValue={dateInputValue(toDate(item[step.field]))}
                        />
                      </Field>
                    ))}
                  </div>
                </PanelForm>
              </details>
            )}
          </Card>

          {/* Brief */}
          <Card>
            <CardHeader title="Brief" />
            <PanelForm
              id={item.id}
              panel="brief"
              editable={canEditPanel(viewer, item, "brief")}
              onSaved={reload}
            >
              <Field label="Title">
                <Input name="title" defaultValue={item.title} />
              </Field>
              <Field label="The idea" hint="what this video is actually about">
                <Textarea
                  name="idea"
                  rows={3}
                  defaultValue={item.idea ?? ""}
                  placeholder="Chef plates the signature dish while talking through the two ingredients nobody expects."
                />
              </Field>
              <div className="panel-pair">
                <Field label="Format">
                  <Select name="format" defaultValue={item.format}>
                    {FORMATS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Priority">
                  <Select name="priority" defaultValue={item.priority}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </Select>
                </Field>
              </div>
            </PanelForm>
          </Card>

          {/* Script */}
          <Card>
            <CardHeader
              title="Script"
              action={
                item.scriptApprovedAt ? (
                  <PanelStatus done={`Approved ${formatDate(toDate(item.scriptApprovedAt))}`} />
                ) : item.scriptSubmittedAt ? (
                  <PanelStatus
                    done={`Submitted ${formatDate(toDate(item.scriptSubmittedAt))}`}
                    tone="quiet"
                  />
                ) : (
                  <PanelStatus done="Not submitted" tone="quiet" />
                )
              }
            />
            <PanelForm
              id={item.id}
              panel="script"
              editable={canEditPanel(viewer, item, "script")}
              onSaved={reload}
            >
              <Field label="Video title" hint="name the idea you are writing">
                <Input name="title" defaultValue={item.title} />
              </Field>
              <Field label="Script" hint="hook, body, call to action">
                <Textarea
                  name="scriptBody"
                  rows={8}
                  defaultValue={item.scriptBody ?? ""}
                  placeholder={
                    "HOOK\nYou've been eating this wrong.\n\nBODY\n…\n\nCTA\nSave this for your next visit."
                  }
                  className="panel-script"
                />
              </Field>
            </PanelForm>
          </Card>

          {/* Shoot */}
          <Card>
            <CardHeader
              title="Shoot"
              action={
                item.shootCompletedAt ? (
                  <PanelStatus done={`Footage in ${formatDate(toDate(item.shootCompletedAt))}`} />
                ) : (
                  <PanelStatus done="Not shot yet" tone="quiet" />
                )
              }
            />
            <PanelForm
              id={item.id}
              panel="shoot"
              editable={canEditPanel(viewer, item, "shoot")}
              onSaved={reload}
            >
              <div className="panel-pair">
                <Field label="Shoot date">
                  <Input
                    type="date"
                    name="shootDate"
                    defaultValue={dateInputValue(toDate(item.shootDate))}
                  />
                </Field>
                <Field label="Location">
                  <Input
                    name="shootLocation"
                    defaultValue={item.shootLocation ?? ""}
                    placeholder="Client's kitchen, Anna Nagar"
                  />
                </Field>
              </div>
              <Field label="Shoot requirements" hint="props, talent, shot list">
                <Textarea
                  name="shootNotes"
                  rows={3}
                  defaultValue={item.shootNotes ?? ""}
                  placeholder="Gimbal, two lapel mics, chef in uniform. Golden hour on the terrace."
                />
              </Field>
              <Field label="Raw footage link">
                <Input
                  name="footageUrl"
                  type="url"
                  defaultValue={item.footageUrl ?? ""}
                  placeholder="https://drive.google.com/…"
                />
              </Field>
            </PanelForm>
          </Card>

          {/* Edit */}
          <Card>
            <CardHeader
              title="Edit"
              action={
                item.editApprovedAt ? (
                  <PanelStatus done={`Approved ${formatDate(toDate(item.editApprovedAt))}`} />
                ) : item.editStartedAt ? (
                  <PanelStatus done={`Started ${formatDate(toDate(item.editStartedAt))}`} />
                ) : (
                  <PanelStatus done="Waiting on footage" tone="quiet" />
                )
              }
            />
            <PanelForm
              id={item.id}
              panel="edit"
              editable={canEditPanel(viewer, item, "edit")}
              onSaved={reload}
            >
              <Field label="Editing instructions" hint="pace, captions, music, branding">
                <Textarea
                  name="editBrief"
                  rows={3}
                  defaultValue={item.editBrief ?? ""}
                  placeholder="Fast cuts, burned-in captions, brand lower third at 0:02, trending audio."
                />
              </Field>
              <Field label="Edited video link">
                <Input
                  name="editUrl"
                  type="url"
                  defaultValue={item.editUrl ?? ""}
                  placeholder="https://frame.io/…"
                />
              </Field>
            </PanelForm>
          </Card>

          {/* Posting */}
          <Card>
            <CardHeader
              title="Posting"
              action={
                item.publishedAt ? (
                  <PanelStatus done={`Published ${formatDate(toDate(item.publishedAt))}`} />
                ) : (
                  <PanelStatus done="Not live" tone="quiet" />
                )
              }
            />
            <PanelForm
              id={item.id}
              panel="post"
              editable={canEditPanel(viewer, item, "post")}
              onSaved={reload}
            >
              <div className="panel-pair">
                <Field label="Platform">
                  <Input
                    name="platform"
                    defaultValue={item.platform ?? ""}
                    placeholder="Instagram Reels"
                  />
                </Field>
                <Field label="Scheduled for">
                  <Input
                    type="date"
                    name="scheduledFor"
                    defaultValue={dateInputValue(toDate(item.scheduledFor))}
                  />
                </Field>
              </div>
              <Field label="Caption">
                <Textarea
                  name="caption"
                  rows={3}
                  defaultValue={item.caption ?? ""}
                  placeholder="The dish that built this restaurant 🍜"
                />
              </Field>
              <div className="panel-pair">
                <Field label="Hashtags">
                  <Input
                    name="hashtags"
                    defaultValue={item.hashtags ?? ""}
                    placeholder="#chennaifood #reels"
                  />
                </Field>
                <Field label="Thumbnail link">
                  <Input
                    name="thumbnailUrl"
                    defaultValue={item.thumbnailUrl ?? ""}
                    placeholder="https://…"
                  />
                </Field>
              </div>
              <Field label="Published link" hint="the live post">
                <Input
                  name="publishedUrl"
                  type="url"
                  defaultValue={item.publishedUrl ?? ""}
                  placeholder="https://instagram.com/p/…"
                />
              </Field>
            </PanelForm>
          </Card>
        </div>

        {/* Right rail */}
        <div className="stack-6">
          <Card>
            <CardHeader
              title="Who is on this"
              action={
                <span className="panel-status panel-status-quiet">
                  {stageProgress(item.stage)}% through
                </span>
              }
            />
            <div className="assignees">
              {(
                [
                  ["scriptwriterId", "Scriptwriter", ["scriptwriter", "manager"]],
                  ["cameramanId", "Cameraman", ["cameraman"]],
                  ["editorId", "Editor", ["editor"]],
                  ["publisherId", "Posting", ["publisher", "manager"]],
                ] as const
              ).map(([field, label, roles]) => (
                <AssigneeSelect
                  key={field}
                  item={item}
                  field={field}
                  label={label}
                  options={byRole(...roles)}
                  team={team}
                  actor={viewer.name}
                  disabled={!canAssign(viewer)}
                  highlight={stage.assign === field}
                  onChanged={reload}
                />
              ))}
            </div>
          </Card>

          {(item.footageUrl || item.editUrl || item.publishedUrl) && (
            <Card>
              <CardHeader title="Links" />
              <div className="links">
                {[
                  { label: "Raw footage", href: item.footageUrl },
                  { label: "Edited cut", href: item.editUrl },
                  { label: "Live post", href: item.publishedUrl },
                ]
                  .filter((l) => l.href)
                  .map((l) => (
                    <a
                      key={l.label}
                      href={l.href!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-row"
                    >
                      {l.label}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
                      </svg>
                    </a>
                  ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Activity" />
            <Timeline id={item.id} events={events} actor={viewer.name} onPosted={reload} />
          </Card>
        </div>
      </div>
    </div>
  );
}
