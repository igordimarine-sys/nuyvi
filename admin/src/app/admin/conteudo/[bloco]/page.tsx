import Link from "next/link";
import { Suspense } from "react";
import { lerPainel } from "@/modules/conteudo-site/leitura";
import { BLOCOS, ehBloco, fatia } from "@/modules/conteudo-site/schema";
import { CAMPOS } from "../campos";
import { BlocoEditor } from "../editor";
import { barrarSeNaoPuder, ErroAoAbrir, Esqueleto } from "../estados";
import { Aviso } from "../ui";
import { unstable_rethrow } from "next/navigation";
import { descreverErro } from "@/lib/erro-log";

export const metadata = { title: "Editar conteúdo | Loja N.UY", robots: { index: false } };

async function Edicao({ params }: { params: PageProps<"/admin/conteudo/[bloco]">["params"] }) {
  const barreira = await barrarSeNaoPuder();
  if (barreira) return barreira;
  const { bloco } = await params;
  if (!ehBloco(bloco)) {
    return <><h1>Bloco não encontrado.</h1><p><Link href="/admin/conteudo">Voltar à lista de blocos</Link></p></>;
  }
  const nome = BLOCOS[bloco].nome;
  const migalhas = (
    <nav aria-label="Você está em" className="migalhas">
      <Link href="/admin/conteudo">Conteúdo do site</Link> <span aria-hidden="true">&gt;</span> <span aria-current="page">{nome}</span>
    </nav>
  );
  let painel;
  try {
    painel = await lerPainel();
  } catch (e) {
    unstable_rethrow(e); // redirect/notFound do Next não são falha
    console.error(`[conteudo-site] bloco falhou: ${descreverErro(e)}`);
    return <>{migalhas}<h1>{nome}</h1><ErroAoAbrir o="o conteúdo" href={`/admin/conteudo/${bloco}`} /></>;
  }
  if (!painel.publicado) {
    return <>{migalhas}<h1>{nome}</h1><Aviso tipo="erro" titulo="O conteúdo inicial ainda não foi carregado."><p>Avise o responsável técnico.</p></Aviso></>;
  }
  return (
    <>
      {migalhas}
      <h1>{nome}</h1>
      <p className="apoio">O que você mudar aqui só vai ao site quando clicar em Publicar. Os outros blocos não são alterados.</p>
      <BlocoEditor
        slug={bloco}
        nome={nome}
        campos={CAMPOS[bloco]}
        inicial={fatia(painel.publicado.conteudo, bloco)}
        versaoBase={painel.versaoBase}
      />
    </>
  );
}

export default function Page(props: PageProps<"/admin/conteudo/[bloco]">) {
  return (
    <Suspense fallback={<Esqueleto linhas={4} />}>
      <Edicao params={props.params} />
    </Suspense>
  );
}
