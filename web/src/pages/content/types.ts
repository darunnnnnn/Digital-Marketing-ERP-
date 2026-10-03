export type BoardItem = {
  id: string;
  ref: number;
  title: string;
  stage: string;
  priority: string;
  format: string;
  dueDate: Date | null;
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

export type ClientOption = {
  id: string;
  name: string;
  accent: string;
  monthlyTarget: number;
  planned: number;
};
