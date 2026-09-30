import { useSearchParams } from "react-router";
import { Board } from "./Board";
import { ContentList } from "./ContentList";
import { ContentToolbar } from "./ContentToolbar";
import { MyWork } from "./MyWork";
import type { BoardItem } from "./types";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { PageSkeleton } from "@/components/PageSkeleton";
import { IconAlert, IconCheckCircle, IconClock, IconFilm, IconPlus } from "@/components/icons";
import { useViewer } from "@/lib/auth";
import { myWork } from "@/lib/my-work";
import { canDrag, canPlan, isCeo, isManager } from "@/lib/permissions";
import { isOverdue, stageConfig } from "@/lib/pipeline";
import { STAGE_DEADLINE } from "@/lib/schedule";
import { countPublished, listContent, listMembers, listClients } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { currentMonthKey, monthLabel, toDate } from "@/lib/utils";
import "../clients/ClientsPage.css";

/**
 * A link to the Plan content page. It used to open a popup, but the form
 * (ideas, deadlines, assignments) is too long for one — it ended up cramped
 * and scrolling inside a small box. A full page has room for all of it.
 */
function NewContentButton({
  defaultClientId,
  label = "Plan content",
}: {
  defaultClientId?: string;
  label?: string;
}) {
  const to = defaultClientId
    ? `/content/new?client=${encodeURIComponent(defaultClientId)}`
    : "/content/new";

  return (
    <LinkButton to={to}>
      <IconPlus />
      {label}
    </LinkButton>
  );
}

export function ContentBoardPage() {
  const viewer = useViewer();
  const [params] = useSearchParams();
  const manager = isManager(viewer);
  const monthKey = currentMonthKey();

  const view = params.get("view") === "list" ? "list" : "board";
  const client = params.get("client") ?? "";
  const owner = params.get("owner") ?? "";
  const q = params.get("q") ?? "";
  const overdue = params.get("overdue") === "1";

  // A scriptwriter, cameraman, editor or posting person has one job: their own
  // queue. The agency board, filters and other people's work are not for them.
  const mine = useAsync(() => (manager ? Promise.resolve(null) : myWork(viewer)), [
    viewer.id,
    manager,
  ]);

  const board = useAsync(async () => {
    if (!manager && mine.data) return null;

    // None of these four depend on each other, so they go out together.
    const [clients, members, rows, published] = await Promise.all([
      listClients(viewer.agencyId),
      listMembers(viewer.agencyId, true),
      listContent(viewer, { client, owner, q }, monthKey),
      countPublished(viewer.agencyId, monthKey),
    ]);

    return {
      clients: clients.filter((c) => c.status !== "archived"),
      members,
      rows,
      published,
    };
  }, [viewer.agencyId, viewer.id, manager, client, owner, q, monthKey, mine.data]);

  if (mine.loading || (board.loading && !board.data)) return <PageSkeleton />;

  // Creative roles: their own queue, and nothing else.
  if (mine.data) return <MyWork name={viewer.name} work={mine.data} onChanged={mine.reload} />;

  if (board.error) return <EmptyState title="Couldn't load the pipeline" description={board.error} />;

  const { clients = [], members = [], rows = [], published = 0 } = board.data ?? {};

  const items: BoardItem[] = rows.map((row) => {
    const field = stageConfig(row.stage).assign;
    const ownerMember =
      field === "scriptwriterId"
        ? row.scriptwriter
        : field === "cameramanId"
          ? row.cameraman
          : field === "editorId"
            ? row.editor
            : field === "publisherId"
              ? row.publisher
              : null;

    const deadlineField = STAGE_DEADLINE[row.stage];

    return {
      id: row.id,
      ref: row.ref,
      title: row.title,
      stage: row.stage,
      priority: row.priority,
      format: row.format,
      // The deadline for the step the video is on right now, not the final one.
      dueDate: deadlineField ? toDate(row[deadlineField] as string | null) : null,
      revisions: row.revisions,
      client: row.client ?? { id: row.clientId, name: "—", accent: "default" },
      owner: ownerMember ?? null,
    };
  });

  const visible = overdue ? items.filter((i) => isOverdue(i.dueDate, i.stage)) : items;

  const overdueCount = items.filter((i) => isOverdue(i.dueDate, i.stage)).length;
  const awaitingApproval = items.filter(
    (i) => i.stage === "script_review" || i.stage === "edit_review",
  ).length;
  const inFlight = items.filter((i) => i.stage !== "published").length;

  const hasAnyContent = items.length > 0;

  return (
    <div className="stack-8">
      <div className="page-head">
        <div>
          <h1 className="page-title">Content pipeline</h1>
          <p className="page-subtitle">
            {manager
              ? `${monthLabel(monthKey)} — every video from idea to published link.`
              : `${monthLabel(monthKey)} — the videos assigned to you.`}
          </p>
        </div>
        {canPlan(viewer) && <NewContentButton />}
      </div>

      <div className="stat-grid">
        <Stat
          icon={IconFilm}
          label="In the pipeline"
          value={inFlight}
          tone="accent"
          hint="not posted yet"
        />
        <Stat
          icon={IconClock}
          label={isCeo(viewer) ? "Awaiting your approval" : "Awaiting CEO approval"}
          value={awaitingApproval}
          hint="scripts and final videos"
        />
        <Stat
          icon={IconAlert}
          label="Overdue"
          value={overdueCount}
          tone={overdueCount > 0 ? "alert" : "slate"}
          hint={overdueCount > 0 ? "behind on their current step" : "every step on time"}
        />
        <Stat icon={IconCheckCircle} label="Posted" value={published} hint="this month" />
      </div>

      <ContentToolbar clients={clients} members={members} overdueCount={overdueCount} />

      {manager && clients.length === 0 ? (
        <EmptyState
          title="Add a client first"
          description="Content is always planned against a client. Create one, then come back and plan their month."
          action={<LinkButton to="/clients">Go to clients</LinkButton>}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={hasAnyContent ? "Nothing matches those filters" : "No content planned yet"}
          description={
            hasAnyContent
              ? "Clear a filter or widen the search to see the rest of the pipeline."
              : manager
                ? "Plan a week of ideas in one go — paste one idea per line and each becomes its own tracked video."
                : "Nothing is assigned to you yet. New work will show up here."
          }
          action={
            hasAnyContent || !canPlan(viewer) ? undefined : (
              <NewContentButton label="Plan your first videos" />
            )
          }
        />
      ) : view === "list" ? (
        <ContentList items={visible} />
      ) : (
        <Board items={visible} draggable={canDrag(viewer)} onMoved={board.reload} />
      )}
    </div>
  );
}
