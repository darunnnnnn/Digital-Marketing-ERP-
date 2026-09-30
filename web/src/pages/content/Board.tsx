import { useEffect, useState } from "react";
import { STAGES, STAGE_CONFIG, type Stage } from "@/lib/pipeline";
import { moveToStage } from "@/lib/queries";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { ContentCard } from "./ContentCard";
import type { BoardItem } from "./types";
import "./Board.css";

export function Board({
  items,
  draggable = false,
  onMoved,
}: {
  items: BoardItem[];
  draggable?: boolean;
  onMoved?: () => void;
}) {
  const [local, setLocal] = useState(items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const toast = useToast();

  // The database is the source of truth; re-sync whenever fresh data arrives.
  useEffect(() => setLocal(items), [items]);

  async function drop(stage: Stage) {
    const id = draggingId;
    setDraggingId(null);
    setOverStage(null);
    if (!id) return;

    const item = local.find((i) => i.id === id);
    if (!item || item.stage === stage) return;

    // Move the card straight away, then put it back if the write is refused.
    const from = item.stage;
    setLocal((prev) => prev.map((i) => (i.id === id ? { ...i, stage } : i)));
    try {
      await moveToStage({ id, stage: from }, stage);
      onMoved?.();
    } catch (e) {
      setLocal((prev) => prev.map((i) => (i.id === id ? { ...i, stage: from } : i)));
      toast.warn(e instanceof Error ? e.message : "Couldn't move that video.");
    }
  }

  return (
    <div className="board-scroll">
      <div className="board">
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
                void drop(stage);
              }}
              className={cn("column", isOver && "column-over")}
            >
              <header className="column-head">
                <span className="column-dot" style={{ background: config.dot }} />
                <h2 className="column-label">{config.label}</h2>
                <span className="column-count tabular">{column.length}</span>
              </header>

              <div className="column-body">
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
                  <div className={cn("column-drop", isOver && "column-drop-over")}>
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
