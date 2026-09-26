import Link from "next/link";
import { IconChevronLeft } from "@/components/icons";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { ContentFormState } from "@/app/(app)/content/actions";
import { ROLE_TASK } from "@/lib/my-work";
import { isOverdue, refLabel, stageConfig } from "@/lib/pipeline";
import { STAGE_DEADLINE } from "@/lib/schedule";
import { cn, dateInputValue, dueLabel, formatCalendar, timeAgo } from "@/lib/utils";
import { PanelForm } from "./panel-form";
import { StageActions } from "./stage-actions";

type Item = {
  id: string;
  ref: number;
  title: string;
  stage: string;
  idea: string | null;
  client: { name: string };
  scriptBody: string | null;
  shootDate: Date | null;
  shootLocation: string | null;
  shootNotes: string | null;
  footageUrl: string | null;
  editBrief: string | null;
  editUrl: string | null;
  platform: string | null;
  caption: string | null;
  hashtags: string | null;
  thumbnailUrl: string | null;
  scheduledFor: Date | null;
  publishedUrl: string | null;
  events: {
    id: string;
    kind: string;
    message: string;
    actor: string | null;
    createdAt: Date;
  }[];
  [key: string]: unknown;
};

/** Read-only material the person needs in order to do their step. */
function Reference({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      <div className="mt-1.5 text-sm text-stone-700">{children}</div>
    </div>
  );
}

