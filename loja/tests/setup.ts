import { sql } from "drizzle-orm";
import { afterAll, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { exigirBancoDeTeste } from "./url-teste";

// Guarda: se algo sobrescrever DATABASE_URL, nenhum teste chega a um banco que não seja de teste.
exigirBancoDeTeste(process.env.DATABASE_URL ?? "");

// Isolamento: esvazia todas as tabelas do schema public (uma só instrução) antes de cada teste. A tabela de
// migrations do Drizzle fica no schema "drizzle", fora do alcance. Simples e fiel ao commit real; arquivos rodam em série.
beforeEach(async () => {
  await db.execute(sql`do $$ declare t text; begin
    select string_agg('public.' || quote_ident(tablename), ', ') into t from pg_tables where schemaname = 'public';
    execute 'truncate table ' || t || ' restart identity cascade';
  end $$`);
});

afterAll(async () => {
  await db.$client.end();
});

// Borda de autenticação simulada (o Better Auth em si é do dev-auth): `auth.api.getSession` devolve a sessão
// definida pelo teste (tests/contas/sessao-falsa.ts) e `redirect`/`notFound` lançam, como no Next.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth", async () => {
  const { estado } = await import("./contas/sessao-falsa");
  return { auth: { api: { getSession: async () => estado.sessao } } };
});
