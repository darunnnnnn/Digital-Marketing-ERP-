import { cn } from "@/lib/utils";
import "./Field.css";
import "./YesNoField.css";

/**
 * A Yes / No choice, as two pills. Radio inputs underneath, so inside a form it
 * submits "yes" or "no" like any other named field and needs no state; outside
 * one, pass `value` and `onChange` and it is controlled.
 *
 * Not built on <Field>: that is a <label>, and a label around a radio group
 * would flip the first option whenever anything in the row was clicked.
 */
export function YesNoField({
  label,
  hint,
  name,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  hint?: string;
  name: string;
  value?: boolean;
  defaultValue?: boolean;
  onChange?: (value: boolean) => void;
}) {
  const controlled = value !== undefined;

  return (
    <div className="field" role="radiogroup" aria-label={label}>
      <span className="field-label-row">
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <div className="yesno">
        {([true, false] as const).map((option) => (
          <label key={String(option)} className="yesno-option">
            <input
              type="radio"
              name={name}
              value={option ? "yes" : "no"}
              {...(controlled
                ? { checked: value === option, onChange: () => onChange?.(option) }
                : { defaultChecked: (defaultValue ?? false) === option })}
            />
            <span className={cn("yesno-pill", option ? "yesno-yes" : "yesno-no")}>
              {option ? "Yes" : "No"}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
