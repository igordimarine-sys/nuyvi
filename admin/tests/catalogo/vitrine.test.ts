import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { categorias, estoqueReservas, estoqueSaldos, produtoFotos, produtos, variacoes } from "@/db/schema";
import { lerVitrine } from "@/modules/catalogo/vitrine";
import { criarPedido } from "../fabricas";

// Vitrine de /loja (ADR-0007 A3, CA-LOJ-78 a 80, RN-LOJ-30): lê só o que o catálogo diz; o conteúdo do site nunca entra no preço.
let n = 0;
const unico = () => `${++n}-${randomUUID().slice(0, 6)}`;
async function categoria(o: Partial<typeof categorias.$inferInsert> = {}) {
  const [c] = await db.insert(categorias).values({ slug: `cat-${unico()}`, nome: "Calçados", ...o }).returning();
  return c!;
}
async function produto(categoriaId: string, o: Partial<typeof produtos.$inferInsert> = {}) {
  const [p] = await db.insert(produtos).values({ categoriaId, slug: `prod-${unico()}`, nome: "Tênis", ativo: true, ...o }).returning();
  return p!;
}
async function variacao(produtoId: string, precoCentavos: number, o: Partial<typeof variacoes.$inferInsert> = {}, fisico?: number) {
  const [v] = await db.insert(variacoes).values({ produtoId, sku: `SKU-${unico()}`.toUpperCase(), precoCentavos, tamanho: unico(), ...o }).returning();
  if (fisico !== undefined) await db.insert(estoqueSaldos).values({ variacaoId: v!.id, fisico });
  return v!;
}

describe("lerVitrine", () => {
  it("sem produto: lista vazia", async () => {
    expect(await lerVitrine()).toEqual([]);
  });

  it("só produto ativo, de categoria ativa e com variação ativa", async () => {
    const c = await categoria();
    const inativaCat = await categoria({ ativa: false, nome: "Escondida" });
    const ok = await produto(c.id, { nome: "Visível" });
    await variacao(ok.id, 19990, {}, 3);
    const inativo = await produto(c.id, { nome: "Rascunho", ativo: false });
    await variacao(inativo.id, 1000, {}, 3);
    const catInativa = await produto(inativaCat.id, { nome: "De categoria inativa" });
    await variacao(catInativa.id, 1000, {}, 3);
    const semVariacao = await produto(c.id, { nome: "Sem variação" });
    const soInativa = await produto(c.id, { nome: "Só variação inativa" });
    await variacao(soInativa.id, 1000, { ativa: false }, 3);
    expect(semVariacao.id).toBeTruthy();
    expect((await lerVitrine()).map((p) => p.nome)).toEqual(["Visível"]);
  });

  it("menor preço entre as variações ATIVAS; 'varia' só quando os preços diferem", async () => {
    const c = await categoria();
    const p = await produto(c.id, { nome: "A" });
    await variacao(p.id, 29990, {}, 1);
    await variacao(p.id, 19990, {}, 1);
    await variacao(p.id, 100, { ativa: false }, 1); // a inativa não puxa o preço para baixo
    const q = await produto(c.id, { nome: "B" });
    await variacao(q.id, 5000, {}, 1);
    await variacao(q.id, 5000, {}, 1);
    const r = await lerVitrine();
    expect(r.find((x) => x.nome === "A")).toMatchObject({ precoCentavos: 19990, variaPreco: true });
    expect(r.find((x) => x.nome === "B")).toMatchObject({ precoCentavos: 5000, variaPreco: false });
  });

  it("primeira foto pela ordem (não pela ordem de inserção); sem foto = null", async () => {
    const c = await categoria();
    const p = await produto(c.id, { nome: "Com fotos" });
    await variacao(p.id, 1000, {}, 1);
    await db.insert(produtoFotos).values([
      { produtoId: p.id, url: "https://blob.exemplo.test/c.jpg", alt: "terceira", ordem: 2 },
      { produtoId: p.id, url: "https://blob.exemplo.test/a.jpg", alt: "primeira", ordem: 0 },
      { produtoId: p.id, url: "https://blob.exemplo.test/b.jpg", alt: "segunda", ordem: 1 },
    ]);
    const q = await produto(c.id, { nome: "Sem fotos" });
    await variacao(q.id, 1000, {}, 1);
    const r = await lerVitrine();
    expect(r.find((x) => x.nome === "Com fotos")).toMatchObject({ fotoUrl: "https://blob.exemplo.test/a.jpg", fotoAlt: "primeira" });
    expect(r.find((x) => x.nome === "Sem fotos")).toMatchObject({ fotoUrl: null, fotoAlt: null });
  });

  it("esgotado: todas as variações ativas sem saldo disponível (saldo menos reservas vigentes); uma com saldo basta", async () => {
    const c = await categoria();
    const zerado = await produto(c.id, { nome: "Zerado" });
    await variacao(zerado.id, 1000, {}, 0);
    await variacao(zerado.id, 1000, {}); // sem linha de saldo = 0
    const parcial = await produto(c.id, { nome: "Parcial" });
    await variacao(parcial.id, 1000, {}, 0);
    await variacao(parcial.id, 1000, {}, 2);
    const reservado = await produto(c.id, { nome: "Reservado" });
    const v = await variacao(reservado.id, 1000, {}, 2);
    const pedido = await criarPedido();
    await db.insert(estoqueReservas).values({ pedidoId: pedido.id, variacaoId: v.id, quantidade: 2, expiraEm: new Date(Date.now() + 15 * 60_000) });
    const vencida = await produto(c.id, { nome: "Reserva vencida" });
    const v2 = await variacao(vencida.id, 1000, {}, 2);
    const pedido2 = await criarPedido();
    await db.insert(estoqueReservas).values({ pedidoId: pedido2.id, variacaoId: v2.id, quantidade: 2, expiraEm: new Date(Date.now() - 60_000) });
    const soInativaTemSaldo = await produto(c.id, { nome: "Saldo só na inativa" });
    await variacao(soInativaTemSaldo.id, 1000, {}, 0);
    await variacao(soInativaTemSaldo.id, 1000, { ativa: false }, 9);

    const r = Object.fromEntries((await lerVitrine()).map((x) => [x.nome, x.esgotado]));
    expect(r).toEqual({ Zerado: true, Parcial: false, Reservado: true, "Reserva vencida": false, "Saldo só na inativa": true });
  });

  it("ordem: categoria (ordem), depois nome", async () => {
    const b = await categoria({ nome: "B", ordem: 2 });
    const a = await categoria({ nome: "A", ordem: 1 });
    for (const [cat, nome] of [[b, "Z"], [a, "Y"], [a, "X"], [b, "W"]] as const) await variacao((await produto(cat.id, { nome })).id, 1000, {}, 1);
    expect((await lerVitrine()).map((p) => `${p.categoria}/${p.nome}`)).toEqual(["A/X", "A/Y", "B/W", "B/Z"]);
  });
});
