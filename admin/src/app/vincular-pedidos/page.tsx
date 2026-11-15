import { Suspense } from "react";
import { exigirPapel } from "@/modules/contas/papeis";
import { confirmarVinculo, pedirVinculo } from "./actions";

export const metadata = { title: "Trazer pedidos | Loja N.UY", robots: { index: false }, referrer: "no-referrer" };

type Busca = Promise<{ token?: string; resultado?: string; n?: string }>;

async function Conteudo({ searchParams }: { searchParams: Busca }) {
  await exigirPapel("cliente");
  const { token, resultado, n } = await searchParams;
  if (resultado === "enviado") return <p>Enviamos um link para o e-mail da sua conta. Abra-o neste mesmo navegador (vale por 30 minutos).</p>;
  if (resultado === "ok") return <p>Pronto: {Number(n) || 0} pedido(s) feito(s) como visitante foram adicionados à sua conta.</p>;
  if (resultado === "invalido") return <p>Link inválido, expirado ou aberto em outra sessão. Peça um novo.</p>;
  if (token) {
    return (
      <form action={confirmarVinculo}>
        <input type="hidden" name="token" value={token} />
        <p>Confirmar a adição, à sua conta, dos pedidos feitos como visitante com o seu e-mail?</p>
        <button type="submit">Confirmar</button>
      </form>
    );
  }
  return (
    <form action={pedirVinculo}>
      <p>Para trazer para a conta os pedidos feitos como visitante, enviaremos um link ao e-mail da conta.</p>
      <button type="submit">Enviar link</button>
    </form>
  );
}

export default function Page(props: { searchParams: Busca }) {
  return (
    <main>
      <h1>Trazer pedidos de visitante</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
