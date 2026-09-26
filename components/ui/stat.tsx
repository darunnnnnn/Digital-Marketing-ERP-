import { cn } from "@/lib/utils";

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
  icon?: (p: { className?: string }) => React.ReactElement;
}) {
  const accented = tone === "accent" || tone === "violet" || tone === "blue";
  const alert = tone === "alert";

  return (
    <div className="surface relative overflow-hidden px-6 py-5">
      {/* soft corner glow, like light through frosted glass */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl",
          alert ? "bg-red-200/40" : "bg-brand-200/50",
        )}
      />
      {Icon && (
        <span
          className={cn(
            "relative mb-4 grid h-10 w-10 place-items-center rounded-xl ring-1",
            alert
              ? "bg-red-50 text-red-600 ring-red-100"
              : "bg-brand-50 text-brand-700 ring-brand-100",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="relative text-xs font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </p>
      <p
        className={cn(
          "relative mt-2 text-4xl font-semibold tabular-nums tracking-tight",
          alert ? "text-red-600" : accented ? "text-brand-700" : "text-stone-900",
        )}
      >
        {value}
      </p>
      {hint && <p className="relative mt-1.5 text-sm text-stone-500">{hint}</p>}
    </div>
  );
}
