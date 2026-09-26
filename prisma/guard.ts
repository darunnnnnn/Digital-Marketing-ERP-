/**
 * The demo seed DELETES everything before inserting. That is fine for a local
 * test database and a disaster anywhere else, so it refuses to run against a
 * remote one unless you very deliberately override it.
 *
 * Imported for its side effect, before anything opens a connection — which is
 * also before Prisma loads .env, so this reads the file itself.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const text = readFileSync(join(process.cwd(), ".env"), "utf8");
    return text.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/m)?.[1] ?? "";
  } catch {
    return "";
  }
}

const url = databaseUrl();
const local = url.startsWith("file:") || url.includes("localhost") || url.includes("127.0.0.1");

if (!local && process.env.I_KNOW_THIS_DELETES_EVERYTHING !== "yes") {
  console.error(
    url
      ? "\nRefusing to run: this seed deletes all data, and DATABASE_URL is not a local database."
      : "\nRefusing to run: no DATABASE_URL found, and this seed deletes all data.",
  );
  console.error("To create a real agency instead, use:\n");
  console.error('  npm run bootstrap -- "Agency" "Your Name" you@agency.com "password"\n');
  process.exit(1);
}

export {};
