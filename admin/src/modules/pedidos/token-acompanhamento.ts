import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { pedidos } from "@/db/schema";

// Link de acompanhamento do visitante (CA-LOJ-44/49). O token (256 bits, CSPRNG) vai só no link do e-mail;
// o banco guarda o SHA-256 (suficiente para token de alta entropia). Premissa de validade (dev-security confirma):
// 90 dias; novo envio gera novo token e invalida o anterior (rotação). Tokens são de leitura de UM pedido.
export const VALIDADE_TOKEN_MS = 90 * 24 * 60 * 60 * 1000;

export const gerarToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Comparação em tempo constante entre o hash esperado e o do token recebido. */
export function tokenConfere(token: string, hashGuardado: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hashGuardado, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Gera (ou rotaciona) o token do pedido e devolve o valor em claro, que só pode ir para o e-mail. */
export async function emitirTokenAcompanhamento(pedidoId: string, agora = new Date()): Promise<string> {
  const token = gerarToken();
  await db
    .update(pedidos)
    .set({ tokenAcompanhamentoHash: hashToken(token), tokenExpiraEm: new Date(agora.getTime() + VALIDADE_TOKEN_MS) })
    .where(eq(pedidos.id, pedidoId));
  return token;
}

/** Id do pedido para um token válido e não expirado; null caso contrário (sem distinguir o motivo). */
export async function pedidoIdPorToken(token: string, agora = new Date()): Promise<string | null> {
  if (token.length < 32 || token.length > 128) return null;
  const hash = hashToken(token);
  const [p] = await db
    .select({ id: pedidos.id, hash: pedidos.tokenAcompanhamentoHash })
    .from(pedidos)
    .where(and(eq(pedidos.tokenAcompanhamentoHash, hash), gt(pedidos.tokenExpiraEm, agora)))
    .limit(1);
  return p?.hash && tokenConfere(token, p.hash) ? p.id : null;
}
