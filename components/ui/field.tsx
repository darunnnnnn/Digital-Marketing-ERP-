import { cn } from "@/lib/utils";

// text-base below sm is deliberate: iOS Safari zooms the page in when a
// focused control's text is under 16px, leaving the user pinched in on a
// half-visible form.
const CONTROL_BASE =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-base text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 sm:text-sm";

const CONTROL = `${CONTROL_BASE} py-3 sm:py-2.5`;

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

// autoComplete="off" by default — without it, Chrome guesses these are address
// or payment fields and pops its own suggestion list over them (that's the
// "Manage addresses…" dropdown, not anything this app renders). A caller that
// actually wants autofill (email, password) passes its own autoComplete and it
// wins, since props are spread after this default.
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input autoComplete="off" {...props} className={cn(CONTROL, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      autoComplete="off"
      {...props}
      className={cn(CONTROL_BASE, "py-2.5 resize-none", props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      autoComplete="off"
      {...props}
      className={cn(CONTROL, "cursor-pointer", props.className)}
    />
  );
}
