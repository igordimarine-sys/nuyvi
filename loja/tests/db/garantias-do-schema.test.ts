import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { emailsSaida, estoqueSaldos, gatewayEventos, pagamentos, pedidos } from "@/db/schema";
import { criarPagamento, criarPedido, criarUsuario, criarVariacao, violacao } from "../fabricas";

const CHECK = "23514";
const UNIQUE = "23505";
const FK = "23503";

// Estas garantias são do banco (drizzle/0000 e 0001), não da aplicação: se alguém afrouxar uma migration,
// o teste falha. Protegem RN-LOJ-10 (estoque nunca negativo), RN-LOJ-13 (confirmação repetida) e a integridade do pedido.
describe("estoque (RN-LOJ-10)", () => {
  it("recusa saldo físico negativo na inserção", async () => {
    const v = await criarVariacao();
    const erro = await violacao(() => db.insert(estoqueSaldos).values({ variacaoId: v.id, fisico: -1 }));
    expect(erro).toEqual({ code: CHECK, constraint: "estoque_saldos_nao_negativo_ck" });
  });

  it("recusa baixa maior que o saldo e aceita zerar o saldo", async () => {
    const v = await criarVariacao();
    await db.insert(estoqueSaldos).values({ variacaoId: v.id, fisico: 2 });

    const erro = await violacao(() =>
      db.update(estoqueSaldos).set({ fisico: sql`${estoqueSaldos.fisico} - 3` }).where(eq(estoqueSaldos.variacaoId, v.id)),
    );
    expect(erro?.constraint).toBe("estoque_saldos_nao_negativo_ck");

    await db.update(estoqueSaldos).set({ fisico: sql`${estoqueSaldos.fisico} - 2` }).where(eq(estoqueSaldos.variacaoId, v.id));
    const [s] = await db.select().from(estoqueSaldos).where(eq(estoqueSaldos.variacaoId, v.id));
    expect(s?.fisico).toBe(0);
  });
});

describe("gateway_eventos: idempotência do webhook (RN-LOJ-13)", () => {
  const evento = (over: Partial<typeof gatewayEventos.$inferInsert> = {}) => ({
    gateway: "gateway-teste",
    eventoId: "evt_1",
    tipo: "pagamento.aprovado",
    payload: { ficticio: true },
    ...over,
  });
  const registrar = (v: typeof gatewayEventos.$inferInsert) =>
    db.insert(gatewayEventos).values(v).onConflictDoNothing().returning({ id: gatewayEventos.id });

  it("devolve linha na primeira entrega e nenhuma na duplicata", async () => {
    expect(await registrar(evento())).toHaveLength(1);
    expect(await registrar(evento())).toHaveLength(0);
    expect(await db.select().from(gatewayEventos)).toHaveLength(1);
  });

  it("trata o mesmo evento_id de gateways diferentes como eventos distintos", async () => {
    expect(await registrar(evento())).toHaveLength(1);
    expect(await registrar(evento({ gateway: "outro-gateway" }))).toHaveLength(1);
  });

  it("insert simples da duplicata viola o índice único (a aplicação precisa usar ON CONFLICT)", async () => {
    await registrar(evento());
    const erro = await violacao(() => db.insert(gatewayEventos).values(evento()));
    expect(erro).toEqual({ code: UNIQUE, constraint: "gateway_eventos_uq" });
  });

  it("com entregas simultâneas do mesmo evento, exatamente uma vence", async () => {
    const resultados = await Promise.all(Array.from({ length: 8 }, () => registrar(evento({ eventoId: "evt_conc" }))));
    expect(resultados.filter((r) => r.length === 1)).toHaveLength(1);
    expect(await db.select().from(gatewayEventos)).toHaveLength(1);
  });
});

