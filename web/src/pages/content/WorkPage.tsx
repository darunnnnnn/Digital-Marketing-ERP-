import { Link, Navigate, useParams } from "react-router";
import { MyWork } from "./MyWork";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useViewer } from "@/lib/auth";
import { myWork } from "@/lib/my-work";
import { craftBySlug, workPortals } from "@/lib/roles";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/utils";
import "./WorkPage.css";

/**
 * One desk of someone who holds several roles: /work/script, /work/shoot,
 * /work/edit. The same queue a single-role person gets on the content page,
 * built for just this one role, with a switcher to the others — the sidebar
 * carries the same links, but it is hidden on phones.
 */
export function WorkPage() {
  const viewer = useViewer();
  const { craft: slug = "" } = useParams();
  const portals = workPortals(viewer);
  const craft = craftBySlug(slug);
  const held = craft !== null && portals.some((c) => c.slug === craft.slug);

  const work = useAsync(
    () => (held ? myWork(viewer, craft.role) : Promise.resolve(null)),
    [viewer.id, slug, held],
  );

  // A role they don't hold, or a mistyped address: their first desk.
  if (!held) {
    return <Navigate to={portals.length ? `/work/${portals[0].slug}` : "/content"} replace />;
  }

  if (work.loading && !work.data) return <PageSkeleton />;
  if (work.error)
    return <EmptyState title="Couldn't load your work" description={work.error} />;
  if (!work.data) return <PageSkeleton />;

  return (
    <MyWork
      name={viewer.name}
      work={work.data}
      onChanged={work.reload}
      switcher={
        <nav className="work-tabs" aria-label="Your roles">
          {portals.map((c) => (
            <Link
              key={c.slug}
              to={`/work/${c.slug}`}
              aria-current={c.slug === craft.slug ? "page" : undefined}
              className={cn("work-tab", c.slug === craft.slug && "work-tab-active")}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      }
    />
  );
}
