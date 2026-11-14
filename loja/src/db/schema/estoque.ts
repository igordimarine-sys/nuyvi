import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { variacoes } from "./catalogo";
import { criadoEm, emLista } from "./comum";
import { pedidos } from "./pedidos";

// Só o módulo `estoque` escreve aqui (RN-LOJ-11). Ver docs/tecnico/banco.md para a estratégia de concorrência.

// Saldo físico (unidades em mãos, incluindo as reservadas). Disponível = físico - reservas ativas vigentes.
export const estoqueSaldos = pgTable(
  "estoque_saldos",
  {
    variacaoId: uuid("variacao_id")
      .primaryKey()
      .references(() => variacoes.id, { onDelete: "restrict" }),
    fisico: integer("fisico").notNull().default(0),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("estoque_saldos_nao_negativo_ck", sql`${t.fisico} >= 0`)], // RN-LOJ-10
);

export const MOVIMENTO_TIPOS = ["entrada", "ajuste", "venda", "estorno"] as const;

// Livro-razão: fisico == soma(quantidade) por variação. Nunca apagar (spec seção 8).
export const estoqueMovimentos = pgTable(
  "estoque_movimentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variacaoId: uuid("variacao_id")
      .notNull()
      .references(() => variacoes.id, { onDelete: "restrict" }),
    tipo: text("tipo").notNull(),
    quantidade: integer("quantidade").notNull(), // com sinal: venda < 0; entrada e estorno > 0; ajuste != 0
    motivo: text("motivo"), // obrigatório no ajuste (CA-LOJ-26)
    pedidoId: uuid("pedido_id").references(() => pedidos.id, { onDelete: "restrict" }),
    usuarioId: text("usuario_id"), // quem fez (equipe); usuário do Better Auth, sem FK (ver banco.md)
    criadoEm: criadoEm(),
  },
  (t) => [
    index("estoque_movimentos_variacao_idx").on(t.variacaoId, t.criadoEm.desc()), // histórico da variação
    index("estoque_movimentos_pedido_idx").on(t.pedidoId).where(sql`${t.pedidoId} is not null`),
    check("estoque_movimentos_tipo_ck", emLista("tipo", MOVIMENTO_TIPOS)),
    check(
      "estoque_movimentos_sinal_ck",
      sql`(${t.tipo} = 'venda' and ${t.quantidade} < 0)
        or (${t.tipo} in ('entrada', 'estorno') and ${t.quantidade} > 0)
        or (${t.tipo} = 'ajuste' and ${t.quantidade} <> 0 and ${t.motivo} is not null)`,
    ),
  ],
);

export const RESERVA_STATUS = ["ativa", "baixada", "liberada"] as const;

// Reserva ligada ao pedido. Vigente = status 'ativa' E expira_em > now(): o estoque volta no instante
// do vencimento mesmo que o cron atrase (arquitetura §3).
export const estoqueReservas = pgTable(
  "estoque_reservas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidoId: uuid("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "restrict" }),
    variacaoId: uuid("variacao_id")
      .notNull()
      .references(() => variacoes.id, { onDelete: "restrict" }),
    quantidade: integer("quantidade").notNull(),
    status: text("status").notNull().default("ativa"),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex("estoque_reservas_pedido_variacao_uq").on(t.pedidoId, t.variacaoId),
    // soma de reservas por variação na checagem de disponível (CA-LOJ-24/25) e no catálogo
    index("estoque_reservas_ativas_idx").on(t.variacaoId).where(sql`${t.status} = 'ativa'`),
    // varredura do cron de expiração
    index("estoque_reservas_expira_idx").on(t.expiraEm).where(sql`${t.status} = 'ativa'`),
    check("estoque_reservas_qtd_ck", sql`${t.quantidade} > 0`),
    check("estoque_reservas_status_ck", emLista("status", RESERVA_STATUS)),
  ],
);
