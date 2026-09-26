/**
 * Switches Prisma between the local SQLite file and a hosted Postgres.
 *
 *   npm run use:postgres
 *   npm run use:sqlite
 *
 * Only rewrites the datasource block in prisma/schema.prisma. Your connection
 * strings live in .env and are never touched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SCHEMA = join(process.cwd(), "prisma", "schema.prisma");

const BLOCKS = {
  sqlite: `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`,
  postgres: `datasource db {
  provider  = "postgresql"
  // Pooled connection for the app.
  url       = env("DATABASE_URL")
  // Direct connection, used for migrations.
  directUrl = env("DIRECT_URL")
}`,
};

const target = process.argv[2] === "postgres" ? "postgres" : "sqlite";

const schema = readFileSync(SCHEMA, "utf8");
const start = schema.indexOf("datasource db {");
const end = schema.indexOf("}", start);
if (start === -1 || end === -1) {
  console.error("Couldn't find the datasource block in prisma/schema.prisma.");
  process.exit(1);
}

// Keep the file's existing line endings, so switching back and forth leaves no
// spurious changes.
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const usesCrlf = schema.includes(CR + LF);
const block = usesCrlf ? BLOCKS[target].split(LF).join(CR + LF) : BLOCKS[target];

writeFileSync(SCHEMA, schema.slice(0, start) + block + schema.slice(end + 1), "utf8");

console.log(`\nprisma/schema.prisma now uses ${target === "postgres" ? "Postgres" : "SQLite"}.`);

if (target === "postgres") {
  console.log(`
Next, in .env:

  DATABASE_PROVIDER="postgresql"
  DATABASE_URL="<Supabase transaction pooler URI, port 6543>?pgbouncer=true&connection_limit=1"
  DIRECT_URL="<Supabase session pooler URI, port 5432>"

Then:

  npm run db:migrate -- --name init
  npm run bootstrap -- "Your Agency" "Your Name" you@agency.com "a-strong-password"
`);
} else {
  console.log(`
Next, in .env:

  DATABASE_PROVIDER="sqlite"
  DATABASE_URL="file:./dev.db"
`);
}
