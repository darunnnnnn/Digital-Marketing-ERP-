import { Link } from "react-router";
import { isOverdue, priority, refLabel, stageConfig } from "@/lib/pipeline";
import { accent } from "@/lib/theme";
import { cn, dueLabel, initials } from "@/lib/utils";
import type { BoardItem } from "./types";
import "./ContentCard.css";

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
      to={`/content/${item.id}`}
      draggable={Boolean(onDragStart)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={cn("item", dragging && "item-dragging")}
    >
      <div className="item-top">
        <span className="item-client truncate">{item.client.name}</span>
        <span className="item-ref tabular">{refLabel(item.ref)}</span>
      </div>

      <p className="item-title">{item.title}</p>

      <div className="item-foot">
        {showStage && <span className={cn("item-tag", stage.chip)}>{stage.label}</span>}

        {item.priority === "high" && (
          <span className={cn("item-tag", priority("high").chip)}>High</span>
        )}

        {item.revisions > 0 && <span className="item-tag item-tag-plain">{item.revisions} rev</span>}

        {due && <span className={cn("item-due", "tabular", late && "item-due-late")}>{due}</span>}

        <span className="item-owner">
          {item.owner ? (
            <span
              title={`${item.owner.name} · ${item.owner.role}`}
              className={cn(accent().avatar, "item-avatar")}
            >
              {initials(item.owner.name)}
            </span>
          ) : (
            <span title="Unassigned" className="item-avatar item-avatar-empty">
              ?
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}
