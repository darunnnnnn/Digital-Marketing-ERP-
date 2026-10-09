import { cn } from "@/lib/utils";

/**
 * A headline number. `tone` picks emphasis, not a new colour:
 *   accent — evergreen, for the number that matters
 *   alert  — red, only when something is genuinely behind
 *
 * Sized to sit two-up on a phone, so a row of four reads as one glance
 * rather than four screens of scrolling.
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
    <div className="surface relative overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
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
            "relative mb-2.5 grid h-9 w-9 place-items-center rounded-xl ring-1 sm:mb-4 sm:h-10 sm:w-10",
            alert
              ? "bg-red-50 text-red-600 ring-red-100"
              : "bg-brand-50 text-brand-700 ring-brand-100",
          )}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      )}
      <p className="relative text-[11px] font-semibold uppercase tracking-wider text-stone-500 sm:text-xs">
        {label}
      </p>
      <p
        className={cn(
          // A long rupee total would otherwise push the tile wider than its
          // column, so the number wraps inside the tile instead.
          "relative mt-1 break-words text-2xl font-semibold tabular-nums tracking-tight sm:mt-2 sm:text-3xl lg:text-4xl",
          alert ? "text-red-600" : accented ? "text-brand-700" : "text-stone-900",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="relative mt-1 text-xs text-stone-500 sm:mt-1.5 sm:text-sm">{hint}</p>
      )}
    </div>
  );
}
