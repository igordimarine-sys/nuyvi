import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import { Suspense } from "react";
import { lerPainel } from "@/modules/conteudo-site/leitura";
import { BLOCOS, resumo, SLUGS } from "@/modules/conteudo-site/schema";
import { barrarSeNaoPuder, ErroAoAbrir, Esqueleto } from "./estados";
import { Aviso, CabecalhoPagina, Etiqueta, formatarDataHora } from "./ui";
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
    return <><CabecalhoPagina titulo="Conteúdo do site" /><ErroAoAbrir o="o conteúdo" href="/admin/conteudo" /></>;
  }
  const { publicado, ultima, porBloco } = painel;
  const quando = (n: (typeof porBloco)[keyof typeof porBloco]) => (!n ? null : n.origem === "migracao" ? "Conteúdo inicial" : `${formatarDataHora(n.quando)}, por ${n.autor ?? "conta removida"}`);

  return (
    <>
      <CabecalhoPagina
        titulo="Conteúdo do site"
        subtitulo={ultima
          ? <>Última publicação: {ultima.origem === "migracao" ? "conteúdo inicial" : `${formatarDataHora(ultima.quando)}, por ${ultima.autor ?? "conta removida"} (${ultima.blocos.map((b) => BLOCOS[b].nome).join(", ")})`}.</>
          : "Escolha um bloco para editar. Cada bloco é publicado sozinho."}
        acoes={<Button href="/admin/conteudo/historico" variant="outlined" color="inherit">Ver histórico</Button>}
      />
      {!publicado ? (
        <Aviso tipo="erro" titulo="O conteúdo inicial ainda não foi carregado.">
          <p>Avise o responsável técnico.</p>
        </Aviso>
      ) : (
        <ul className="grade-blocos">
          {SLUGS.map((slug) => (
            <li key={slug}>
              <Card sx={{ height: "100%", transition: "border-color .15s", "&:hover": { borderColor: "primary.main" } }}>
                <CardActionArea href={`/admin/conteudo/${slug}`} className="cartao-bloco">
                  <span className="cartao-titulo">{BLOCOS[slug].nome}{slug === "pagina-loja" && <> <Etiqueta>Outra página</Etiqueta></>}</span>
                  <span className="cartao-resumo">{resumo(publicado.conteudo, slug)}</span>
                  <span className="cartao-meta">{quando(porBloco[slug]) ?? "Sem registro de publicação"}</span>
                  <span className="cartao-editar" aria-hidden="true">Editar →</span>
                </CardActionArea>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<><CabecalhoPagina titulo="Conteúdo do site" /><Esqueleto /></>}>
      <Lista />
    </Suspense>
  );
}
