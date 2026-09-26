import Link from "next/link";
import { isOverdue, priority, refLabel, stageConfig } from "@/lib/pipeline";
import { accent } from "@/lib/theme";
import { cn, dueLabel, initials } from "@/lib/utils";
import type { BoardItem } from "./types";

export function ContentList({ items }: { items: BoardItem[] }) {
  return (
    <div className="surface overflow-hidden">
      <div className="hidden grid-cols-[72px_1fr_160px_140px_100px_88px] gap-3 border-b border-stone-200/70 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-stone-500 lg:grid">
        <span>Ref</span>
        <span>Content</span>
        <span>Client</span>
        <span>Stage</span>
        <span>Owner</span>
        <span className="text-right">Step due</span>
      </div>

      <ul className="divide-y divide-stone-200/70">
        {items.map((item) => {
          const stage = stageConfig(item.stage);
          const clientAccent = accent(item.client.accent);
          const late = isOverdue(item.dueDate, item.stage);
          const due = dueLabel(item.dueDate);

          return (
            <li key={item.id}>
              <Link
                href={`/content/${item.id}`}
                className="grid gap-x-3 gap-y-1.5 px-6 py-4 transition-colors hover:bg-stone-100 lg:grid-cols-[72px_1fr_160px_140px_100px_88px] lg:items-center"
              >
                <span className="font-mono text-xs font-medium text-stone-400">
                  {refLabel(item.ref)}
                </span>

                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium tracking-tight">
                    {item.title}
                  </span>
                  {item.priority === "high" && (
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                        priority("high").chip,
                      )}
                    >
                      High
                    </span>
                  )}
                  {item.revisions > 0 && (
                    <span className="shrink-0 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500 ring-1 ring-inset ring-stone-200">
                      {item.revisions} rev
                    </span>
                  )}
                </span>

                <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-stone-500">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", clientAccent.dot)} />
                  <span className="truncate">{item.client.name}</span>
                </span>

                <span>
                  <span
                    className={cn(
                      "inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      stage.chip,
                    )}
                  >
                    {stage.label}
                  </span>
                </span>

                <span className="flex items-center gap-1.5">
                  {item.owner ? (
                    <>
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-semibold ",
                          accent(item.owner.accent).avatar,
                        )}
                      >
                        {initials(item.owner.name)}
                      </span>
                      <span className="truncate text-xs font-semibold text-stone-500">
                        {item.owner.name.split(" ")[0]}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-stone-300">Unassigned</span>
                  )}
                </span>

                <span
                  className={cn(
                    "text-xs font-medium lg:text-right",
                    late ? "text-red-600" : "text-stone-400",
                  )}
                >
                  {due ?? "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
