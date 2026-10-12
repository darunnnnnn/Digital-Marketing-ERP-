/**
 * Reading and writing as the service role, past row level security.
 *
 * Every function that sends mail has to look recipients up for itself — the
 * browser is never allowed to name an address — and that means reading rows no
 * signed-in person could read. So these run with the service key, and the
 * safety is in the callers: they only ever read, they scope every read to one
 * agency, and nothing they read reaches the response.
 */

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

/** A PostgREST read. `path` is the table and query string, e.g. `Member?select=id`. */
export async function read<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`Read failed (${path}): ${await res.text()}`);
  return await res.json();
}

/**
 * An insert that may already exist. Used for the mail ledger, where the unique
 * index is what stops a second run re-sending the same mail — so a conflict is
 * the expected answer, not a failure, and `false` means somebody got there
 * first.
 */
export async function insertIfNew(table: string, row: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error(`Insert failed (${table}): ${await res.text()}`);
  return true;
}

/** Updates rows matching a PostgREST filter. */
export async function update(table: string, filter: string, values: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`Update failed (${table}): ${await res.text()}`);
}

/**
 * Deletes rows matching a PostgREST filter. Used to hand back a mail ledger
 * key when the send it was claiming failed — see `once` in the sweep.
 */
export async function remove(table: string, filter: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=minimal" },
  });
  if (!res.ok) throw new Error(`Delete failed (${table}): ${await res.text()}`);
}

/** The signed-in person behind a call, or null if the token is no good. */
export async function caller(jwt: string): Promise<{ email: string } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return typeof user?.email === "string" ? { email: user.email.toLowerCase() } : null;
}
