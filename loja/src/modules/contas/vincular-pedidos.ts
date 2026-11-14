import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { pedidos } from "@/db/schema";
import { env } from "@/lib/env";
import { enviarEmailConta } from "./enviar-email";
import { exigirPapel } from "./papeis";

// CA-LOJ-47 (premissa revisada após a auditoria A-01): o vínculo NÃO é automático ao confirmar o e-mail, porque quem
// cadastrou a conta (e conhece a senha) pode não ser o dono da caixa postal. Fluxo: usuário logado pede o vínculo ->
// link enviado ao e-mail da conta, assinado (HMAC) e amarrado a usuário + sessão + e-mail -> só vale se aberto na
// MESMA sessão que pediu (quem tem só a senha não tem o e-mail; quem tem só o e-mail não tem a sessão). 30 minutos.
// Sem estado no banco: repetir o link só repete um vínculo idempotente do mesmo usuário.
const VALIDADE_MS = 30 * 60 * 1000;
type Carga = { u: string; s: string; e: string; x: number };

const assinar = (corpo: string) =>
  createHmac("sha256", `vinculo-pedidos:${env.BETTER_AUTH_SECRET}`).update(corpo).digest("base64url");

export function criarTokenVinculo(c: Carga): string {
  const corpo = Buffer.from(JSON.stringify(c)).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

export function lerTokenVinculo(token: string, agora = Date.now()): Carga | null {
  const [corpo, sig, resto] = token.split(".");
  if (!corpo || !sig || resto !== undefined) return null;
  const esperado = Buffer.from(assinar(corpo));
  const recebido = Buffer.from(sig);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  try {
    const c = JSON.parse(Buffer.from(corpo, "base64url").toString()) as Carga;
    return typeof c.u === "string" && typeof c.s === "string" && typeof c.e === "string" && c.x > agora ? c : null;
  } catch {
    return null;
  }
}

/** Passo 1 (usuário logado, e-mail confirmado): envia ao e-mail da conta o link de vínculo da sessão atual. */
export async function solicitarVinculoPedidos(): Promise<void> {
  const u = await exigirPapel("cliente");
  const token = criarTokenVinculo({ u: u.id, s: u.sessaoId, e: u.email, x: Date.now() + VALIDADE_MS });
  enviarEmailConta({ tipo: "vincular_pedidos", para: u.email, link: `${env.BETTER_AUTH_URL}/vincular-pedidos?token=${token}` });
}

/** Passo 2 (ação explícita, mesma sessão): vincula os pedidos de visitante com o e-mail da conta. Devolve a quantidade, ou null se o token não vale. */
export async function confirmarVinculoPedidos(token: string): Promise<number | null> {
  const u = await exigirPapel("cliente");
  const c = lerTokenVinculo(token);
  if (!c || c.u !== u.id || c.s !== u.sessaoId || c.e !== u.email) return null;
  const r = await db
    .update(pedidos)
    .set({ usuarioId: u.id })
    .where(and(isNull(pedidos.usuarioId), sql`lower(${pedidos.compradorEmail}) = lower(${u.email})`))
    .returning({ id: pedidos.id });
  return r.length;
}
