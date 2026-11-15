import Link from "next/link";
import { Suspense } from "react";
import { lerPainel } from "@/modules/conteudo-site/leitura";
import { BLOCOS, resumo, SLUGS } from "@/modules/conteudo-site/schema";
import { barrarSeNaoPuder, ErroAoAbrir, Esqueleto } from "./estados";
import { Aviso, formatarDataHora } from "./ui";
import { unstable_rethrow } from "next/navigation";
import { descreverErro } from "@/lib/erro-log";

export const metadata = { title: "Conteúdo do site | Loja N.UY", robots: { index: false } };

async function Lista() {
  const barreira = await barrarSeNaoPuder();
  if (barreira) return barreira;
  let painel;
  try {
    painel = await lerPainel();
  } catch (e) {
    unstable_rethrow(e); // redirect/notFound do Next não são falha
    console.error(`[conteudo-site] lista falhou: ${descreverErro(e)}`);
    return <><h1>Conteúdo do site</h1><ErroAoAbrir o="o conteúdo" href="/admin/conteudo" /></>;
  }
  const { publicado, ultima, porBloco } = painel;
  const quando = (n: (typeof porBloco)[keyof typeof porBloco]) => (!n ? null : n.origem === "migracao" ? "Conteúdo inicial" : `${formatarDataHora(n.quando)}, por ${n.autor ?? "conta removida"}`);

  return (
    <>
      <h1>Conteúdo do site</h1>
      {ultima && (
        <p className="apoio">
          Última publicação: {ultima.origem === "migracao" ? "conteúdo inicial" : `${formatarDataHora(ultima.quando)}, por ${ultima.autor ?? "conta removida"} (${ultima.blocos.map((b) => BLOCOS[b].nome).join(", ")})`}.{" "}
          <Link href="/admin/conteudo/historico">Ver histórico</Link>
        </p>
      )}
      {painel.pendente && <Aviso tipo="informacao" titulo="Há uma publicação em andamento. Aguarde alguns instantes para publicar." />}
      {!publicado ? (
        <Aviso tipo="erro" titulo="O conteúdo inicial ainda não foi carregado.">
          <p>Avise o responsável técnico.</p>
        </Aviso>
      ) : (
        <ul className="grade-blocos">
          {SLUGS.map((slug) => (
            <li key={slug}>
              <Link className="cartao cartao-bloco" href={`/admin/conteudo/${slug}`}>
                <span className="cartao-titulo">{BLOCOS[slug].nome}</span>
                <span className="cartao-resumo">{resumo(publicado.conteudo, slug)}</span>
                <span className="cartao-meta">{quando(porBloco[slug]) ?? "Sem registro de publicação"}</span>
                <span className="botao botao-secundario" aria-hidden="true">Editar</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<><h1>Conteúdo do site</h1><Esqueleto /></>}>
      <Lista />
    </Suspense>
  );
}
