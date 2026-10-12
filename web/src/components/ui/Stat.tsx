import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import "./Stat.css";

/**
 * A headline number. `tone` picks emphasis, not a new colour:
 *   accent — evergreen, for the number that matters
 *   alert  — red, only when something is genuinely behind
 *
 * Give it `onClick` and the whole card becomes a button — a tile that filters
 * the list below it. `active` is then the one currently filtering.
 */
export function Stat({
  label,
  value,
  tone = "slate",
  hint,
  icon: Icon,
  onClick,
  active = false,
}: {
  label: string;
  value: number | string;
  tone?: "slate" | "violet" | "emerald" | "amber" | "blue" | "accent" | "alert";
  hint?: string;
  icon?: (p: { className?: string }) => ReactElement;
  onClick?: () => void;
  active?: boolean;
}) {
  const accented = tone === "accent" || tone === "violet" || tone === "blue";
  const alert = tone === "alert";
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      className={cn("stat", alert && "stat-alert", onClick && "stat-pick", active && "stat-on")}
      {...(onClick
        ? { type: "button" as const, onClick, "aria-pressed": active }
        : {})}
    >
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
    </Tag>
  );
}
