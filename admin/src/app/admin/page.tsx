import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import { Suspense } from "react";
import { atende, exigirPapel } from "@/modules/contas/papeis";
import { PAPEL_CONTEUDO } from "@/modules/conteudo-site/permissao";
import { Esqueleto } from "./conteudo/estados";
import { CabecalhoPagina, TituloSecao } from "./conteudo/ui";

export const metadata = { title: "Painel | Loja N.UY", robots: { index: false } };

type Atalho = { href: string; titulo: string; texto: string; externo?: boolean };

function Atalhos({ itens }: { itens: Atalho[] }) {
  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "14px" }}>
      {itens.map((a) => (
        <li key={a.href}>
          <Card sx={{ height: "100%", transition: "border-color .15s", "&:hover": { borderColor: "primary.main" } }}>
            <CardActionArea href={a.href} target={a.externo ? "_blank" : undefined} rel={a.externo ? "noopener" : undefined} sx={{ p: "16px 18px", height: "100%", display: "block" }}>
              <Typography component="span" sx={{ display: "block", fontSize: 14, fontWeight: 700, color: "primary.main" }}>
                {a.titulo}{a.externo && <span className="so-leitor"> (abre em nova aba)</span>}
              </Typography>
              <Typography component="span" sx={{ display: "block", fontSize: 12.5, color: "text.secondary", mt: "4px" }}>{a.texto}</Typography>
            </CardActionArea>
          </Card>
        </li>
      ))}
    </Box>
  );
}

async function Inicio() {
  const usuario = await exigirPapel("operador"); // verificação no servidor, no ponto de acesso aos dados
  const conteudo = atende(usuario, PAPEL_CONTEUDO);
  const atalhos: Atalho[] = [
    ...(conteudo ? [
      { href: "/admin/conteudo", titulo: "Conteúdo do site", texto: "Textos, fotos e vídeos da home e da página da loja." },
      { href: "/admin/conteudo/historico", titulo: "Histórico", texto: "Quem publicou, quando e qual bloco." },
    ] : []),
    { href: "/", titulo: "Ver o site", texto: "Abre o site público como os clientes veem.", externo: true },
  ];
  return (
    <>
      <CabecalhoPagina titulo={`Olá, ${usuario.nome.trim().split(/\s+/)[0] || usuario.nome}`} subtitulo="Atalhos para o que você pode fazer no painel." />
      <TituloSecao>Atalhos</TituloSecao>
      <Atalhos itens={atalhos} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<><CabecalhoPagina titulo="Painel" /><Esqueleto linhas={3} /></>}>
      <Inicio />
    </Suspense>
  );
}