export function TaskView({
  item,
  role,
  panel,
  save,
  canSubmit,
  canSendBack,
}: {
  item: Item;
  role: string;
  panel: string;
  save: (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;
  canSubmit: boolean;
  canSendBack: boolean;
}) {
  const stage = stageConfig(item.stage);
  const dueField = STAGE_DEADLINE[item.stage];
  const due = dueField ? ((item[dueField] as Date | null) ?? null) : null;
  const late = isOverdue(due, item.stage);
  const task = ROLE_TASK[role];
  const mine = panel === "script" ? item.stage === "scripting" : canSubmit;

  // The most recent thing the CEO said, so changes asked for aren't buried.
  const message = item.events.find((e) => e.kind === "revision" || e.kind === "note");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/content"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
      >
        <IconChevronLeft className="h-4 w-4" />
        Your work
      </Link>

      {/* What and when */}
      <div className="surface p-7">
        <p className="text-sm text-stone-500">
          {item.client.name} · <span className="font-mono">{refLabel(item.ref)}</span>
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">
          {item.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className={cn("rounded-full px-3 py-1 text-sm ring-1 ring-inset", stage.chip)}>
            {stage.label}
          </span>
          {due && (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium",
                late ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-800",
              )}
            >
              {dueLabel(due)} · {formatCalendar(due)}
            </span>
          )}
        </div>

        {!mine && (
          <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
            {task ? `Your ${task.noun} is done.` : "Your part is done."} This is with{" "}
            {stage.owner === "ceo" ? "the CEO" : `the ${stage.owner}`} now — nothing for you to
            do.
          </p>
        )}

        {message && (
          <div className="mt-4 rounded-2xl bg-brand-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
              {message.kind === "revision" ? "Changes requested" : "Note"}
            </p>
            <p className="mt-1 text-sm text-stone-800">{message.message}</p>
            <p className="mt-1 text-xs text-stone-500">
              {message.actor ? `${message.actor} · ` : ""}
              {timeAgo(message.createdAt)}
            </p>
          </div>
        )}
      </div>

      {/* What they were given */}
      {(item.idea ||
        item.scriptBody ||
        item.footageUrl ||
        item.shootNotes ||
        item.editBrief) && (
        <Card>
          <CardHeader title="1 · What you need" />
          <div className="space-y-4 px-6 pb-6 pt-1">
            {panel === "script" && item.idea && (
              <Reference label="The idea">{item.idea}</Reference>
            )}

            {(panel === "shoot" || panel === "edit") && item.scriptBody && (
              <Reference label="Approved script">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {item.scriptBody}
                </pre>
              </Reference>
            )}

            {panel === "shoot" && item.shootNotes && (
              <Reference label="Shoot requirements">{item.shootNotes}</Reference>
            )}

            {panel === "edit" && item.footageUrl && (
              <Reference label="Raw footage">
                <a
                  href={item.footageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 underline"
                >
                  Open the footage
                </a>
              </Reference>
            )}

            {panel === "edit" && item.editBrief && (
              <Reference label="Editing instructions">{item.editBrief}</Reference>
            )}

            {panel === "post" && item.editUrl && (
              <Reference label="Final video">
                <a
                  href={item.editUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 underline"
                >
                  Open the edit
                </a>
              </Reference>
            )}
          </div>
        </Card>
      )}

      {/* Their own work */}
      <Card>
        <CardHeader title={`2 · ${task?.verb ?? "Your work"}`} />
        <PanelForm action={save} panel={panel} editable={mine}>
          {panel === "script" && (
            <>
              <Field label="Video title" hint="name the idea you are writing">
                <Input name="title" defaultValue={item.title} />
              </Field>
              <Field label="Script" hint="hook, body, call to action">
                <Textarea
                  name="scriptBody"
                  rows={12}
                  defaultValue={item.scriptBody ?? ""}
                  placeholder={"HOOK\n…\n\nBODY\n…\n\nCTA\n…"}
                  className="font-mono text-[13px] leading-relaxed"
                />
              </Field>
            </>
          )}

          {panel === "shoot" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Shoot date">
                  <Input
                    type="date"
                    name="shootDate"
                    defaultValue={dateInputValue(item.shootDate)}
                  />
                </Field>
                <Field label="Location">
                  <Input name="shootLocation" defaultValue={item.shootLocation ?? ""} />
                </Field>
              </div>
              <Field label="Notes" hint="anything worth recording about the shoot">
                <Textarea name="shootNotes" rows={3} defaultValue={item.shootNotes ?? ""} />
              </Field>
              <Field label="Raw footage link" hint="Google Drive, Dropbox, anywhere">
                <Input
                  name="footageUrl"
                  type="url"
                  defaultValue={item.footageUrl ?? ""}
                  placeholder="https://drive.google.com/…"
                />
              </Field>
            </>
          )}

          {panel === "edit" && (
            <>
              <Field label="Edited video link">
                <Input
                  name="editUrl"
                  type="url"
                  defaultValue={item.editUrl ?? ""}
                  placeholder="https://frame.io/…"
                />
              </Field>
              <Field label="Editing notes" hint="optional">
                <Textarea name="editBrief" rows={3} defaultValue={item.editBrief ?? ""} />
              </Field>
            </>
          )}

          {panel === "post" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Platform">
                  <Input name="platform" defaultValue={item.platform ?? ""} />
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
                <Textarea name="caption" rows={3} defaultValue={item.caption ?? ""} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hashtags">
                  <Input name="hashtags" defaultValue={item.hashtags ?? ""} />
                </Field>
                <Field label="Thumbnail link">
                  <Input name="thumbnailUrl" defaultValue={item.thumbnailUrl ?? ""} />
                </Field>
              </div>
              <Field label="Published link" hint="paste it once it is live">
                <Input name="publishedUrl" type="url" defaultValue={item.publishedUrl ?? ""} />
              </Field>
            </>
          )}
        </PanelForm>
      </Card>

      {/* Send it on */}
      {mine && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/70 px-6 py-5 ring-1 ring-stone-200">
          <p className="text-sm text-stone-600">
            <span className="font-medium text-stone-900">3 · Send it on.</span> Save your work
            first — it then goes to the CEO for approval.
          </p>
          <StageActions
            id={item.id}
            stage={item.stage}
            canForward={canSubmit}
            canBack={canSendBack}
          />
        </div>
      )}
    </div>
  );
}
