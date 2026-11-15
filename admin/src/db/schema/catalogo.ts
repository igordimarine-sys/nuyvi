import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { atualizadoEm, criadoEm } from "./comum";

// Fonte única de produto e preço (RN-LOJ-18). Produto/variação que já venderam são inativados, nunca apagados:
// por isso os FKs que apontam para cá são RESTRICT.

export const categorias = pgTable("categorias", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  ordem: integer("ordem").notNull().default(0),
  ativa: boolean("ativa").notNull().default(true),
});

export const produtos = pgTable(
  "produtos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categorias.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    ativo: boolean("ativo").notNull().default(false), // nasce inativo; admin publica (CA-LOJ-40)
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("produtos_categoria_idx").on(t.categoriaId).where(sql`${t.ativo}`)], // listagem por categoria (CA-LOJ-01)
);

// Fotos pertencem ao produto e não têm vida própria: CASCADE. `url` é do Vercel Blob.
export const produtoFotos = pgTable(
  "produto_fotos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produtos.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [index("produto_fotos_produto_idx").on(t.produtoId, t.ordem)],
);

export const variacoes = pgTable(
  "variacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produtos.id, { onDelete: "restrict" }),
    sku: text("sku").notNull().unique(), // CA-LOJ-41; a aplicação normaliza, o CHECK garante
    tamanho: text("tamanho"),
    cor: text("cor"),
    precoCentavos: integer("preco_centavos").notNull(), // BRL em centavos inteiros
    ativa: boolean("ativa").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("variacoes_produto_idx").on(t.produtoId),
    check("variacoes_preco_ck", sql`${t.precoCentavos} >= 0`),
    check("variacoes_sku_ck", sql`${t.sku} = upper(btrim(${t.sku})) and ${t.sku} <> ''`),
    uniqueIndex("variacoes_produto_tamanho_cor_uq").on(
      t.produtoId,
      sql`coalesce(${t.tamanho}, '')`,
      sql`coalesce(${t.cor}, '')`,
    ),
  ],
);
