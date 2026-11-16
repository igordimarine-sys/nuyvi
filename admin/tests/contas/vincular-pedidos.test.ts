import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { pedidos } from "@/db/schema";
import { confirmarVinculoPedidos, criarTokenVinculo, solicitarVinculoPedidos } from "@/modules/contas/vincular-pedidos";
import { criarPedido, criarUsuario } from "../fabricas";
import { sessao, sessaoDe } from "./sessao-falsa";

const enviados = vi.hoisted(() => [] as { tipo: string; para: string; link?: string }[]);
vi.mock("@/modules/contas/enviar-email", () => ({ enviarEmailConta: (e: (typeof enviados)[number]) => enviados.push(e) }));

const EMAIL = "fulana@exemplo.test";
const MIN = 60 * 1000;
const usuarioIdDoPedido = async (id: string) => (await db.select().from(pedidos).where(eq(pedidos.id, id)))[0]?.usuarioId;
const tokenDoEmail = () => new URL(enviados.at(-1)!.link!).searchParams.get("token")!;

// CA-LOJ-47 (revisado pela correção A-01 da auditoria): o vínculo é ação explícita, amarrada ao usuário, à
// sessão e ao e-mail da conta; nunca automático ao confirmar o e-mail.
describe("vínculo de pedidos de visitante à conta (CA-LOJ-47)", () => {
  beforeEach(() => {
    enviados.length = 0;
    sessaoDe(null);
  });

  async function contaComPedidoDeVisitante() {
    const u = await criarUsuario({ id: "u1", email: EMAIL });
    const pedido = await criarPedido({ compradorEmail: "Fulana@Exemplo.TEST" }); // caixa diferente: vínculo ignora maiúsculas
    sessaoDe(sessao({ id: u.id, email: EMAIL }));
    return { u, pedido };
  }

  it("criar a conta com o e-mail do pedido não vincula nada sozinho", async () => {
    const { pedido } = await contaComPedidoDeVisitante();
    expect(await usuarioIdDoPedido(pedido.id)).toBeNull();
  });

  it("fluxo completo: pede o vínculo, abre o link na mesma sessão e os pedidos do e-mail passam para a conta", async () => {
    const { pedido } = await contaComPedidoDeVisitante();
    await solicitarVinculoPedidos();

    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ tipo: "vincular_pedidos", para: EMAIL });
    expect(await usuarioIdDoPedido(pedido.id)).toBeNull(); // pedir não vincula

    expect(await confirmarVinculoPedidos(tokenDoEmail())).toBe(1);
    expect(await usuarioIdDoPedido(pedido.id)).toBe("u1");
  });

  it("só vincula pedidos do e-mail da conta e que ainda são de visitante", async () => {
    const { u } = await contaComPedidoDeVisitante();
    const outroEmail = await criarPedido({ compradorEmail: "outra@exemplo.test" });
    const outroDono = await criarUsuario({ id: "u2", email: "u2@exemplo.test" });
    const jaDeOutro = await criarPedido({ compradorEmail: EMAIL, usuarioId: outroDono.id });

    await solicitarVinculoPedidos();
    expect(await confirmarVinculoPedidos(tokenDoEmail())).toBe(1);

    expect(await usuarioIdDoPedido(outroEmail.id)).toBeNull();
    expect(await usuarioIdDoPedido(jaDeOutro.id)).toBe(outroDono.id);
    expect(u.id).toBe("u1");
  });

  it("repetir o link é idempotente: não vincula nada de novo", async () => {
    await contaComPedidoDeVisitante();
    await solicitarVinculoPedidos();
    const token = tokenDoEmail();
    expect(await confirmarVinculoPedidos(token)).toBe(1);
    expect(await confirmarVinculoPedidos(token)).toBe(0);
  });

  it("link aberto em OUTRA sessão do mesmo usuário não vincula (quem só tem o e-mail não tem a sessão)", async () => {
    const { pedido } = await contaComPedidoDeVisitante();
    await solicitarVinculoPedidos();
    const token = tokenDoEmail();

    sessaoDe(sessao({ id: "u1", email: EMAIL, sessaoId: "s-outra" }));
    expect(await confirmarVinculoPedidos(token)).toBeNull();
    expect(await usuarioIdDoPedido(pedido.id)).toBeNull();
  });

  it("link de um usuário aberto por outro usuário não vincula", async () => {
    const { pedido } = await contaComPedidoDeVisitante();
    await solicitarVinculoPedidos();
    const token = tokenDoEmail();

    await criarUsuario({ id: "u2", email: "u2@exemplo.test" });
    sessaoDe(sessao({ id: "u2", email: "u2@exemplo.test" }));
    expect(await confirmarVinculoPedidos(token)).toBeNull();
    expect(await usuarioIdDoPedido(pedido.id)).toBeNull();
  });

  it("se o e-mail da conta mudou depois do pedido do link, o link não vale", async () => {
    const { pedido } = await contaComPedidoDeVisitante();
    await solicitarVinculoPedidos();
    const token = tokenDoEmail();

    sessaoDe(sessao({ id: "u1", email: "novo@exemplo.test" }));
    expect(await confirmarVinculoPedidos(token)).toBeNull();
    expect(await usuarioIdDoPedido(pedido.id)).toBeNull();
  });

  it("link expirado (30 minutos), adulterado ou lixo não vincula", async () => {
    const { pedido } = await contaComPedidoDeVisitante();
    const carga = { u: "u1", s: "s1", e: EMAIL };
    const expirado = criarTokenVinculo({ ...carga, x: Date.now() - 1 });
    const valido = criarTokenVinculo({ ...carga, x: Date.now() + 30 * MIN });
    const [corpo, assinatura] = valido.split(".") as [string, string];
    const corpoAdulterado = Buffer.from(JSON.stringify({ ...carga, x: Date.now() + 999 * MIN })).toString("base64url");

    for (const ruim of [expirado, `${corpoAdulterado}.${assinatura}`, `${corpo}.assinatura-falsa`, corpo, `${valido}.extra`, ""]) {
      expect(await confirmarVinculoPedidos(ruim)).toBeNull();
    }
    expect(await usuarioIdDoPedido(pedido.id)).toBeNull();

    expect(await confirmarVinculoPedidos(valido)).toBe(1); // controle: o válido funciona
  });

  it("sem sessão (ou com e-mail não confirmado), pedir e confirmar mandam para o login e nada é vinculado", async () => {
    const { pedido } = await contaComPedidoDeVisitante();
    const token = criarTokenVinculo({ u: "u1", s: "s1", e: EMAIL, x: Date.now() + 30 * MIN });

    sessaoDe(null);
    await expect(solicitarVinculoPedidos()).rejects.toThrow("REDIRECT:/login");
    await expect(confirmarVinculoPedidos(token)).rejects.toThrow("REDIRECT:/login");

    sessaoDe(sessao({ id: "u1", email: EMAIL, emailVerified: false }));
    await expect(confirmarVinculoPedidos(token)).rejects.toThrow("REDIRECT:/login");

    expect(enviados).toHaveLength(0);
    expect(await usuarioIdDoPedido(pedido.id)).toBeNull();
  });
});
