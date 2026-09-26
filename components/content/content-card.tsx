"use client";

import Link from "next/link";
import { isOverdue, priority, refLabel, stageConfig } from "@/lib/pipeline";
import { accent } from "@/lib/theme";
import { cn, dueLabel, initials } from "@/lib/utils";
import type { BoardItem } from "./types";

export function ContentCard({
  item,
  dragging = false,
  showStage = false,
  onDragStart,
  onDragEnd,
}: {
  item: BoardItem;
  dragging?: boolean;
  showStage?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const stage = stageConfig(item.stage);
  const late = isOverdue(item.dueDate, item.stage);
  const due = dueLabel(item.dueDate);

  return (
    <Link
      href={`/content/${item.id}`}
      draggable={Boolean(onDragStart)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "surface-sm block cursor-grab p-3.5 transition-shadow hover:shadow-md active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] text-stone-400">
        <span className="min-w-0 flex-1 truncate">{item.client.name}</span>
        <span className="shrink-0 font-mono tabular-nums">{refLabel(item.ref)}</span>
      </div>

      <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-stone-900">{item.title}</p>

      <div className="mt-3 flex items-center gap-1.5">
        {showStage && (
          <span
            className={cn("rounded px-1.5 py-0.5 text-[11px] ring-1 ring-inset", stage.chip)}
          >
            {stage.label}
          </span>
        )}

        {item.priority === "high" && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] ring-1 ring-inset",
              priority("high").chip,
            )}
          >
            High
          </span>
        )}

        {item.revisions > 0 && (
          <span className="rounded px-1.5 py-0.5 text-[11px] text-stone-500 ring-1 ring-inset ring-stone-200">
            {item.revisions} rev
          </span>
        )}

        {due && (
          <span
            className={cn(
              "text-[11px] tabular-nums",
              late ? "font-medium text-red-600" : "text-stone-400",
            )}
          >
            {due}
          </span>
        )}

        <span className="ml-auto shrink-0">
          {item.owner ? (
            <span
              title={`${item.owner.name} · ${item.owner.role}`}
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium",
                accent().avatar,
              )}
            >
              {initials(item.owner.name)}
            </span>
          ) : (
            <span
              title="Unassigned"
              className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-stone-300 text-[10px] text-stone-300"
            >
              ?
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}
