import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { atualizadoEm, criadoEm, emLista } from "./comum";
import { pedidos } from "./pedidos";

export const PAGAMENTO_METODOS = ["pix", "cartao"] as const;
export const PAGAMENTO_STATUS = ["pendente", "aprovado", "recusado", "cancelado", "expirado"] as const;

// Uma tentativa/cobrança por linha; um pedido pode ter várias (cartão recusado, depois Pix: CA-LOJ-17).
// Nenhum dado de cartão é guardado (RNF-08). Nunca apagar.
export const pagamentos = pgTable(
  "pagamentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidoId: uuid("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "restrict" }),
    gateway: text("gateway").notNull(), // ex.: "mercadopago"; escolha final é do dev-integrations
    idExterno: text("id_externo"), // id da cobrança no gateway; nulo até o gateway responder
    metodo: text("metodo").notNull(),
    status: text("status").notNull().default("pendente"),
    valorCentavos: integer("valor_centavos").notNull(),
    pixCopiaECola: text("pix_copia_e_cola"),
    pixExpiraEm: timestamp("pix_expira_em", { withTimezone: true }),
    motivoRecusa: text("motivo_recusa"),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("pagamentos_pedido_idx").on(t.pedidoId),
    uniqueIndex("pagamentos_gateway_id_uq").on(t.gateway, t.idExterno).where(sql`${t.idExterno} is not null`),
    // No máximo um pagamento aprovado por pedido: rede de segurança do CA-LOJ-18
    uniqueIndex("pagamentos_um_aprovado_uq").on(t.pedidoId).where(sql`${t.status} = 'aprovado'`),
    check("pagamentos_metodo_ck", emLista("metodo", PAGAMENTO_METODOS)),
    check("pagamentos_status_ck", emLista("status", PAGAMENTO_STATUS)),
    check("pagamentos_valor_ck", sql`${t.valorCentavos} > 0`),
  ],
);

// Eventos recebidos do gateway: a chave única torna o webhook idempotente (RN-LOJ-13, CA-LOJ-18).
export const gatewayEventos = pgTable(
  "gateway_eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gateway: text("gateway").notNull(),
    eventoId: text("evento_id").notNull(), // id do evento (ou, se o gateway não tiver, id do recurso + tipo + status)
    tipo: text("tipo").notNull(),
    pagamentoId: uuid("pagamento_id").references(() => pagamentos.id, { onDelete: "restrict" }),
    // [LGPD][PII] o payload do gateway pode conter nome/CPF/e-mail do pagador: definir retenção com o lgpd-specialist
    payload: jsonb("payload").notNull(),
    recebidoEm: criadoEm(),
    processadoEm: timestamp("processado_em", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("gateway_eventos_uq").on(t.gateway, t.eventoId),
    index("gateway_eventos_pagamento_idx").on(t.pagamentoId).where(sql`${t.pagamentoId} is not null`),
  ],
);

export const ESTORNO_STATUS = ["pendente", "confirmado", "falhou"] as const;

// Estorno total ou parcial de um pagamento aprovado (CA-LOJ-36, 37, 39). Nunca apagar.
export const estornos = pgTable(
  "estornos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pagamentoId: uuid("pagamento_id")
      .notNull()
      .references(() => pagamentos.id, { onDelete: "restrict" }),
    valorCentavos: integer("valor_centavos").notNull(),
    status: text("status").notNull().default("pendente"),
    idExterno: text("id_externo"),
    motivoFalha: text("motivo_falha"), // visível ao operador (CA-LOJ-37)
    solicitadoPor: text("solicitado_por"), // usuário da equipe (Better Auth), RN-LOJ-19
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("estornos_pagamento_idx").on(t.pagamentoId),
    check("estornos_valor_ck", sql`${t.valorCentavos} > 0`),
    check("estornos_status_ck", emLista("status", ESTORNO_STATUS)),
  ],
);
