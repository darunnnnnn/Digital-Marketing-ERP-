"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ContentFormState } from "@/app/(app)/content/actions";
import { Button } from "@/components/ui/button";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function PanelForm({
  action,
  panel,
  editable = true,
  children,
}: {
  action: (prev: ContentFormState, fd: FormData) => Promise<ContentFormState>;
  panel: string;
  /** Read-only for people who can see this panel but not change it. */
  editable?: boolean;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState<ContentFormState, FormData>(action, {});
  const error = state.errors?.link ?? state.errors?.panel;

  return (
    <form action={formAction} className="space-y-4 p-5">
      <input type="hidden" name="panel" value={panel} />
      <fieldset disabled={!editable} className="space-y-4 disabled:opacity-80">
        {children}
      </fieldset>
      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
        {editable && <SaveButton />}
      </div>
    </form>
  );
}
