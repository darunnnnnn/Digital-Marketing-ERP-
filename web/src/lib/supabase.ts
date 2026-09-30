import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.",
  );
}

/**
 * The browser talks to Postgres directly through PostgREST. The anon key is
 * public by design; what each signed-in person may read or change is decided
 * by row level security policies in the database (see supabase/policies.sql),
 * never by this client.
 */
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
