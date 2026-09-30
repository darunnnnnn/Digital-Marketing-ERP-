import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import "./Field.css";

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
  children: ReactNode;
}) {
  return (
    <label className={cn("field", className)}>
      <span className="field-label-row">
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

// autoComplete="off" by default — without it, Chrome guesses these are address
// or payment fields and pops its own suggestion list over them (that's the
// "Manage addresses…" dropdown, not anything this app renders). A caller that
// actually wants autofill (email, password) passes its own autoComplete and it
// wins, since props are spread after this default.
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input autoComplete="off" {...props} className={cn("control", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      autoComplete="off"
      {...props}
      className={cn("control", "control-textarea", props.className)}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      autoComplete="off"
      {...props}
      className={cn("control", "control-select", props.className)}
    />
  );
}
