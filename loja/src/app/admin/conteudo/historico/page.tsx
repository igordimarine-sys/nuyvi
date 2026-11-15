import Link from "next/link";
import { Suspense } from "react";
import { historico } from "@/modules/conteudo-site/leitura";
import { BLOCOS } from "@/modules/conteudo-site/schema";
import { barrarSeNaoPuder, ErroAoAbrir, Esqueleto } from "../estados";
import { Etiqueta, formatarDataHora } from "../ui";

export const metadata = { title: "Histórico de conteúdo | Loja N.UY", robots: { index: false } };

const SITUACAO = {
  aceito: <Etiqueta tom="sucesso">Publicado</Etiqueta>,
  falhou: <Etiqueta tom="erro">Não chegou ao site</Etiqueta>,
  pendente: <Etiqueta tom="aviso">Em publicação</Etiqueta>,
};

async function Tabela({ searchParams }: { searchParams: PageProps<"/admin/conteudo/historico">["searchParams"] }) {
  const barreira = await barrarSeNaoPuder();
  if (barreira) return barreira;
  const { antes } = await searchParams;
  const n = Number(Array.isArray(antes) ? antes[0] : antes);
  let h;
  try {
    h = await historico(Number.isInteger(n) && n > 0 ? n : undefined);
  } catch (e) {
    console.error(`[conteudo-site] histórico falhou: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    return <><h1>Histórico de publicações</h1><ErroAoAbrir o="o histórico" href="/admin/conteudo/historico" /></>;
  }
  return (
    <>
      <h1>Histórico de publicações</h1>
      <p className="apoio">Quem publicou, quando e qual bloco. O que mudou dentro do bloco não é guardado aqui, e não há botão para desfazer: para corrigir, edite o bloco e publique de novo.</p>
      {h.itens.length === 0 ? (
        <p>Ainda não há publicações.</p>
      ) : (
        <table className="historico">
          <thead>
            <tr><th scope="col">Data e hora</th><th scope="col">Quem publicou</th><th scope="col">Bloco</th><th scope="col">Situação</th></tr>
          </thead>
          <tbody>
            {h.itens.map((i) => (
              <tr key={i.numero}>
                <td data-rotulo="Data e hora">{formatarDataHora(i.quando)}</td>
                <td data-rotulo="Quem publicou">{i.origem === "migracao" ? "Conteúdo inicial" : (i.autor ?? <span className="suave">Conta removida</span>)}</td>
                <td data-rotulo="Bloco">{i.origem === "migracao" ? "Todos os blocos" : i.blocos.map((b) => BLOCOS[b].nome).join(", ")}</td>
                <td data-rotulo="Situação">
                  {SITUACAO[i.estado]}
                  {i.estado === "falhou" && <span className="ajuda"> O pedido de publicação falhou e o site não mudou.</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {h.proximo !== null && <p><Link className="botao botao-secundario" href={`/admin/conteudo/historico?antes=${h.proximo}`}>Ver mais antigas</Link></p>}
    </>
  );
}

export default function Page(props: PageProps<"/admin/conteudo/historico">) {
  return (
    <Suspense fallback={<><h1>Histórico de publicações</h1><Esqueleto linhas={5} /></>}>
      <Tabela searchParams={props.searchParams} />
    </Suspense>
  );
}
