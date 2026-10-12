import { Link } from "react-router";
import { STUCK_HOURS, dueState, isStuck, priority, refLabel, stageConfig } from "@/lib/pipeline";
import { accent } from "@/lib/theme";
import { cn, dueLabel, initials } from "@/lib/utils";
import type { BoardItem } from "./types";
import "./ContentList.css";

export function ContentList({ items }: { items: BoardItem[] }) {
  return (
    <div className="card">
      <div className="list-head">
        <span>Ref</span>
        <span>Content</span>
        <span>Client</span>
        <span>Stage</span>
        <span>Owner</span>
        <span className="list-right">Step due</span>
      </div>

      <ul className="list">
        {items.map((item) => {
          const stage = stageConfig(item.stage);
          const clientAccent = accent(item.client.accent);
          const state = dueState(item.dueDate, item.stage);
          const due = dueLabel(item.dueDate);
          const stalled = state !== "late" && isStuck(item.stageSince, item.stage);

          return (
            <li key={item.id}>
              <Link to={`/content/${item.id}`} className="list-row">
                <span className="list-ref">{refLabel(item.ref)}</span>

                <span className="list-content">
                  <span className="list-title truncate">{item.title}</span>
                  {item.priority === "high" && (
                    <span className={cn("list-tag", priority("high").chip)}>High</span>
                  )}
                  {item.revisions > 0 && (
                    <span className="list-tag chip-neutral">{item.revisions} rev</span>
                  )}
                  {stalled && (
                    <span
                      title={`Hasn't moved in over ${STUCK_HOURS / 24} days`}
                      className="list-tag chip-alert"
                    >
                      Stuck
                    </span>
                  )}
                </span>

                <span className="list-client">
                  <span className="list-dot" style={{ background: clientAccent.dot }} />
                  <span className="truncate">{item.client.name}</span>
                </span>

                <span>
                  <span className={cn("list-stage", stage.chip)}>{stage.label}</span>
                </span>

                <span className="list-owner">
                  {item.owner ? (
                    <>
                      <span className={cn(accent(item.owner.accent).avatar, "list-avatar")}>
                        {initials(item.owner.name)}
                      </span>
                      <span className="list-owner-name truncate">
                        {item.owner.name.split(" ")[0]}
                      </span>
                    </>
                  ) : (
                    <span className="list-unassigned">Unassigned</span>
                  )}
                </span>

                <span
                  className={cn(
                    "list-due",
                    state === "late" && "list-due-late",
                    state === "soon" && "list-due-soon",
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
