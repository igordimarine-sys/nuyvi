import "server-only";
import type { Papel } from "@/db/schema";
import { atende, obterUsuario, type UsuarioAutenticado } from "@/modules/contas/papeis";

/** Papel que edita e publica o conteúdo do site. Premissa P-15 (RN-LOJ-25): só o admin. Se o cliente pedir uma pessoa só
 *  de conteúdo, é aqui (e no papel novo do dev-auth) que muda. */
export const PAPEL_CONTEUDO: Papel = "admin";

/** Só consulta (para a tela dizer "Sem permissão" ou a rota devolver 401/403). Quem barra de verdade é
 *  `exigirPapel(PAPEL_CONTEUDO)`, chamado dentro de cada função do módulo que lê dados da equipe ou escreve. */
export async function situacaoDeAcesso(): Promise<{ tipo: "sem_sessao" } | { tipo: "sem_permissao"; usuario: UsuarioAutenticado } | { tipo: "ok"; usuario: UsuarioAutenticado }> {
  const usuario = await obterUsuario();
  if (!usuario) return { tipo: "sem_sessao" };
  return atende(usuario, PAPEL_CONTEUDO) ? { tipo: "ok", usuario } : { tipo: "sem_permissao", usuario };
}
