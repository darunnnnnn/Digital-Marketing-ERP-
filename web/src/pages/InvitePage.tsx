import { useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PanelSkeleton } from "@/components/PageSkeleton";
import { useAuth } from "@/lib/auth";
import { claimInvite, readInvite } from "@/lib/invites";
import { supabase } from "@/lib/supabase";
import { ROLE_LABELS, type Role } from "@/lib/pipeline";
import { useAsync } from "@/lib/use-async";

export function InvitePage() {
  const { token = "" } = useParams();
  const { refresh } = useAuth();
  const { data: invite, loading } = useAsync(() => readInvite(token), [token]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) {
    return (
      <AuthLayout>
        <PanelSkeleton rows={4} />
      </AuthLayout>
    );
  }

  if (!invite) {
    return (
      <AuthLayout>
        <Card className="auth-card auth-card-center">
          <h1 className="auth-title">Link expired</h1>
          <p className="auth-lede">
            This invite has expired or has already been used. Ask your agency owner for a new one.
          </p>
          <Link to="/login" className="auth-link">
            Go to sign in
          </Link>
        </Card>
      </AuthLayout>
    );
  }

  if (done) return <Navigate to="/content" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those two passwords don't match.");

    setBusy(true);
    setError(null);

    // The account is created against the invited address, so it lines up with
    // the Member row that holds their role and agency.
    const { error: signUpError } = await supabase.auth.signUp({
      email: invite!.email,
      password,
    });

    if (signUpError) {
      // Most likely they already set a password from an earlier copy of the link.
      setError(
        /already/i.test(signUpError.message)
          ? "There's already a password for this address. Try signing in instead."
          : signUpError.message,
      );
      setBusy(false);
      return;
    }

    // Spend the link so it can't be reused, then sign in properly.
    await claimInvite(token);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite!.email,
      password,
    });

    if (signInError) {
      // Email confirmation is on for this project, so there's no session yet.
      setError("Password set. Check your email to confirm the address, then sign in.");
      setBusy(false);
      return;
    }

    await refresh();
    setDone(true);
  }

  return (
    <AuthLayout>
      <Card className="auth-card">
        <p className="auth-agency">{invite.agency}</p>
        <h1 className="auth-title" style={{ marginTop: "var(--sp-2)" }}>
          Welcome, {invite.name.split(" ")[0]}
        </h1>
        <p className="auth-lede">
          You&apos;ve been added as{" "}
          <span className="auth-strong">{ROLE_LABELS[invite.role as Role] ?? invite.role}</span>. Set
          a password to sign in as {invite.email}.
        </p>

        <form onSubmit={onSubmit} className="auth-form">
          <Field label="Choose a password" hint="at least 8 characters">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field label="Type it again">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
          {error && <p className="auth-alert">{error}</p>}
          <Button type="submit" disabled={busy} className="btn-block">
            {busy ? "Setting up…" : "Set password and continue"}
          </Button>
        </form>
      </Card>
    </AuthLayout>
  );
}
