/**
 * SQLite's LIKE ignores case; Postgres's does not. Spreading this into a
 * `contains` filter keeps search behaving the same on both, so moving to a real
 * database doesn't quietly break it.
 */
export const insensitive =
  process.env.DATABASE_PROVIDER === "postgresql" ? ({ mode: "insensitive" } as const) : {};
