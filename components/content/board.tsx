"use client";

import { useEffect, useState, useTransition } from "react";
import { moveToStage } from "@/app/(app)/content/actions";
import { STAGES, STAGE_CONFIG, type Stage } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { ContentCard } from "./content-card";
import type { BoardItem } from "./types";

export function Board({
  items,
  draggable = false,
}: {
  items: BoardItem[];
  draggable?: boolean;
}) {
  const [local, setLocal] = useState(items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [, startTransition] = useTransition();

  // Server is the source of truth; re-sync whenever it sends fresh data.
  useEffect(() => setLocal(items), [items]);

  function drop(stage: Stage) {
    const id = draggingId;
    setDraggingId(null);
    setOverStage(null);
    if (!id) return;

    const item = local.find((i) => i.id === id);
    if (!item || item.stage === stage) return;

    setLocal((prev) => prev.map((i) => (i.id === id ? { ...i, stage } : i)));
    startTransition(() => {
      void moveToStage(id, stage);
    });
  }

  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-2 lg:-mx-8 lg:px-8">
      <div className="flex min-w-max gap-2.5">
        {STAGES.map((stage) => {
          const config = STAGE_CONFIG[stage];
          const column = local.filter((i) => i.stage === stage);
          const isOver = overStage === stage;

          return (
            <section
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStage !== stage) setOverStage(stage);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(stage);
              }}
              className={cn(
                "flex w-[272px] shrink-0 flex-col rounded-3xl border p-2.5 backdrop-blur transition-colors",
                isOver ? "border-brand-400 bg-brand-50/80" : "border-white/80 bg-white/45",
              )}
            >
              <header className="flex items-center gap-2 px-1.5 py-2">
                <span className={cn("h-2 w-2 rounded-full", config.dot)} />
                <h2 className="text-xs font-medium text-stone-700">{config.label}</h2>
                <span className="ml-auto text-[11px] tabular-nums text-stone-400">
                  {column.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {column.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    dragging={draggingId === item.id}
                    onDragStart={draggable ? () => setDraggingId(item.id) : undefined}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStage(null);
                    }}
                  />
                ))}

                {column.length === 0 && (
                  <div
                    className={cn(
                      "grid flex-1 place-items-center rounded-lg border border-dashed px-3 py-8 text-center text-xs",
                      isOver
                        ? "border-brand-300 text-brand-600"
                        : "border-stone-200 text-stone-400",
                    )}
                  >
                    {isOver ? "Drop here" : "Nothing here"}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
