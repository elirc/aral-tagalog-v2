import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };

export type Db = ReturnType<typeof createDb>;

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: process.env.VERCEL === "1" ? 1 : 5,
    // Compatible with managed PostgreSQL transaction poolers.
    prepare: false,
    connect_timeout: 5,
    idle_timeout: process.env.VERCEL === "1" ? 5 : 20,
    // Transaction poolers reject arbitrary startup parameters.
    ...(process.env.VERCEL === "1" ? {} : { connection: { statement_timeout: 10_000 } }),
  });
  return drizzle(client, { schema });
}
