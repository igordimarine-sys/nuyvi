"use server";

import { situacao } from "@/modules/conteudo-site/leitura";
import { situacaoDeAcesso } from "@/modules/conteudo-site/permissao";
import { publicar, type ResultadoPublicacao } from "@/modules/conteudo-site/publicar";

// Server Actions do painel de conteúdo. A permissão é conferida de novo dentro de `publicar` e `situacao`
// (exigirPapel); aqui só se transforma "sem sessão" e "sem permissão" em respostas que a tela mostra.
export type RespostaPublicar = ResultadoPublicacao | { tipo: "sessao_expirada" } | { tipo: "sem_permissao" } | { tipo: "erro" };

export async function publicarBloco(bloco: string, dados: unknown, versaoBase: number): Promise<RespostaPublicar> {
  const acesso = await situacaoDeAcesso();
  if (acesso.tipo !== "ok") return { tipo: acesso.tipo === "sem_sessao" ? "sessao_expirada" : "sem_permissao" };
  try {
    return await publicar({ bloco, dados, versaoBase });
  } catch (e) {
    console.error(`[conteudo-site] erro ao publicar: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    return { tipo: "erro" };
  }
}

/** A tela consulta enquanto há publicação em andamento (a cada 5 s, até ~2 min). */
export async function consultarSituacao(): Promise<{ pendente: boolean; versaoBase: number } | null> {
  const acesso = await situacaoDeAcesso();
  if (acesso.tipo !== "ok") return null;
  try {
    return await situacao();
  } catch {
    return null;
  }
}
