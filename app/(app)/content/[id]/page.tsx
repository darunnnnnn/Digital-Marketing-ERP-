import Link from "next/link";
import { notFound } from "next/navigation";
import { saveStageDetails } from "@/app/(app)/content/actions";
import { AssigneeSelect } from "@/components/content/assignee-select";
import { DeleteContentButton } from "@/components/content/delete-content-button";
import { PanelForm } from "@/components/content/panel-form";
import { StageActions } from "@/components/content/stage-actions";
import { StageRail } from "@/components/content/stage-rail";
import { TaskView } from "@/components/content/task-view";
import { Timeline } from "@/components/content/timeline";
import { IconChevronLeft, IconPencil } from "@/components/icons";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
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
import { db } from "@/lib/db";
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
import { cn, dateInputValue, dueLabel, formatCalendar, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const agency = user.agency;

  const item = await db.contentItem.findFirst({
    where: { id, agencyId: agency.id },
    include: {
      client: true,
      events: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  // Someone not assigned to this video gets the same page as a missing one.
  if (!item || !canSeeItem(user, item)) notFound();

  const panel = ROLE_PANEL[user.role];
  if (!isManager(user) && panel) {
    return (
      <TaskView
        item={item}
        role={user.role}
        panel={panel}
        save={saveStageDetails.bind(null, item.id)}
        canSubmit={canAdvance(user, item)}
        canSendBack={canSendBack(user, item)}
      />
    );
  }

  const members = await db.member.findMany({
    where: { agencyId: agency.id, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, accent: true },
  });

  const byRole = (...roles: string[]) => members.filter((m) => roles.includes(m.role));

  const stage = stageConfig(item.stage);
  const clientAccent = accent(item.client.accent);
  const stepField = STAGE_DEADLINE[item.stage];
  const stepDue = stepField ? item[stepField] : null;
  const late = isOverdue(stepDue, item.stage);
  const p = priority(item.priority);
  const save = saveStageDetails.bind(null, item.id);

  // At a CEO gate, approving also picks the next person and their deadline.
  // Only built for someone who can actually approve, so the team list and
  // default assignee never reach anyone else's page.
  const gate = canAdvance(user, item) ? handoff(item.stage) : null;
  const handoffInfo = gate
    ? {
        verb: gate.verb,
        who: gate.who,
        options: byRole(gate.role),
        defaultMemberId: (item[gate.assign] as string | null) ?? "",
        defaultDue: dateInputValue(item[gate.deadline as keyof typeof item] as Date | null),
      }
    : null;

  const meta = [
    {
      label: "Format",
      value: FORMATS.find((f) => f.key === item.format)?.label ?? item.format,
    },
    { label: "This step due", value: dueLabel(stepDue) ?? "—", danger: late },
    { label: "Posting by", value: formatCalendar(item.publishDue) ?? "Not scheduled" },
    { label: "Revisions", value: String(item.revisions) },
  ];

  return (
    <div className="space-y-8">
      <Link
        href="/content"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
      >
        <IconChevronLeft className="h-4 w-4" />
        Content pipeline
      </Link>

      {/* Header */}
      <div className="surface p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-stone-900 px-2 py-1 font-mono text-[11px] font-medium text-white">
                {refLabel(item.ref)}
              </span>
              <span
                className={cn(
                  "rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset",
                  stage.chip,
                )}
              >
                {stage.label}
              </span>
              {item.priority !== "normal" && (
                <span
                  className={cn(
                    "rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset",
                    p.chip,
                  )}
                >
                  {p.label} priority
                </span>
              )}
              {late && (
                <span className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                  Overdue
                </span>
              )}
            </div>

            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-stone-900">
              {item.title}
            </h1>

            <Link
              href={`/clients/${item.client.id}`}
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
            >
              <span className={cn("h-2 w-2 rounded-full", clientAccent.dot)} />
              {item.client.name}
            </Link>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-500">
              {stage.blurb}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <StageActions
              id={item.id}
              stage={item.stage}
              canForward={canAdvance(user, item)}
              canBack={canSendBack(user, item)}
              handoff={handoffInfo}
            />
            {canDeleteContent(user) && <DeleteContentButton id={item.id} title={item.title} />}
          </div>
        </div>

        <div className="mt-6 border-t border-stone-200 pt-5">
          <StageRail item={item} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {meta.map((m) => (
            <div key={m.label} className="rounded-xl bg-stone-50 px-3 py-2.5">
              <p className="text-[11px] font-medium text-stone-400">{m.label}</p>
              <p className={cn("mt-0.5 text-sm font-semibold", m.danger && "text-red-600")}>
                {m.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Schedule */}
          <Card>
            <CardHeader
              title="Four-week schedule"
              action={
                <span className="text-xs text-stone-400">
                  {item.cycleStart
                    ? `Cycle started ${formatCalendar(item.cycleStart)}`
                    : "Not scheduled"}
                </span>
              }
            />
            <ol className="divide-y divide-stone-100">
              {STEPS.map((step) => {
                const status = stepStatus(item[step.field], item[step.done]);
                const current = step.field === stepField;
                return (
                  <li
                    key={step.field}
                    className={cn(
                      "flex items-center gap-4 px-5 py-3.5",
                      current && "bg-brand-50/60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        status.kind === "done"
                          ? "bg-brand-600 text-white"
                          : current
                            ? "bg-white text-brand-700 ring-2 ring-brand-600"
                            : "bg-stone-100 text-stone-400",
                      )}
                    >
                      W{step.week}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900">{step.label}</p>
                      <p className="text-xs text-stone-500">
                        {step.who} · due {formatCalendar(item[step.field]) ?? "—"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                        status.kind === "done" && !status.late && "bg-brand-50 text-brand-700",
                        status.kind === "done" && status.late && "bg-stone-100 text-stone-600",
                        status.kind === "late" && "bg-red-50 text-red-700",
                        status.kind === "due" && "bg-stone-100 text-stone-600",
                        status.kind === "unscheduled" && "text-stone-400",
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
            {canEditPanel(user, item, "schedule") && (
              <details className="group border-t border-stone-100">
                <summary className="flex cursor-pointer list-none items-center justify-center gap-2 bg-brand-50/70 px-5 py-3.5 text-sm font-medium text-brand-800 transition-colors hover:bg-brand-100/70 group-open:bg-transparent">
                  <IconPencil className="h-4 w-4" />
                  <span className="group-open:hidden">Edit deadlines</span>
                  <span className="hidden group-open:inline">Editing deadlines</span>
                </summary>
                <PanelForm action={save} panel="schedule">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {STEPS.map((step) => (
                      <Field key={step.field} label={step.label} hint={`week ${step.week}`}>
                        <Input
                          type="date"
                          name={step.field}
                          defaultValue={dateInputValue(item[step.field])}
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
            <PanelForm action={save} panel="brief" editable={canEditPanel(user, item, "brief")}>
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
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <span className="text-[11px] font-medium text-brand-600">
                    Approved {formatDate(item.scriptApprovedAt)}
                  </span>
                ) : item.scriptSubmittedAt ? (
                  <span className="text-[11px] font-medium text-stone-500">
                    Submitted {formatDate(item.scriptSubmittedAt)}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-stone-400">Not submitted</span>
                )
              }
            />
            <PanelForm
              action={save}
              panel="script"
              editable={canEditPanel(user, item, "script")}
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
                  className="font-mono text-xs leading-relaxed"
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
                  <span className="text-[11px] font-medium text-brand-600">
                    Footage in {formatDate(item.shootCompletedAt)}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-stone-400">Not shot yet</span>
                )
              }
            />
            <PanelForm action={save} panel="shoot" editable={canEditPanel(user, item, "shoot")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Shoot date">
                  <Input
                    type="date"
                    name="shootDate"
                    defaultValue={dateInputValue(item.shootDate)}
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
                  <span className="text-[11px] font-medium text-brand-600">
                    Approved {formatDate(item.editApprovedAt)}
                  </span>
                ) : item.editStartedAt ? (
                  <span className="text-[11px] font-medium text-brand-600">
                    Started {formatDate(item.editStartedAt)}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-stone-400">
                    Waiting on footage
                  </span>
                )
              }
            />
            <PanelForm action={save} panel="edit" editable={canEditPanel(user, item, "edit")}>
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
                  <span className="text-[11px] font-medium text-brand-600">
                    Published {formatDate(item.publishedAt)}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-stone-400">Not live</span>
                )
              }
            />
            <PanelForm action={save} panel="post" editable={canEditPanel(user, item, "post")}>
              <div className="grid gap-4 sm:grid-cols-2">
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
                    defaultValue={dateInputValue(item.scheduledFor)}
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
              <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Who is on this"
              action={
                <span className="text-[11px] font-medium text-stone-400">
                  {stageProgress(item.stage)}% through
                </span>
              }
            />
            <div className="space-y-1 p-3">
              <AssigneeSelect
                id={item.id}
                field="scriptwriterId"
                label="Scriptwriter"
                value={item.scriptwriterId}
                options={byRole("scriptwriter", "manager")}
                disabled={!canAssign(user)}
                highlight={stage.assign === "scriptwriterId"}
              />
              <AssigneeSelect
                id={item.id}
                field="cameramanId"
                label="Cameraman"
                value={item.cameramanId}
                options={byRole("cameraman")}
                disabled={!canAssign(user)}
                highlight={stage.assign === "cameramanId"}
              />
              <AssigneeSelect
                id={item.id}
                field="editorId"
                label="Editor"
                value={item.editorId}
                options={byRole("editor")}
                disabled={!canAssign(user)}
                highlight={stage.assign === "editorId"}
              />
              <AssigneeSelect
                id={item.id}
                field="publisherId"
                label="Posting"
                value={item.publisherId}
                options={byRole("publisher", "manager")}
                disabled={!canAssign(user)}
                highlight={stage.assign === "publisherId"}
              />
            </div>
          </Card>

          {(item.footageUrl || item.editUrl || item.publishedUrl) && (
            <Card>
              <CardHeader title="Links" />
              <div className="space-y-1.5 p-3">
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
                      className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors hover:bg-stone-100"
                    >
                      {l.label}
                      <svg
                        viewBox="0 0 24 24"
                        className="ml-auto h-3.5 w-3.5 text-stone-400"
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
            <Timeline id={item.id} events={item.events} />
          </Card>
        </div>
      </div>
    </div>
  );
}
