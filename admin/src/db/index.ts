import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";

// Driver `pg` (TCP): funciona igual com o Neon (string com sslmode=require) e com o Postgres local.
// Reaproveita o pool no hot reload do `next dev`.
const globalForDb = globalThis as unknown as { pool?: Pool };
const pool = (globalForDb.pool ??= new Pool({ connectionString: env.DATABASE_URL }));

export const db = drizzle(pool);
