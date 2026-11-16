import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { situacaoDeAcesso } from "@/modules/conteudo-site/permissao";
import { Aviso } from "./ui";

/** Acesso à área de conteúdo: sem sessão vai para /login; cliente recebe 404; operador sem permissão mostra a tela "Sem permissão" (CA-LOJ-56); null = pode seguir. */
export async function barrarSeNaoPuder() {
  const acesso = await situacaoDeAcesso();
  if (acesso.tipo === "sem_sessao") redirect("/login");
  if (acesso.tipo === "sem_permissao" && acesso.usuario.papel === "cliente") notFound(); // cliente não sabe que o painel existe, como no resto do /admin
  return acesso.tipo === "sem_permissao" ? <SemPermissao /> : null; // equipe sem a permissão (operador): CA-LOJ-56
}

export function SemPermissao() {
  return (
    <>
      <h1>Sem permissão</h1>
      <p>Seu acesso não permite editar o conteúdo do site. Peça ao responsável da loja.</p>
      <p><Link href="/admin">Voltar ao início</Link></p>
    </>
  );
}

export function ErroAoAbrir({ o, href }: { o: string; href: string }) {
  return (
    <Aviso tipo="erro" titulo={`Não foi possível abrir ${o} agora. Tente de novo em instantes.`} acoes={<a className="botao botao-secundario" href={href}>Tentar de novo</a>}>
      <p>O site continua no ar.</p>
    </Aviso>
  );
}

export function Esqueleto({ linhas = 9 }: { linhas?: number }) {
  return (
    <div className="esqueleto" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => <div key={i} className="esqueleto-bloco" />)}
    </div>
  );
}
