import { STAGES, STAGE_CONFIG, stageIndex } from "@/lib/pipeline";
import { cn, formatDate, toDate } from "@/lib/utils";
import type { ContentItem } from "@/lib/types";
import "./StageRail.css";

/** Timestamp to show under a stage once it has been passed. */
function stamp(stage: string, item: ContentItem) {
  const at = (v: string | null) => formatDate(toDate(v));
  switch (stage) {
    case "planned":
      return at(item.createdAt);
    case "script_review":
      return at(item.scriptSubmittedAt);
    case "shooting":
      return at(item.scriptApprovedAt);
    case "footage_review":
      return at(item.shootCompletedAt);
    case "editing":
      return at(item.editStartedAt);
    case "edit_review":
      return at(item.editSubmittedAt);
    case "ready":
      return at(item.editApprovedAt);
    case "published":
      return at(item.publishedAt);
    default:
      return null;
  }
}

export function StageRail({ item }: { item: ContentItem }) {
  const current = stageIndex(item.stage);

  return (
    <ol className="rail-steps">
      {STAGES.map((stage, i) => {
        const config = STAGE_CONFIG[stage];
        const done = i < current;
        const active = i === current;
        const when = done || active ? stamp(stage, item) : null;

        return (
          <li key={stage} className="rail-step">
            <div className="rail-line-row">
              <span
                className={cn(
                  "rail-line",
                  i === 0 && "rail-line-hidden",
                  (done || active) && "rail-line-on",
                )}
              />
              <span
                className={cn(
                  "rail-node",
                  done && "rail-node-done",
                  active && "rail-node-active",
                )}
              >
                {done ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "rail-line",
                  i === STAGES.length - 1 && "rail-line-hidden",
                  done && "rail-line-on",
                )}
              />
            </div>

            <span className={cn("rail-label", active && "rail-label-active")}>{config.short}</span>
            <span className="rail-stamp">{when ?? ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
