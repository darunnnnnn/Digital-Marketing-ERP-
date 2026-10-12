export type BoardItem = {
  id: string;
  ref: number;
  title: string;
  stage: string;
  priority: string;
  format: string;
  dueDate: Date | null;
  /** When it last changed stage, for "nothing has moved in three days". */
  stageSince: Date | null;
  revisions: number;
  client: { id: string; name: string; accent: string };
  owner: { name: string; accent: string; role: string } | null;
};

export type MemberOption = {
  id: string;
  name: string;
  role: string;
  roles?: string[] | null;
  accent: string;
};

/** The slice of a client the quick-add modal needs — any client row qualifies. */
export type QuickAddClient = {
  id: string;
  name: string;
  scriptPrice: number;
  shootPrice: number;
  editPrice: number;
};

export type ClientOption = {
  id: string;
  name: string;
  accent: string;
  monthlyTarget: number;
  planned: number;
  /** The client's standard rates, so a new video can be seeded from them. */
  scriptPrice: number;
  shootPrice: number;
  editPrice: number;
};
