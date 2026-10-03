import type { ReactNode } from "react";
import { Link } from "react-router";
import { IconChevronLeft } from "@/components/icons";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ROLE_TASK } from "@/lib/my-work";
import { isOverdue, refLabel, stageConfig } from "@/lib/pipeline";
import { STAGE_DEADLINE } from "@/lib/schedule";
import { cn, dateInputValue, dueLabel, formatCalendar, timeAgo, toDate } from "@/lib/utils";
import type { ContentEvent, ContentItemWithNames } from "@/lib/types";
import { PanelForm } from "./PanelForm";
import { StageActions } from "./StageActions";
import "./TaskView.css";

/** Read-only material the person needs in order to do their step. */
function Reference({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="ref-label">{label}</p>
      <div className="ref-body">{children}</div>
    </div>
  );
}

/**
 * What a scriptwriter, cameraman, editor or posting person sees instead of the
 * full video page: what they were given, the one panel they fill in, and the
 * button that hands it on. Three numbered steps, nothing else.
 */
export function TaskView({
  item,
  events,
  role,
  panel,
  actor,
  canSubmit,
  canSendBack,
  onChanged,
  backTo = "/content",
}: {
  item: ContentItemWithNames;
  events: ContentEvent[];
  role: string;
  panel: string;
  actor?: string;
  canSubmit: boolean;
  canSendBack: boolean;
  onChanged: () => void;
  /** Their queue this came from: /work/edit for someone with several roles. */
  backTo?: string;
}) {
  const stage = stageConfig(item.stage);
  const dueField = STAGE_DEADLINE[item.stage];
  const due = dueField ? toDate(item[dueField]) : null;
  const late = isOverdue(due, item.stage);
  const task = ROLE_TASK[role];
  const mine = panel === "script" ? item.stage === "scripting" : canSubmit;

  // The most recent thing the CEO said, so changes asked for aren't buried.
  const message = events.find((e) => e.kind === "revision" || e.kind === "note");
  const messageAt = message ? toDate(message.createdAt) : null;

  return (
    <div className="task-page stack-6">
      <Link to={backTo} className="back-link">
        <IconChevronLeft />
        Your work
      </Link>

      {/* What and when */}
      <div className="card task-head">
        <p className="task-head-client">
          {item.client?.name ?? "—"} · <span className="task-head-ref">{refLabel(item.ref)}</span>
        </p>
        <h1 className="task-head-title">{item.title}</h1>

        <div className="task-head-tags">
          <span className={cn("task-pill", stage.chip)}>{stage.label}</span>
          {due && (
            <span className={cn("task-pill", late ? "task-pill-late" : "task-pill-due")}>
              {dueLabel(due)} · {formatCalendar(due)}
            </span>
          )}
        </div>

        {!mine && (
          <p className="task-done">
            {task ? `Your ${task.noun} is done.` : "Your part is done."} This is with{" "}
            {stage.owner === "ceo" ? "the CEO" : `the ${stage.owner}`} now — nothing for you to do.
          </p>
        )}

        {message && (
          <div className="task-message">
            <p className="task-message-label">
              {message.kind === "revision" ? "Changes requested" : "Note"}
            </p>
            <p className="task-message-body">{message.message}</p>
            <p className="task-message-meta">
              {message.actor ? `${message.actor} · ` : ""}
              {messageAt ? timeAgo(messageAt) : ""}
            </p>
          </div>
        )}
      </div>

      {/* What they were given */}
      {(item.idea ||
        item.referenceUrl ||
        item.scriptBody ||
        item.footageUrl ||
        item.shootNotes ||
        item.editBrief) && (
        <Card>
          <CardHeader title="1 · What you need" />
          <div className="refs">
            {panel === "script" && item.idea && <Reference label="The idea">{item.idea}</Reference>}

            {/* The reference is what the writer and the camera team work from. */}
            {(panel === "script" || panel === "shoot") && item.referenceUrl && (
              <Reference label="Reference video">
                <a
                  href={item.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ref-link"
                >
                  Open the reference
                </a>
              </Reference>
            )}

            {(panel === "shoot" || panel === "edit") && item.scriptBody && (
              <Reference label="Approved script">
                <pre className="ref-script">{item.scriptBody}</pre>
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
                  className="ref-link"
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
                  className="ref-link"
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
        <PanelForm id={item.id} panel={panel} editable={mine} onSaved={onChanged}>
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
                  className="task-script"
                />
              </Field>
            </>
          )}

          {panel === "shoot" && (
            <>
              <div className="panel-pair">
                <Field label="Shoot date">
                  <Input
                    type="date"
                    name="shootDate"
                    defaultValue={dateInputValue(toDate(item.shootDate))}
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
              <div className="panel-pair">
                <Field label="Platform">
                  <Input name="platform" defaultValue={item.platform ?? ""} />
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
                <Textarea name="caption" rows={3} defaultValue={item.caption ?? ""} />
              </Field>
              <div className="panel-pair">
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
        <div className="task-send">
          <p className="task-send-note">
            <strong>3 · Send it on.</strong> Save your work first — it then goes to the CEO for
            approval.
          </p>
          <StageActions
            item={item}
            canForward={canSubmit}
            canBack={canSendBack}
            team={[]}
            actor={actor}
            onChanged={onChanged}
          />
        </div>
      )}
    </div>
  );
}
