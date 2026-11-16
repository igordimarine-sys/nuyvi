import Link from "next/link";
import { FormReenviar } from "../formularios";
import { TelaAuth } from "../tela-auth";

export const metadata = { title: "Confirmar e-mail | Loja N.UY" };

export default function Page() {
  return (
    <TelaAuth
      titulo="Confirmar e-mail"
      apoio="Abra o link enviado ao seu e-mail para confirmar o cadastro. O link vale por 1 hora. Não recebeu? Peça outro:"
      rodape={<Link href="/login">Voltar para entrar</Link>}
    >
      <FormReenviar />
    </TelaAuth>
  );
}
