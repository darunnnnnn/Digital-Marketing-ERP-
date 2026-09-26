import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  barClass = "bg-brand-600",
  className,
}: {
  value: number;
  barClass?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-stone-100", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", barClass)}
        style={{ width: `${pct}%` }}
      />
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
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-stone-100"
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
          className="stroke-brand-600 transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-none">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{label}</span>
        {sublabel && <span className="mt-1 text-xs text-stone-400">{sublabel}</span>}
      </div>
    </div>
  );
}
