import "server-only";
import { and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { pedidos } from "@/db/schema";

// CA-LOJ-47. Chamar SOMENTE depois de o Better Auth marcar o e-mail como confirmado (hook afterEmailVerification):
// quem controla a caixa postal do e-mail recebe os pedidos de visitante feitos com ele. Só toca em pedidos sem conta.
export async function vincularPedidosDeVisitante(usuarioId: string, emailConfirmado: string): Promise<number> {
  const r = await db
    .update(pedidos)
    .set({ usuarioId })
    .where(and(isNull(pedidos.usuarioId), sql`lower(${pedidos.compradorEmail}) = lower(${emailConfirmado})`))
    .returning({ id: pedidos.id });
  return r.length;
}
