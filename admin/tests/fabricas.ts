import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { categorias, pagamentos, pedidos, produtos, user, variacoes } from "@/db/schema";

// Dados claramente fictícios (CPF/telefone inventados). Cada teste cria só o que precisa.
export async function criarUsuario(o: Partial<typeof user.$inferInsert> = {}) {
  const id = o.id ?? randomUUID();
  const [u] = await db
    .insert(user)
    .values({ id, name: "Fulana de Teste", email: `${id}@exemplo.test`, emailVerified: true, ...o })
    .returning();
  return u!;
}

export async function criarPedido(o: Partial<typeof pedidos.$inferInsert> = {}) {
  const [p] = await db
    .insert(pedidos)
    .values({
      compradorEmail: "visitante@exemplo.test",
      compradorNome: "Visitante de Teste",
      compradorCpf: "00000000000",
      compradorTelefone: "11900000000",
      entregaCep: "01000000",
      entregaLogradouro: "Rua Fictícia",
      entregaNumero: "1",
      entregaBairro: "Centro",
      entregaCidade: "São Paulo",
      entregaUf: "SP",
      subtotalCentavos: 10000,
      freteCentavos: 1000,
      fretePrazoDiasUteis: 5,
      totalCentavos: 11000,
      ...o,
    })
    .returning();
  return p!;
}

export async function criarVariacao() {
  const [c] = await db.insert(categorias).values({ slug: `cat-${randomUUID()}`, nome: "Categoria" }).returning();
  const [p] = await db.insert(produtos).values({ categoriaId: c!.id, slug: `prod-${randomUUID()}`, nome: "Produto" }).returning();
  const [v] = await db.insert(variacoes).values({ produtoId: p!.id, sku: `SKU-${randomUUID().slice(0, 8).toUpperCase()}`, precoCentavos: 5000 }).returning();
  return v!;
}

export async function criarPagamento(pedidoId: string, o: Partial<typeof pagamentos.$inferInsert> = {}) {
  const [p] = await db.insert(pagamentos).values({ pedidoId, gateway: "gateway-teste", metodo: "pix", valorCentavos: 11000, ...o }).returning();
  return p!;
}

/** Executa e devolve {code, constraint} do erro do Postgres (o Drizzle embrulha o erro do `pg` em `cause`), ou null se não falhou. */
export async function violacao(fn: () => PromiseLike<unknown>): Promise<{ code?: string; constraint?: string } | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    const err = ((e as { cause?: unknown }).cause ?? e) as { code?: string; constraint?: string };
    return { code: err.code, constraint: err.constraint };
  }
}
