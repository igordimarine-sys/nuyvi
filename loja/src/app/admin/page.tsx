import { Suspense } from "react";
import { exigirPapel } from "@/modules/contas/papeis";
import { BotaoSair } from "../formularios";

export const metadata = { title: "Painel | Loja N.UY", robots: { index: false } };

async function Painel() {
  const usuario = await exigirPapel("operador"); // verificação no servidor, no ponto de acesso aos dados
  return (
    <>
      <p>Papel: {usuario.papel}</p>
      <BotaoSair />
    </>
  );
}

export default function Page() {
  return (
    <main>
      <h1>Painel</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <Painel />
      </Suspense>
    </main>
  );
}
