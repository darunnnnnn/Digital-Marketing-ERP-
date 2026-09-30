import { cn } from "@/lib/utils";
import "./Progress.css";

export function ProgressBar({
  value,
  color = "var(--brand-600)",
  className,
}: {
  value: number;
  /** A colour token, e.g. `stageConfig(stage).bar`. */
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("progress", className)}
    >
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 80,
  stroke = 6,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ring-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="ring-track"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className="ring-value"
        />
      </svg>
      <div className="ring-center">
        <span className="ring-label tabular">{label}</span>
        {sublabel && <span className="ring-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
}
