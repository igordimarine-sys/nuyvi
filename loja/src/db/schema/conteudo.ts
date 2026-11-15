import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { criadoEm, emLista } from "./comum";

// Conteúdo do site (ADR-0006). Uma linha = uma versão COMPLETA do conteúdo; nunca editada nem apagada.
// A única mudança permitida é o estado do disparo (pendente -> aceito|falhou) e o autor virar NULL
// quando a conta é apagada; tudo isso é imposto por trigger em SQL manual (migration 0002).
// Ver docs/tecnico/banco.md, seção "Conteúdo do site".

export const CONTEUDO_BLOCOS = [
  "abertura",
  "parceiros",
  "planos",
  "bonus",
  "historia",
  "explore",
  "loja",
  "novidades",
  "baixar",
] as const;
export type ConteudoBloco = (typeof CONTEUDO_BLOCOS)[number];

export const CONTEUDO_DOCUMENTOS = ["textos", "loja", "explore", "novidades", "planos"] as const;
export const CONTEUDO_ORIGENS = ["painel", "migracao"] as const;
export const DISPARO_ESTADOS = ["pendente", "aceito", "falhou"] as const;
export type DisparoEstado = (typeof DISPARO_ESTADOS)[number];

export const conteudoVersoes = pgTable(
  "conteudo_versoes",
  {
    // Sequencial sem buracos (trigger) e PK: duas publicações sobre a mesma base colidem aqui (23505).
    numero: integer("numero").primaryKey(),
    // Os 5 documentos no formato de site/conteudo/*.json, mais `destino` nos cartões da Loja.
    conteudo: jsonb("conteudo").notNull(),
    blocosAlterados: text("blocos_alterados").array().notNull(),
    origem: text("origem").notNull().default("painel"),
    // [LGPD][PII] NULL = conta apagada (ou origem 'migracao'); a versão fica.
    autorId: text("autor_id").references(() => user.id, { onDelete: "set null" }),
    disparoEstado: text("disparo_estado").notNull().default("pendente"),
    disparoEm: timestamp("disparo_em", { withTimezone: true }),
    disparoErro: text("disparo_erro"), // motivo curto; nunca a URL do hook nem corpo de resposta
    criadoEm: criadoEm(),
  },
  (t) => [
    check("conteudo_versoes_numero_ck", sql`${t.numero} >= 1`),
    check(
      "conteudo_versoes_conteudo_ck",
      sql`jsonb_typeof(${t.conteudo}) = 'object' and ${t.conteudo} ?& array['textos','loja','explore','novidades','planos']`,
    ),
    check(
      "conteudo_versoes_blocos_ck",
      sql`cardinality(${t.blocosAlterados}) between 1 and 9 and ${t.blocosAlterados} <@ array['abertura','parceiros','planos','bonus','historia','explore','loja','novidades','baixar']::text[]`,
    ),
    check("conteudo_versoes_origem_ck", emLista("origem", CONTEUDO_ORIGENS)),
    check("conteudo_versoes_disparo_estado_ck", emLista("disparo_estado", DISPARO_ESTADOS)),
    // pendente não tem data de resolução; aceito e falhou têm. falhou traz o motivo.
    check(
      "conteudo_versoes_disparo_coerente_ck",
      sql`(${t.disparoEstado} = 'pendente' and ${t.disparoEm} is null) or (${t.disparoEstado} <> 'pendente' and ${t.disparoEm} is not null)`,
    ),
    check("conteudo_versoes_autor_ck", sql`${t.origem} = 'painel' or ${t.autorId} is null`),
    // No máximo uma publicação em curso: serializa as publicações e evita base de conteúdo ambígua.
    uniqueIndex("conteudo_versoes_uma_pendente_uk").on(sql`(true)`).where(sql`${t.disparoEstado} = 'pendente'`),
    // "Última publicada" (leitura pública) e histórico do mais novo ao mais antigo.
    index("conteudo_versoes_aceitas_idx").on(t.numero.desc()).where(sql`${t.disparoEstado} = 'aceito'`),
    index("conteudo_versoes_autor_idx").on(t.autorId).where(sql`${t.autorId} is not null`),
  ],
);
