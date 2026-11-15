import { FormReenviar } from "../formularios";

export const metadata = { title: "Confirmar e-mail | Loja N.UY" };

export default function Page() {
  return (
    <main>
      <h1>Confirmar e-mail</h1>
      <p>Abra o link enviado ao seu e-mail para confirmar o cadastro. O link vale por 1 hora. Não recebeu? Peça outro:</p>
      <FormReenviar />
    </main>
  );
}
