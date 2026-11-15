import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { pedidos } from "@/db/schema";
import { emitirTokenAcompanhamento, gerarToken, hashToken, pedidoIdPorToken, tokenConfere, VALIDADE_TOKEN_MS } from "@/modules/pedidos/token-acompanhamento";
import { criarPedido } from "../fabricas";

const DIA = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-11-14T12:00:00Z");

// CA-LOJ-44/49: o visitante acompanha o pedido só pelo link do e-mail; token vale 90 dias e é de um único pedido.
describe("token de acompanhamento do visitante", () => {
  it("abre o pedido certo com o token recebido", async () => {
    const p = await criarPedido();
    const token = await emitirTokenAcompanhamento(p.id, T0);
    expect(await pedidoIdPorToken(token, new Date(T0.getTime() + DIA))).toBe(p.id);
  });

  it("guarda só o hash: o token em claro não aparece no banco", async () => {
    const p = await criarPedido();
    const token = await emitirTokenAcompanhamento(p.id, T0);
    const [linha] = await db.select().from(pedidos).where(eq(pedidos.id, p.id));
    expect(JSON.stringify(linha)).not.toContain(token);
    expect(linha?.tokenAcompanhamentoHash).toBe(hashToken(token));
  });

  it("vale por 90 dias: aceita no limite e recusa 1 ms depois", async () => {
    const p = await criarPedido();
    const token = await emitirTokenAcompanhamento(p.id, T0);
    expect(VALIDADE_TOKEN_MS).toBe(90 * DIA);
    expect(await pedidoIdPorToken(token, new Date(T0.getTime() + 90 * DIA - 1))).toBe(p.id);
    expect(await pedidoIdPorToken(token, new Date(T0.getTime() + 90 * DIA))).toBeNull();
    expect(await pedidoIdPorToken(token, new Date(T0.getTime() + 91 * DIA))).toBeNull();
  });

  it("recusa token errado, vazio, curto demais ou longo demais, sem erro", async () => {
    const p = await criarPedido();
    await emitirTokenAcompanhamento(p.id, T0);
    const agora = new Date(T0.getTime() + DIA);
    for (const ruim of [gerarToken(), "", "curto", "a".repeat(129)]) {
      expect(await pedidoIdPorToken(ruim, agora)).toBeNull();
    }
  });

  it("novo envio rotaciona: o token anterior deixa de valer", async () => {
    const p = await criarPedido();
    const antigo = await emitirTokenAcompanhamento(p.id, T0);
    const novo = await emitirTokenAcompanhamento(p.id, T0);
    expect(novo).not.toBe(antigo);
    expect(await pedidoIdPorToken(antigo, T0)).toBeNull();
    expect(await pedidoIdPorToken(novo, T0)).toBe(p.id);
  });

  it("o token de um pedido não abre outro pedido", async () => {
    const [a, b] = [await criarPedido(), await criarPedido()];
    const ta = await emitirTokenAcompanhamento(a.id, T0);
    const tb = await emitirTokenAcompanhamento(b.id, T0);
    expect(await pedidoIdPorToken(ta, T0)).toBe(a.id);
    expect(await pedidoIdPorToken(tb, T0)).toBe(b.id);
  });

  it("pedido sem token emitido não é encontrado", async () => {
    await criarPedido();
    expect(await pedidoIdPorToken(gerarToken(), T0)).toBeNull();
  });

  it("tokenConfere compara o token com o hash guardado", () => {
    const t = gerarToken();
    expect(tokenConfere(t, hashToken(t))).toBe(true);
    expect(tokenConfere(gerarToken(), hashToken(t))).toBe(false);
    expect(tokenConfere(t, "lixo-nao-hex")).toBe(false);
  });

  it("gera tokens distintos com entropia suficiente (>= 43 caracteres base64url)", () => {
    const [a, b] = [gerarToken(), gerarToken()];
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });
});
