import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./Card.css";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="card-head">
      <h2 className="card-title">{title}</h2>
      {action}
    </div>
  );
}
