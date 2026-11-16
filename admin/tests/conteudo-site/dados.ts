import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conteudoVersoes } from "@/db/schema";
import { criarUsuario } from "../fabricas";
import { sessao, sessaoDe } from "../contas/sessao-falsa";
import { conteudoSchema, type Conteudo } from "@/modules/conteudo-site/schema";

// Conteúdo inicial do site (admin/scripts/conteudo-inicial/*.json) + `destino` nos cartões da Loja = o que a migração grava como versão 1.
export const PASTA_SITE = new URL("../../src/site/", import.meta.url);
export const PASTA_CONTEUDO = new URL("../../scripts/", import.meta.url);
const ler = (nome: string) => JSON.parse(readFileSync(new URL(`conteudo-inicial/${nome}.json`, PASTA_CONTEUDO), "utf8")) as Record<string, unknown>;
export const HTML_SITE = readFileSync(new URL("index.html", PASTA_SITE), "utf8");

export function conteudoDoSite(): Conteudo {
  const loja = ler("loja") as { produtos: Record<string, unknown>[] };
  return conteudoSchema.parse({
    textos: ler("textos"),
    loja: { ...loja, produtos: loja.produtos.map((p) => ({ ...p, destino: "inicio" })) },
    explore: ler("explore"),
    novidades: ler("novidades"),
    planos: ler("planos"),
  });
}

/** Versão `numero` já aceita (como a migração deixa a 1). `falhou` nasce pendente e é marcada depois (o banco não deixa nascer falhada). */
export async function semearVersao(numero = 1, conteudo: Conteudo = conteudoDoSite(), extra: Partial<typeof conteudoVersoes.$inferInsert> = {}) {
  const { disparoEstado = "aceito", ...resto } = extra;
  const nasce = disparoEstado === "falhou" ? "pendente" : disparoEstado;
  await db.insert(conteudoVersoes).values({
    numero,
    conteudo,
    blocosAlterados: numero === 1 ? ["abertura", "parceiros", "planos", "bonus", "historia", "explore", "loja", "novidades", "baixar"] : ["historia"],
    origem: numero === 1 ? "migracao" : "painel",
    disparoEstado: nasce,
    disparoEm: nasce === "pendente" ? null : new Date(),
    ...resto,
  });
  if (disparoEstado === "falhou") {
    await db.update(conteudoVersoes).set({ disparoEstado: "falhou", disparoEm: new Date(), disparoErro: resto.disparoErro ?? "falha de teste" }).where(eq(conteudoVersoes.numero, numero));
  }
}

export async function entrarComo(papel: "admin" | "operador" | "cliente", nome = "Ana Admin") {
  const u = await criarUsuario({ name: nome, role: papel });
  sessaoDe(sessao({ id: u.id, role: papel }));
  return u;
}

export const versoes = () => db.select().from(conteudoVersoes).orderBy(conteudoVersoes.numero);
export const versao = async (n: number) => (await db.select().from(conteudoVersoes).where(eq(conteudoVersoes.numero, n)))[0];
