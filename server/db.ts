import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error(
    "[DB] FATAL: DATABASE_URL environment variable is not set. " +
    "Set it to a valid PostgreSQL connection string, e.g. " +
    "postgresql://user:password@host:5432/database"
  );
  process.exit(1);
}

// Validate that the value looks like a real PostgreSQL URL, not a bare
// placeholder such as "host" or "localhost" with no scheme.
try {
  const parsed = new URL(dbUrl);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }
} catch (err: any) {
  console.error(
    "[DB] FATAL: DATABASE_URL is not a valid PostgreSQL connection string " +
    `(got: "${dbUrl}"). Error: ${err.message}. ` +
    "Expected format: postgresql://user:password@host:5432/database"
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

// Surface connection errors immediately rather than letting them surface as
// cryptic ENOTFOUND crashes later in the request lifecycle.
pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });
