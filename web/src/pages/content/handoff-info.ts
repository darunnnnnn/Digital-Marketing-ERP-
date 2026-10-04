import { handoff } from "@/lib/pipeline";
import { hasRole } from "@/lib/roles";
import type { ContentItem, Member } from "@/lib/types";
import { dateInputValue, toDate } from "@/lib/utils";
import type { HandoffInfo } from "./StageActions";

/**
 * What the approve dialog needs at a CEO gate: who the video can be handed to,
 * who is already named on it, and the deadline to offer.
 *
 * Built in one place so the video page and the approvals page open the same
 * dialog with the same defaults — approving from the queue has to do exactly
 * what approving from the video does, since both write the same hand-off.
 *
 * Only ever called for someone who may actually approve: it carries the team
 * list and the default assignee, which nobody else's page should receive.
 */
export function buildHandoff(item: ContentItem, team: Member[]): HandoffInfo | null {
  const gate = handoff(item.stage);
  if (!gate) return null;

  const byRole = (...roles: string[]) => team.filter((m) => roles.some((r) => hasRole(m, r)));

  return {
    verb: gate.verb,
    who: gate.who,
    options: byRole(gate.role),
    defaultMemberId: (item[gate.assign] as string | null) ?? "",
    defaultDue: dateInputValue(
      toDate(item[gate.deadline as keyof ContentItem] as string | null),
    ),
    // The script gate also decides whether there is a shoot, and who does the voice over.
    script:
      item.stage === "script_review"
        ? {
            voNeeded: item.voNeeded,
            editors: byRole("editor"),
            voiceovers: byRole("voiceover"),
            defaults: {
              cameramanId: item.cameramanId ?? "",
              shootDue: dateInputValue(toDate(item.shootDue)),
              editorId: item.editorId ?? "",
              editDue: dateInputValue(toDate(item.editDue)),
              voiceoverId: item.voiceoverId ?? "",
              voDue: dateInputValue(toDate(item.voDue)),
              footageUrl: item.footageUrl ?? "",
            },
          }
        : undefined,
  };
}
