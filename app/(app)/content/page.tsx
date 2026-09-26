import { Suspense } from "react";
import { Board } from "@/components/content/board";
import { MyWork } from "@/components/content/my-work";
import { ContentList } from "@/components/content/content-list";
import { ContentToolbar } from "@/components/content/content-toolbar";
import { NewContentButton } from "@/components/content/new-content-button";
import type { BoardItem } from "@/components/content/types";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { IconAlert, IconCheckCircle, IconClock, IconFilm } from "@/components/icons";
import { Stat } from "@/components/ui/stat";
import { requireUser } from "@/lib/auth";
import { myWork } from "@/lib/my-work";
import { canDrag, canPlan, isCeo, isManager } from "@/lib/permissions";
import { db } from "@/lib/db";
import { insensitive } from "@/lib/search";
import { isOverdue, stageConfig } from "@/lib/pipeline";
import { STAGE_DEADLINE } from "@/lib/schedule";
import { currentMonthKey, monthLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = {
  view?: string;
  client?: string;
  owner?: string;
  q?: string;
  overdue?: string;
};

export default async function ContentPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { view = "board", client = "", owner = "", q = "", overdue = "" } = await searchParams;

  const user = await requireUser();
  const agency = user.agency;
  const manager = isManager(user);

  // A scriptwriter, cameraman, editor or posting person has one job: their own
  // queue. The agency board, filters and other people's work are not for them.
  if (!manager) {
    const work = await myWork(user);
    if (work) return <MyWork name={user.name} work={work} />;
  }
  const monthKey = currentMonthKey();

  // None of these four depend on each other, so they go out together —
  // one Tokyo round trip instead of three.
  const [clientRows, members, rows, publishedThisMonth] = await Promise.all([
    db.client.findMany({
      where: { agencyId: agency.id, status: { not: "archived" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, accent: true, monthlyTarget: true },
    }),
    db.member.findMany({
      where: { agencyId: agency.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, accent: true },
    }),
    db.contentItem.findMany({
    where: {
      agencyId: agency.id,
      ...(client ? { clientId: client } : {}),
      ...(q ? { title: { contains: q, ...insensitive } } : {}),
      // Kept as an AND list so the two OR groups don't overwrite each other.
      AND: [
        // Everything for this month, plus anything older still in flight.
        { OR: [{ monthKey }, { stage: { not: "published" } }] },
        // Creative roles only ever see videos they are assigned to.
        ...(manager
          ? []
          : [
              {
                OR: [
                  { scriptwriterId: user.id },
                  { cameramanId: user.id },
                  { editorId: user.id },
                  { publisherId: user.id },
                ],
              },
            ]),
        ...(owner
          ? [
              {
                OR: [
                  { scriptwriterId: owner },
                  { cameramanId: owner },
                  { editorId: owner },
                  { publisherId: owner },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ dueDate: "asc" }, { ref: "asc" }],
    include: {
      client: { select: { id: true, name: true, accent: true } },
      scriptwriter: { select: { name: true, accent: true, role: true } },
      cameraman: { select: { name: true, accent: true, role: true } },
      editor: { select: { name: true, accent: true, role: true } },
      publisher: { select: { name: true, accent: true, role: true } },
      },
    }),
    db.contentItem.count({
      where: { agencyId: agency.id, monthKey, stage: "published" },
    }),
  ]);

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

    return {
      id: row.id,
      ref: row.ref,
      title: row.title,
      stage: row.stage,
      priority: row.priority,
      format: row.format,
      // The deadline for the step the video is on right now, not the final one.
      dueDate: STAGE_DEADLINE[row.stage] ? row[STAGE_DEADLINE[row.stage]!] : null,
      revisions: row.revisions,
      client: row.client,
      owner: ownerMember ?? null,
    };
  });

  const visible = overdue === "1" ? items.filter((i) => isOverdue(i.dueDate, i.stage)) : items;

  const overdueCount = items.filter((i) => isOverdue(i.dueDate, i.stage)).length;
  const awaitingApproval = items.filter(
    (i) => i.stage === "script_review" || i.stage === "edit_review",
  ).length;
  const inFlight = items.filter((i) => i.stage !== "published").length;

  const clientOptions = clientRows;

  const hasAnyContent = items.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Content pipeline
          </h1>
          <p className="mt-2 text-base text-stone-500">
            {manager
              ? `${monthLabel(monthKey)} — every video from idea to published link.`
              : `${monthLabel(monthKey)} — the videos assigned to you.`}
          </p>
        </div>
        {canPlan(user) && (
          <NewContentButton />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={IconFilm}
          label="In the pipeline"
          value={inFlight}
          tone="accent"
          hint="not posted yet"
        />
        <Stat
          icon={IconClock}
          label={isCeo(user) ? "Awaiting your approval" : "Awaiting CEO approval"}
          value={awaitingApproval}
          tone="slate"
          hint="scripts and final videos"
        />
        <Stat
          icon={IconAlert}
          label="Overdue"
          value={overdueCount}
          tone={overdueCount > 0 ? "alert" : "slate"}
          hint={overdueCount > 0 ? "behind on their current step" : "every step on time"}
        />
        <Stat
          icon={IconCheckCircle}
          label="Posted"
          value={publishedThisMonth}
          hint="this month"
        />
      </div>

      <Suspense fallback={null}>
        <ContentToolbar clients={clientOptions} members={members} overdueCount={overdueCount} />
      </Suspense>

      {manager && clientOptions.length === 0 ? (
        <EmptyState
          title="Add a client first"
          description="Content is always planned against a client. Create one, then come back and plan their month."
          action={<LinkButton href="/clients">Go to clients</LinkButton>}
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
            hasAnyContent || !canPlan(user) ? undefined : (
              <NewContentButton label="Plan your first videos" />
            )
          }
        />
      ) : view === "list" ? (
        <ContentList items={visible} />
      ) : (
        <Board items={visible} draggable={canDrag(user)} />
      )}
    </div>
  );
}
