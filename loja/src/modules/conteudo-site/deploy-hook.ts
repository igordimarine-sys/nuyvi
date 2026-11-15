import "server-only";
import { emProducao, env } from "@/lib/env";

const TIMEOUT_MS = 8000;

export type ResultadoDisparo = { estado: "aceito"; nota?: string } | { estado: "falhou"; erro: string };

/**
 * Pede à Vercel um build do site (deploy hook). Só aqui a URL do hook é usada; ela nunca vai para log, banco, erro ou resposta:
 * os motivos devolvidos são textos fixos curtos.
 *
 * Sem `SITE_DEPLOY_HOOK_URL`: fora de produção (local, Preview) não chama nada e devolve "aceito" com a nota
 * "sem hook configurado" (a publicação existe no banco, o site não é atualizado); em produção é falha (configuração faltando).
 */
export async function dispararSite(): Promise<ResultadoDisparo> {
  const url = env.SITE_DEPLOY_HOOK_URL;
  if (!url) return emProducao() ? { estado: "falhou", erro: "hook não configurado" } : { estado: "aceito", nota: "sem hook configurado" };
  try {
    const res = await fetch(url, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    await res.body?.cancel();
    return res.ok ? { estado: "aceito" } : { estado: "falhou", erro: `hook respondeu ${res.status}` };
  } catch (e) {
    return { estado: "falhou", erro: e instanceof Error && e.name === "TimeoutError" ? "hook: tempo esgotado" : "hook: sem resposta" };
  }
}
