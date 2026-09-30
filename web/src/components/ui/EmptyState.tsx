import type { ReactNode } from "react";
import { IconEmpty } from "@/components/icons";
import "./EmptyState.css";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <IconEmpty />
      </span>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-text">{description}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
