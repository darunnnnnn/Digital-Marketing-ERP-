// Who may do what. Every server action checks these before it touches data;
// the UI reads the same functions only to decide which buttons to show.
//
//   CEO                  everything; the only role that can approve
//   Social media manager everything except approvals and team management
//   Creative roles       only videos they are assigned to, only their own step

export type Viewer = { id: string; role: string };

type Assignable = {
  stage: string;
  scriptwriterId: string | null;
  cameramanId: string | null;
  voiceoverId?: string | null;
  editorId: string | null;
  publisherId: string | null;
};

export const isCeo = (v: Viewer) => v.role === "ceo";
export const isManager = (v: Viewer) => v.role === "ceo" || v.role === "manager";

function assignedTo(v: Viewer, item: Assignable) {
  return [
    item.scriptwriterId,
    item.cameramanId,
    item.voiceoverId,
    item.editorId,
    item.publisherId,
  ].includes(v.id);
}

export function canSeeItem(v: Viewer, item: Assignable) {
  return isManager(v) || assignedTo(v, item);
}

/** Pressing the stage's forward button. */
export function canAdvance(v: Viewer, item: Assignable) {
  switch (item.stage) {
    case "planned":
      return isManager(v);
    case "scripting":
      return isManager(v) || item.scriptwriterId === v.id;
    case "script_review":
    case "footage_review":
    case "edit_review":
      return isCeo(v); // the three CEO gates
    case "shooting":
      // The shoot and the voice over each have their own person.
      return isManager(v) || item.cameramanId === v.id || item.voiceoverId === v.id;
    case "editing":
      return isManager(v) || item.editorId === v.id;
    case "ready":
      return isManager(v) || item.publisherId === v.id;
    default:
      return false;
  }
}

/** Sending a video back a stage. */
export function canSendBack(v: Viewer, item: Assignable) {
  switch (item.stage) {
    case "script_review":
    case "footage_review":
    case "edit_review":
      return isCeo(v); // sending back is part of approving
    case "editing":
      return isManager(v) || item.editorId === v.id; // footage unusable
    case "ready":
      return isManager(v) || item.publisherId === v.id;
    case "published":
      return isManager(v);
    default:
      return false;
  }
}

/** Dragging on the board can jump straight past an approval, so only the CEO may. */
export const canDrag = (v: Viewer) => isCeo(v);

export const canPlan = (v: Viewer) => isManager(v);
export const canAssign = (v: Viewer) => isManager(v);
export const canDeleteContent = (v: Viewer) => isManager(v);
export const canManageClients = (v: Viewer) => isManager(v);
export const canManageTeam = (v: Viewer) => isCeo(v);
/** Money: rates, approvals and marking paid. */
export const canManagePayouts = (v: Viewer) => isCeo(v);

/** Editing one panel of the video page. */
export function canEditPanel(v: Viewer, item: Assignable, panel: string) {
  if (isManager(v)) return true;
  switch (panel) {
    case "script":
      return item.scriptwriterId === v.id;
    case "shoot":
      return item.cameramanId === v.id;
    case "vo":
      return item.voiceoverId === v.id;
    case "edit":
      return item.editorId === v.id;
    case "post":
      return item.publisherId === v.id;
    default:
      return false; // brief and schedule are managers only
  }
}

/** Anyone who can see a video can leave a note on it. */
export const canNote = canSeeItem;