describe("pagamentos: um aprovado por pedido (RN-LOJ-13)", () => {
  it("recusa um segundo pagamento aprovado no mesmo pedido", async () => {
    const p = await criarPedido();
    await criarPagamento(p.id, { status: "aprovado" });
    const erro = await violacao(() => criarPagamento(p.id, { status: "aprovado" }));
    expect(erro).toEqual({ code: UNIQUE, constraint: "pagamentos_um_aprovado_uq" });
  });

  it("aceita tentativas não aprovadas junto do aprovado, e aprovado em outro pedido", async () => {
    const a = await criarPedido();
    const b = await criarPedido();
    await criarPagamento(a.id, { status: "recusado" });
    await criarPagamento(a.id, { status: "pendente" });
    await criarPagamento(a.id, { status: "aprovado" });
    await criarPagamento(b.id, { status: "aprovado" });
    expect(await db.select().from(pagamentos)).toHaveLength(4);
  });

  it("com duas aprovações simultâneas do mesmo pedido, só uma grava", async () => {
    const p = await criarPedido();
    const r = await Promise.allSettled([criarPagamento(p.id, { status: "aprovado" }), criarPagamento(p.id, { status: "aprovado" })]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });
});

describe("emails_saida: um e-mail por pedido e tipo", () => {
  it("recusa o mesmo tipo duas vezes para o pedido, mas aceita outro tipo", async () => {
    const p = await criarPedido();
    await db.insert(emailsSaida).values({ pedidoId: p.id, tipo: "pago" });
    const erro = await violacao(() => db.insert(emailsSaida).values({ pedidoId: p.id, tipo: "pago" }));
    expect(erro).toEqual({ code: UNIQUE, constraint: "emails_saida_pedido_tipo_uq" });
    await db.insert(emailsSaida).values({ pedidoId: p.id, tipo: "enviado" });
  });

  it("aceita o mesmo tipo em pedidos diferentes", async () => {
    const [a, b] = [await criarPedido(), await criarPedido()];
    await db.insert(emailsSaida).values({ pedidoId: a.id, tipo: "pago" });
    await db.insert(emailsSaida).values({ pedidoId: b.id, tipo: "pago" });
  });
});

describe("estados em text têm CHECK", () => {
  it.each([
    ["pedidos.status", "pedidos_status_ck", () => criarPedido({ status: "inexistente" })],
    ["pagamentos.status", "pagamentos_status_ck", async () => criarPagamento((await criarPedido()).id, { status: "inexistente" })],
    ["pagamentos.metodo", "pagamentos_metodo_ck", async () => criarPagamento((await criarPedido()).id, { metodo: "boleto" })],
    ["emails_saida.tipo", "emails_saida_tipo_ck", async () => db.insert(emailsSaida).values({ pedidoId: (await criarPedido()).id, tipo: "spam" })],
    ["emails_saida.status", "emails_saida_status_ck", async () => db.insert(emailsSaida).values({ pedidoId: (await criarPedido()).id, tipo: "pago", status: "x" })],
    ["user.role", "user_role_ck", () => criarUsuario({ role: "superadmin" })],
  ])("recusa valor fora da lista em %s", async (_campo, constraint, inserir) => {
    expect(await violacao(inserir)).toEqual({ code: CHECK, constraint });
  });

  it("pedido não vai a 'enviado' sem nota e rastreio (CA-LOJ-31)", async () => {
    const erro = await violacao(() => criarPedido({ status: "enviado" }));
    expect(erro?.constraint).toBe("pedidos_envio_ck");
    await criarPedido({ status: "enviado", notaFiscalNumero: "1", rastreioCodigo: "XX000000000XX" });
  });

  it("pedido recusa total diferente de subtotal - desconto + frete", async () => {
    const erro = await violacao(() => criarPedido({ totalCentavos: 1 }));
    expect(erro?.constraint).toBe("pedidos_total_ck");
  });
});

describe("pedidos.usuario_id (FK para user)", () => {
  it("recusa pedido de usuário inexistente", async () => {
    const erro = await violacao(() => criarPedido({ usuarioId: "nao-existe" }));
    expect(erro).toEqual({ code: FK, constraint: "pedidos_usuario_id_user_id_fk" });
  });

  it("apagar a conta não apaga o pedido: ele vira de visitante (ON DELETE SET NULL)", async () => {
    const u = await criarUsuario();
    const p = await criarPedido({ usuarioId: u.id });
    await db.execute(sql`delete from "user" where id = ${u.id}`);
    const [depois] = await db.select().from(pedidos).where(eq(pedidos.id, p.id));
    expect(depois?.usuarioId).toBeNull();
  });
});
