"use server";

import { TAG_CONTEUDO_SITE } from "@/modules/conteudo-site/leitura";
import { situacaoDeAcesso } from "@/modules/conteudo-site/permissao";
import { publicar, type ResultadoPublicacao } from "@/modules/conteudo-site/publicar";
import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { descreverErro } from "@/lib/erro-log";

// Server Actions do painel de conteúdo. A permissão é conferida de novo dentro de `publicar`
// (exigirPapel); aqui só se transforma "sem sessão" e "sem permissão" em respostas que a tela mostra.
export type RespostaPublicar = ResultadoPublicacao | { tipo: "sessao_expirada" } | { tipo: "sem_permissao" } | { tipo: "erro" };

export async function publicarBloco(bloco: string, dados: unknown, versaoBase: number): Promise<RespostaPublicar> {
  const acesso = await situacaoDeAcesso();
  if (acesso.tipo !== "ok") return { tipo: acesso.tipo === "sem_sessao" ? "sessao_expirada" : "sem_permissao" };
  try {
    const r = await publicar({ bloco, dados, versaoBase });
    if (r.tipo === "publicado") updateTag(TAG_CONTEUDO_SITE); // a próxima requisição de `/` já traz a versão nova
    return r;
  } catch (e) {
    unstable_rethrow(e); // redirect/notFound do Next não são falha
    console.error(`[conteudo-site] erro ao publicar: ${descreverErro(e)}`);
    return { tipo: "erro" };
  }
}
