import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { variacoes } from "./catalogo";
import { atualizadoEm, criadoEm, emLista } from "./comum";

// Estados da spec (seção 8). As transições permitidas ficam na tabela de transições do módulo `pedidos`
// (aplicação, com UPDATE ... WHERE status = <estado atual>); o banco só garante o conjunto de valores.
export const PEDIDO_STATUS = [
  "aguardando_pagamento",
  "pago",
  "expirado",
  "cancelado",
  "cancelamento_solicitado",
  "em_separacao",
  "estorno_pendente",
  "cancelado_estornado",
  "enviado",
  "entregue",
  "em_troca",
  "devolvido",
] as const;

// Pedido nunca é apagado (spec seção 8): todos os FKs são RESTRICT. Valores e dados do comprador são
// congelados no pedido (RN-LOJ-08). [LGPD] colunas marcadas PII são dados pessoais para o lgpd-specialist.
export const pedidos = pgTable(
  "pedidos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    numero: integer("numero").notNull().generatedAlwaysAsIdentity({ startWith: 1000 }), // número amigável

    // Id do usuário do Better Auth (text). Nulo = visitante.
    usuarioId: text("usuario_id").references(() => user.id, { onDelete: "set null" }), // conta apagada não apaga o pedido

    status: text("status").notNull().default("aguardando_pagamento"),

    // [LGPD][PII] identificação do comprador
    compradorEmail: text("comprador_email").notNull(),
    compradorNome: text("comprador_nome").notNull(),
    compradorCpf: text("comprador_cpf").notNull(), // 11 dígitos; nota fiscal e gateway
    compradorTelefone: text("comprador_telefone").notNull(),
    // [LGPD][PII] endereço de entrega
    entregaCep: text("entrega_cep").notNull(),
    entregaLogradouro: text("entrega_logradouro").notNull(),
    entregaNumero: text("entrega_numero").notNull(),
    entregaComplemento: text("entrega_complemento"),
    entregaBairro: text("entrega_bairro").notNull(),
    entregaCidade: text("entrega_cidade").notNull(),
    entregaUf: text("entrega_uf").notNull(),

    // Valores congelados, em centavos. total = subtotal - desconto + frete.
    subtotalCentavos: integer("subtotal_centavos").notNull(),
    descontoCentavos: integer("desconto_centavos").notNull().default(0), // soma dos descontos dos itens
    freteCentavos: integer("frete_centavos").notNull(),
    fretePrazoDiasUteis: integer("frete_prazo_dias_uteis").notNull(),
    totalCentavos: integer("total_centavos").notNull(),
    // Fase 1b: fotografia do plano usado. Nulos no MVP (arquitetura §5).
    planoCodigo: text("plano_codigo"),
    planoPercentualBp: integer("plano_percentual_bp"), // pontos-base: 1000 = 10%

    // Visitante: guarda-se só o SHA-256 do token (o token em claro vai por e-mail e não é guardado).
    tokenAcompanhamentoHash: text("token_acompanhamento_hash"),
    tokenExpiraEm: timestamp("token_expira_em", { withTimezone: true }),

    expiraEm: timestamp("expira_em", { withTimezone: true }), // fim da reserva; nulo depois de pago
    pagoEm: timestamp("pago_em", { withTimezone: true }),
    notaFiscalNumero: text("nota_fiscal_numero"), // registrada pelo operador (CA-LOJ-31)
    notaFiscalChave: text("nota_fiscal_chave"),
    rastreioCodigo: text("rastreio_codigo"),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex("pedidos_numero_uq").on(t.numero),
    uniqueIndex("pedidos_token_hash_uq").on(t.tokenAcompanhamentoHash).where(sql`${t.tokenAcompanhamentoHash} is not null`),
    index("pedidos_usuario_idx").on(t.usuarioId, t.criadoEm.desc()).where(sql`${t.usuarioId} is not null`), // "Meus pedidos" (CA-LOJ-28)
    index("pedidos_email_idx").on(sql`lower(${t.compradorEmail})`), // vínculo visitante -> conta (CA-LOJ-47)
    index("pedidos_status_idx").on(t.status, t.criadoEm), // lista do operador (CA-LOJ-30)
    index("pedidos_expiracao_idx").on(t.expiraEm).where(sql`${t.status} = 'aguardando_pagamento'`), // cron (CA-LOJ-15)
    check("pedidos_status_ck", emLista("status", PEDIDO_STATUS)),
    check("pedidos_valores_ck", sql`${t.subtotalCentavos} >= 0 and ${t.descontoCentavos} >= 0 and ${t.freteCentavos} >= 0 and ${t.descontoCentavos} <= ${t.subtotalCentavos}`),
    check("pedidos_total_ck", sql`${t.totalCentavos} = ${t.subtotalCentavos} - ${t.descontoCentavos} + ${t.freteCentavos}`),
    check("pedidos_cpf_ck", sql`${t.compradorCpf} ~ '^[0-9]{11}$'`),
    check("pedidos_cep_ck", sql`${t.entregaCep} ~ '^[0-9]{8}$' and ${t.entregaUf} ~ '^[A-Z]{2}$'`),
    // Pedido enviado exige nota e rastreio (CA-LOJ-31, premissa de RN-LOJ-15)
    check(
      "pedidos_envio_ck",
      sql`${t.status} not in ('enviado', 'entregue', 'em_troca', 'devolvido') or (${t.notaFiscalNumero} is not null and ${t.rastreioCodigo} is not null)`,
    ),
  ],
);

