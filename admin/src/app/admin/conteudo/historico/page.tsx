import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { Suspense } from "react";
import { historico } from "@/modules/conteudo-site/leitura";
import { BLOCOS } from "@/modules/conteudo-site/schema";
import { barrarSeNaoPuder, ErroAoAbrir, Esqueleto } from "../estados";
import { CabecalhoPagina, Etiqueta, formatarDataHora } from "../ui";
import { unstable_rethrow } from "next/navigation";
import { descreverErro } from "@/lib/erro-log";

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
    unstable_rethrow(e); // redirect/notFound do Next não são falha
    console.error(`[conteudo-site] histórico falhou: ${descreverErro(e)}`);
    return <><CabecalhoPagina titulo="Histórico de publicações" /><ErroAoAbrir o="o histórico" href="/admin/conteudo/historico" /></>;
  }
  return (
    <>
      <CabecalhoPagina titulo="Histórico de publicações" subtitulo="Quem publicou, quando e qual bloco. O que mudou dentro do bloco não é guardado aqui, e não há botão para desfazer: para corrigir, edite o bloco e publique de novo." />
      {h.itens.length === 0 ? (
        <p>Ainda não há publicações.</p>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: 1000, mb: 2 }}>
          <Table className="historico">
            <TableHead>
              <TableRow><TableCell scope="col">Data e hora</TableCell><TableCell scope="col">Quem publicou</TableCell><TableCell scope="col">Bloco</TableCell><TableCell scope="col">Situação</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {h.itens.map((i) => (
                <TableRow key={i.numero} hover>
                  <TableCell data-rotulo="Data e hora">{formatarDataHora(i.quando)}</TableCell>
                  <TableCell data-rotulo="Quem publicou">{i.origem === "migracao" ? "Conteúdo inicial" : (i.autor ?? <span className="suave">Conta removida</span>)}</TableCell>
                  <TableCell data-rotulo="Bloco">{i.origem === "migracao" ? "Todos os blocos" : i.blocos.map((b) => BLOCOS[b].nome).join(", ")}</TableCell>
                  <TableCell data-rotulo="Situação">
                    {SITUACAO[i.estado]}
                    {i.estado === "falhou" && <span className="ajuda"> O pedido de publicação falhou e o site não mudou.</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {h.proximo !== null && <Button variant="outlined" color="inherit" href={`/admin/conteudo/historico?antes=${h.proximo}`}>Ver mais antigas</Button>}
    </>
  );
}

export default function Page(props: PageProps<"/admin/conteudo/historico">) {
  return (
    <Suspense fallback={<><CabecalhoPagina titulo="Histórico de publicações" /><Esqueleto linhas={5} /></>}>
      <Tabela searchParams={props.searchParams} />
    </Suspense>
  );
}
