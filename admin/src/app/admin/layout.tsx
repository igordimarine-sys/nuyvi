import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Sora } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { atende, obterUsuario } from "@/modules/contas/papeis";
import { PAPEL_CONTEUDO } from "@/modules/conteudo-site/permissao";
import "./admin.css";
import { Conteudo, Navegacao, type ItemNav } from "./navegacao";
import { Tema } from "./tema";

// Fonte do painel (a mesma do painel do trafego-system, que serve de modelo de layout).
const sora = Sora({ subsets: ["latin"], variable: "--fonte-painel" });

// Casca do painel único. A conta do usuário só é lida dentro do Suspense (depende da sessão).
async function Menu() {
  const usuario = await obterUsuario();
  if (!usuario || !atende(usuario, "operador")) return null; // as páginas decidem o que mostrar (redirect, 404, "Sem permissão")
  const itens: ItemNav[] = [{ href: "/admin", rotulo: "Início", icone: "inicio" }];
  if (atende(usuario, PAPEL_CONTEUDO)) {
    itens.push({ href: "/admin/conteudo", rotulo: "Conteúdo do site", icone: "conteudo", filhos: [{ href: "/admin/conteudo/historico", rotulo: "Histórico", icone: "historico" }] });
  }
  return <Navegacao itens={itens} nome={usuario.nome} email={usuario.email} />;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    // enableCssLayer: o MUI vai para @layer mui e o admin.css (sem camada) ganha nos ajustes de layout
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <Tema>
        <div className={`painel ${sora.variable}`}>
          <a className="pular" href="#principal">Pular para o conteúdo</a>
          <Suspense fallback={null}>
            <Menu />
          </Suspense>
          <Conteudo>{children}</Conteudo>
        </div>
      </Tema>
    </AppRouterCacheProvider>
  );
}