// Itens com nome/SKU/preço congelados; a variação só é referência (RESTRICT).
export const pedidoItens = pgTable(
  "pedido_itens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidoId: uuid("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "restrict" }),
    variacaoId: uuid("variacao_id")
      .notNull()
      .references(() => variacoes.id, { onDelete: "restrict" }),
    produtoNome: text("produto_nome").notNull(),
    variacaoDescricao: text("variacao_descricao"), // ex.: "Tam 40 / Preto"
    sku: text("sku").notNull(),
    quantidade: integer("quantidade").notNull(),
    precoUnitarioCentavos: integer("preco_unitario_centavos").notNull(),
    descontoCentavos: integer("desconto_centavos").notNull().default(0), // da linha (unitário × qtd, RN-LOJ-06); 0 no MVP
    totalCentavos: integer("total_centavos").notNull(),
  },
  (t) => [
    uniqueIndex("pedido_itens_pedido_variacao_uq").on(t.pedidoId, t.variacaoId),
    check("pedido_itens_qtd_ck", sql`${t.quantidade} > 0 and ${t.precoUnitarioCentavos} >= 0`),
    check("pedido_itens_desconto_ck", sql`${t.descontoCentavos} between 0 and ${t.precoUnitarioCentavos} * ${t.quantidade}`),
    check("pedido_itens_total_ck", sql`${t.totalCentavos} = ${t.precoUnitarioCentavos} * ${t.quantidade} - ${t.descontoCentavos}`),
  ],
);

export const ATOR_TIPOS = ["sistema", "comprador", "equipe"] as const;

// Histórico de transições (CA-LOJ-33, RN-LOJ-19). Só INSERT.
export const pedidoHistorico = pgTable(
  "pedido_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidoId: uuid("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "restrict" }),
    deStatus: text("de_status"), // nulo na criação
    paraStatus: text("para_status").notNull(),
    atorTipo: text("ator_tipo").notNull(),
    atorUsuarioId: text("ator_usuario_id"), // usuário do Better Auth quando atorTipo = 'equipe' (ou comprador com conta)
    motivo: text("motivo"),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("pedido_historico_pedido_idx").on(t.pedidoId, t.criadoEm),
    check("pedido_historico_para_ck", emLista("para_status", PEDIDO_STATUS)),
    check("pedido_historico_de_ck", sql`${t.deStatus} is null or ${t.deStatus} in (${sql.raw(PEDIDO_STATUS.map((s) => `'${s}'`).join(", "))})`),
    check("pedido_historico_ator_ck", emLista("ator_tipo", ATOR_TIPOS)),
  ],
);
