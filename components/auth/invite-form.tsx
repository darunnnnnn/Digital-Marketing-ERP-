"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { acceptInvite, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Setting up…" : "Set password and continue"}
    </Button>
  );
}

export function InviteForm({ token }: { token: string }) {
  const [state, action] = useActionState<AuthState, FormData>(
    acceptInvite.bind(null, token),
    {},
  );

  return (
    <form action={action} className="space-y-5">
      <Field label="Choose a password" hint="at least 8 characters">
        <Input name="password" type="password" autoComplete="new-password" autoFocus required />
      </Field>
      <Field label="Type it again">
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      {state.error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>
      )}
      <Submit />
    </form>
  );
}
