import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./Badge.css";

/**
 * A small pill. The tone class comes from the data — `stageConfig(...).chip` and
 * `priority(...).chip` in lib/pipeline.ts hand back one of the `chip-*` classes
 * defined in Badge.css.
 */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("badge", className)}>{children}</span>;
}
