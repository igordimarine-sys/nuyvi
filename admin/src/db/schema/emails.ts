import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { criadoEm, emLista } from "./comum";
import { pedidos } from "./pedidos";

export const EMAIL_TIPOS = ["pedido_recebido", "pago", "enviado", "cancelado"] as const;
export const EMAIL_STATUS = ["pendente", "enviado", "falhou"] as const;

// Fila de saída (outbox) de e-mails de pedido (arquitetura §3). Gravada na mesma transação da mudança de
// estado; enviada depois, com reenvio pelo cron. Destinatário e conteúdo vêm do pedido no momento do envio
// (nenhum dado pessoal duplicado aqui). Mecanismo de envio: dev-integrations / dev-notifications.
export const emailsSaida = pgTable(
  "emails_saida",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidoId: uuid("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "restrict" }),
    tipo: text("tipo").notNull(),
    status: text("status").notNull().default("pendente"),
    tentativas: integer("tentativas").notNull().default(0),
    proximaTentativaEm: timestamp("proxima_tentativa_em", { withTimezone: true }).notNull().defaultNow(),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
    ultimoErro: text("ultimo_erro"),
    criadoEm: criadoEm(),
  },
  (t) => [
    // Um e-mail de cada tipo por pedido: "pago" não sai duas vezes (CA-LOJ-18)
    uniqueIndex("emails_saida_pedido_tipo_uq").on(t.pedidoId, t.tipo),
    // Seleção dos pendentes com FOR UPDATE SKIP LOCKED
    index("emails_saida_pendentes_idx").on(t.proximaTentativaEm).where(sql`${t.status} = 'pendente'`),
    check("emails_saida_tipo_ck", emLista("tipo", EMAIL_TIPOS)),
    check("emails_saida_status_ck", emLista("status", EMAIL_STATUS)),
  ],
);
