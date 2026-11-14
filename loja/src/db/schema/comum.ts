import { sql, type SQL } from "drizzle-orm";
import { timestamp } from "drizzle-orm/pg-core";

// Todos os instantes em timestamptz (UTC no banco); exibição em America/Sao_Paulo na borda.
export const criadoEm = () => timestamp("criado_em", { withTimezone: true }).notNull().defaultNow();
export const atualizadoEm = () =>
  timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// CHECK `coluna IN ('a','b')` a partir de uma lista constante (nunca de entrada externa).
export const emLista = (coluna: string, valores: readonly string[]): SQL =>
  sql.raw(`${coluna} in (${valores.map((v) => `'${v}'`).join(", ")})`);
