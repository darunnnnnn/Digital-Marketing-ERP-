/**
 * Row shapes for the existing Postgres tables, which Prisma created with
 * camelCase column names. PostgREST returns them exactly as named here.
 *
 * Dates arrive from Supabase as ISO strings, not Date objects — everything
 * that does date maths converts first (see `toDate` in utils).
 */

export type Agency = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type Client = {
  id: string;
  agencyId: string;
  name: string;
  industry: string | null;
  status: string;
  accent: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  monthlyTarget: number;
  monthlyPostTarget: number;
  retainer: number;
  /** What this client pays per part of the work — the starting price on every
   *  video planned for them. 0 means no rate agreed; a video then shows no
   *  price at all for that part. */
  scriptPrice: number;
  shootPrice: number;
  editPrice: number;
  services: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Member = {
  id: string;
  agencyId: string;
  name: string;
  role: string;
  /** Every role held, primary included. Empty means just `role` — see lib/roles. */
  roles: string[];
  email: string | null;
  accent: string;
  active: boolean;
  passwordHash: string | null;
  inviteTokenHash: string | null;
  inviteExpires: string | null;
  lastLoginAt: string | null;
  payType: string;
  rate: number;
  salary: number;
  createdAt: string;
};

export type ContentItem = {
  id: string;
  agencyId: string;
  clientId: string;
  ref: number;
  title: string;
  idea: string | null;
  /** An example video to work from. Optional, set when planning. */
  referenceUrl: string | null;
  format: string;
  priority: string;
  stage: string;
  monthKey: string;
  dueDate: string | null;
  /** When the stage last changed. Set by the database, never by the app. */
  stageSince: string | null;

  cycleStart: string | null;
  scriptDue: string | null;
  scriptApprovalDue: string | null;
  shootDue: string | null;
  editDue: string | null;
  finalApprovalDue: string | null;
  publishDue: string | null;

  scriptwriterId: string | null;
  cameramanId: string | null;
  editorId: string | null;
  publisherId: string | null;

  scriptBody: string | null;
  scriptSubmittedAt: string | null;
  scriptApprovedAt: string | null;

  shootDate: string | null;
  shootLocation: string | null;
  shootNotes: string | null;
  shootCompletedAt: string | null;
  footageUrl: string | null;

  /** Set by the scriptwriter. A video that needs one has a voice over step. */
  voNeeded: boolean;
  /** Set by the CEO when approving the script. False means existing footage is reused. */
  shootNeeded: boolean;
  voiceoverId: string | null;
  voDue: string | null;
  voNotes: string | null;
  voUrl: string | null;
  voCompletedAt: string | null;

  editBrief: string | null;
  editStartedAt: string | null;
  editSubmittedAt: string | null;
  editApprovedAt: string | null;
  editUrl: string | null;

  platform: string | null;
  caption: string | null;
  hashtags: string | null;
  thumbnailUrl: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;

  revisions: number;
  notes: string | null;

  // What each part of this piece is worth. Seeded from the client's rates
  // when planned, then adjustable by the CEO at the gate where that part is
  // approved. null means never priced, which falls back to the client's rate
  // rather than showing a misleading 0.
  scriptPrice: number | null;
  shootPrice: number | null;
  editPrice: number | null;

  createdAt: string;
  updatedAt: string;
};

export type ContentEvent = {
  id: string;
  contentId: string;
  kind: string;
  message: string;
  actor: string | null;
  createdAt: string;
};

export type Payout = {
  id: string;
  agencyId: string;
  memberId: string;
  monthKey: string;
  payType: string;
  deliveries: number;
  rate: number;
  salary: number;
  adjustment: number;
  note: string | null;
  amount: number;
  status: string;
  approvedAt: string;
  approvedBy: string | null;
  paidAt: string | null;
};

/** A content row with the joined names the board and lists display. */
export type ContentItemWithNames = ContentItem & {
  client: {
    id: string;
    name: string;
    accent: string;
    scriptPrice: number;
    shootPrice: number;
    editPrice: number;
  } | null;
  scriptwriter: { name: string; accent: string; role: string } | null;
  cameraman: { name: string; accent: string; role: string } | null;
  editor: { name: string; accent: string; role: string } | null;
  publisher: { name: string; accent: string; role: string } | null;
};

/** The signed-in person: their Supabase auth session joined to their Member row. */
export type Viewer = Member & { agency: Agency };
