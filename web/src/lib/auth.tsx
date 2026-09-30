import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { Agency, Member, Viewer } from "./types";

/**
 * Sign-in runs through Supabase Auth. Each auth account is matched to its row
 * in Member by email, which is where role, agency and pay settings live — so
 * every existing team member, assignment and payout carries over untouched.
 *
 * This context is for rendering only. What a person may actually read or
 * change is enforced by row level security in the database, so hiding a button
 * here is a convenience, never the protection.
 */

type AuthState = {
  viewer: Viewer | null;
  /** True until the first session check finishes, so we don't flash the login page. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

async function loadViewer(): Promise<Viewer | null> {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return null;

  const { data: member } = await supabase
    .from("Member")
    .select("*, agency:Agency(*)")
    .eq("email", email.toLowerCase())
    .eq("active", true)
    .maybeSingle<Member & { agency: Agency }>();

  // Signed in with Supabase but no active team record: not a usable account.
  if (!member || !member.agency) {
    await supabase.auth.signOut();
    return null;
  }

  return member as Viewer;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    loadViewer()
      .then((v) => alive && setViewer(v))
      .finally(() => alive && setLoading(false));

    // Keeps tabs in step: signing out in one signs out the others.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setViewer(null);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadViewer().then((v) => alive && setViewer(v));
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    viewer,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      // One message for every failure, so the form never confirms which
      // addresses exist.
      if (error) return "That email and password don't match.";

      const v = await loadViewer();
      if (!v) return "That account isn't set up on a team yet. Ask your agency owner.";

      setViewer(v);
      await supabase
        .from("Member")
        .update({ lastLoginAt: new Date().toISOString() })
        .eq("id", v.id);
      return null;
    },
    async signOut() {
      await supabase.auth.signOut();
      setViewer(null);
    },
    async refresh() {
      setViewer(await loadViewer());
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The signed-in person. Only call inside routes that require a session. */
export function useViewer(): Viewer {
  const { viewer } = useAuth();
  if (!viewer) throw new Error("useViewer used outside a protected route");
  return viewer;
}
