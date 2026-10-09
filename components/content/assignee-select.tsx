"use client";

import { useRef } from "react";
import { assignMember } from "@/app/(app)/content/actions";
import type { AssignField } from "@/lib/pipeline";
import { accent } from "@/lib/theme";
import { cn, initials } from "@/lib/utils";
import type { MemberOption } from "./types";

export function AssigneeSelect({
  id,
  field,
  label,
  value,
  options,
  highlight = false,
  disabled = false,
}: {
  id: string;
  field: AssignField;
  label: string;
  value: string | null;
  options: MemberOption[];
  highlight?: boolean;
  disabled?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const current = options.find((o) => o.id === value) ?? null;

  return (
    <form
      ref={formRef}
      action={assignMember}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
        highlight ? "border-brand-200 bg-brand-50/60" : "border-transparent hover:bg-stone-100",
      )}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />

      {current ? (
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-semibold ",
            accent(current.accent).avatar,
          )}
        >
          {initials(current.name)}
        </span>
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-dashed border-stone-300 text-xs font-medium text-stone-300">
          ?
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium text-stone-400">{label}</span>
        <select
          name="memberId"
          disabled={disabled}
          defaultValue={value ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          className="-ml-0.5 w-full cursor-pointer truncate rounded-md bg-transparent px-0.5 text-base font-medium outline-none focus:ring-1 focus:ring-brand-600 sm:text-sm"
        >
          <option value="">Unassigned</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </span>
    </form>
  );
}
