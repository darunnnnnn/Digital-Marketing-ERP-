import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import "./Stat.css";

/**
 * A headline number. `tone` picks emphasis, not a new colour:
 *   accent — evergreen, for the number that matters
 *   alert  — red, only when something is genuinely behind
 */
export function Stat({
  label,
  value,
  tone = "slate",
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  tone?: "slate" | "violet" | "emerald" | "amber" | "blue" | "accent" | "alert";
  hint?: string;
  icon?: (p: { className?: string }) => ReactElement;
}) {
  const accented = tone === "accent" || tone === "violet" || tone === "blue";
  const alert = tone === "alert";

  return (
    <div className={cn("stat", alert && "stat-alert")}>
      {/* soft corner glow, like light through frosted glass */}
      <span aria-hidden className="stat-glow" />
      {Icon && (
        <span className="stat-icon">
          <Icon />
        </span>
      )}
      <p className="stat-label">{label}</p>
      <p className={cn("stat-value", "tabular", accented && "stat-value-accent")}>{value}</p>
      {hint && <p className="stat-hint">{hint}</p>}
    </div>
  );
}
