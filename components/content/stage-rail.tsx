import { STAGES, STAGE_CONFIG, stageIndex } from "@/lib/pipeline";
import { cn, formatDate } from "@/lib/utils";

/** Timestamp to show under a stage once it has been passed. */
function stamp(
  stage: string,
  item: {
    createdAt: Date;
    scriptSubmittedAt: Date | null;
    scriptApprovedAt: Date | null;
    shootCompletedAt: Date | null;
    editStartedAt: Date | null;
    editSubmittedAt: Date | null;
    editApprovedAt: Date | null;
    publishedAt: Date | null;
  },
) {
  switch (stage) {
    case "planned":
      return formatDate(item.createdAt);
    case "script_review":
      return formatDate(item.scriptSubmittedAt);
    case "shooting":
      return formatDate(item.scriptApprovedAt);
    case "footage_review":
      return formatDate(item.shootCompletedAt);
    case "editing":
      return formatDate(item.editStartedAt);
    case "edit_review":
      return formatDate(item.editSubmittedAt);
    case "ready":
      return formatDate(item.editApprovedAt);
    case "published":
      return formatDate(item.publishedAt);
    default:
      return null;
  }
}

export function StageRail({
  item,
}: {
  item: {
    stage: string;
    createdAt: Date;
    scriptSubmittedAt: Date | null;
    scriptApprovedAt: Date | null;
    shootCompletedAt: Date | null;
    editStartedAt: Date | null;
    editSubmittedAt: Date | null;
    editApprovedAt: Date | null;
    publishedAt: Date | null;
  };
}) {
  const current = stageIndex(item.stage);

  return (
    <ol className="rail -mx-1 items-start gap-1 px-1 pb-1">
      {STAGES.map((stage, i) => {
        const config = STAGE_CONFIG[stage];
        const done = i < current;
        const active = i === current;
        const when = done || active ? stamp(stage, item) : null;

        return (
          <li
            key={stage}
            className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 sm:w-auto sm:min-w-0 sm:flex-1"
          >
            <div className="flex w-full items-center gap-1">
              <span
                className={cn(
                  "h-0.5 flex-1 transition-colors",
                  i === 0 ? "opacity-0" : done || active ? "bg-brand-600" : "bg-stone-200",
                )}
              />
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-medium transition-colors",
                  done && "bg-brand-600 text-white",
                  active && "bg-stone-50 text-brand-600 ring-2 ring-brand-600",
                  !done && !active && "bg-stone-100 text-stone-400",
                )}
              >
                {done ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
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
                  "h-0.5 flex-1 transition-colors",
                  i === STAGES.length - 1
                    ? "opacity-0"
                    : done
                      ? "bg-brand-600"
                      : "bg-stone-200",
                )}
              />
            </div>

            <span
              className={cn(
                "text-center text-[11px] leading-tight",
                active ? "font-medium text-stone-900" : "text-stone-400",
              )}
            >
              {config.short}
            </span>
            <span className="h-3 text-[11px] text-stone-400">{when ?? ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
