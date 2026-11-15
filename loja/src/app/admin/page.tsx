import Link from "next/link";
import { Suspense } from "react";
import { atende, exigirPapel } from "@/modules/contas/papeis";
import { PAPEL_CONTEUDO } from "@/modules/conteudo-site/permissao";

export const metadata = { title: "Painel | Loja N.UY", robots: { index: false } };

async function Inicio() {
  const usuario = await exigirPapel("operador"); // verificação no servidor, no ponto de acesso aos dados
  return (
    <>
      <p>Olá, {usuario.nome}.</p>
      {atende(usuario, PAPEL_CONTEUDO) && <p><Link href="/admin/conteudo">Editar o conteúdo do site</Link></p>}
    </>
  );
}

export default function Page() {
  return (
    <>
      <h1>Painel</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <Inicio />
      </Suspense>
    </>
  );
}
