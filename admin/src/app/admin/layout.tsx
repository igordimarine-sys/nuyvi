import { Suspense, type ReactNode } from "react";
import { atende, obterUsuario } from "@/modules/contas/papeis";
import { PAPEL_CONTEUDO } from "@/modules/conteudo-site/permissao";
import "./admin.css";
import { Navegacao, type ItemNav } from "./navegacao";

// Casca do painel único. A conta do usuário só é lida dentro do Suspense (depende da sessão).
async function Menu() {
  const usuario = await obterUsuario();
  if (!usuario || !atende(usuario, "operador")) return null; // as páginas decidem o que mostrar (redirect, 404, "Sem permissão")
  const itens: ItemNav[] = [{ href: "/admin", rotulo: "Início" }];
  if (atende(usuario, PAPEL_CONTEUDO)) {
    itens.push({ href: "/admin/conteudo", rotulo: "Conteúdo do site", filhos: [{ href: "/admin/conteudo/historico", rotulo: "Histórico" }] });
  }
  return <Navegacao itens={itens} nome={usuario.nome} />;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="painel">
      <a className="pular" href="#principal">Pular para o conteúdo</a>
      <Suspense fallback={<div className="painel-nav" aria-hidden="true" />}>
        <Menu />
      </Suspense>
      <main id="principal" className="painel-conteudo">{children}</main>
    </div>
  );
}
