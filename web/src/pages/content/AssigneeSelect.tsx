import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { setAssignee } from "@/lib/queries";
import type { AssignField } from "@/lib/pipeline";
import { accent } from "@/lib/theme";
import { cn, initials } from "@/lib/utils";
import type { ContentItem, Member } from "@/lib/types";
import type { MemberOption } from "./types";
import "./AssigneeSelect.css";

export function AssigneeSelect({
  item,
  field,
  label,
  options,
  team,
  actor,
  highlight = false,
  disabled = false,
  onChanged,
}: {
  item: ContentItem;
  field: AssignField;
  label: string;
  options: MemberOption[];
  /** The full team, so the write can check the role before sending it. */
  team: Member[];
  actor?: string;
  highlight?: boolean;
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const [value, setValue] = useState(item[field] ?? "");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const current = options.find((o) => o.id === value) ?? null;

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setBusy(true);
    try {
      await setAssignee(item, field, next, team, actor);
      onChanged?.();
    } catch (e) {
      setValue(previous);
      toast.warn(e instanceof Error ? e.message : "Couldn't change the assignment.");
    }
    setBusy(false);
  }

  return (
    <div className={cn("assignee", highlight && "assignee-current")}>
      {current ? (
        <span className={cn(accent(current.accent).avatar, "assignee-avatar")}>
          {initials(current.name)}
        </span>
      ) : (
        <span className="assignee-avatar assignee-avatar-empty">?</span>
      )}

      <span className="assignee-main">
        <span className="assignee-label">{label}</span>
        <select
          value={value}
          disabled={disabled || busy}
          onChange={(e) => void change(e.target.value)}
          aria-label={label}
          className="assignee-select truncate"
        >
          <option value="">Unassigned</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}
