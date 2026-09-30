import { useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth";

/** Only ever send people to a path inside this app, never to another site. */
function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/content";
  return next;
}

export function LoginPage() {
  const [params] = useSearchParams();
  const { viewer, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in — don't make them do it twice.
  if (!loading && viewer) return <Navigate to={safeNext(params.get("next"))} replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  }

  return (
    <AuthLayout>
      <Card className="auth-card">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-lede">Sign in to your agency workspace.</p>

        <form onSubmit={onSubmit} className="auth-form">
          <Field label="Email">
            <Input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
              autoFocus
              required
            />
          </Field>
          <Field label="Password">
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && <p className="auth-alert">{error}</p>}
          <Button type="submit" disabled={busy} className="btn-block">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="auth-note">No account? Ask your agency owner for an invite link.</p>
      </Card>
    </AuthLayout>
  );
}
