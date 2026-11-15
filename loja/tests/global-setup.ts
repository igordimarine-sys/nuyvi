import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import { exigirBancoDeTeste, URL_TESTE } from "./url-teste";

// Cria o database de teste se não existir (conectando ao database "postgres" do mesmo servidor) e aplica as
// migrations de drizzle/ com o migrator do Drizzle. Só toca o database cujo nome contém "test".
export default async function setup() {
  const alvo = exigirBancoDeTeste(URL_TESTE);
  const nome = decodeURIComponent(alvo.pathname.slice(1));

  const admin = new URL(URL_TESTE);
  admin.pathname = "/postgres";
  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  try {
    const { rowCount } = await c.query("select 1 from pg_database where datname = $1", [nome]);
    if (!rowCount) await c.query(`create database "${nome.replaceAll('"', '""')}"`);
  } finally {
    await c.end();
  }

  const pool = new Pool({ connectionString: URL_TESTE });
  try {
    await migrate(drizzle(pool), { migrationsFolder: resolve(import.meta.dirname, "../drizzle") });
  } finally {
    await pool.end();
  }
}
