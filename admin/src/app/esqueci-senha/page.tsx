import Link from "next/link";
import { FormEsqueci } from "../formularios";
import { TelaAuth } from "../tela-auth";

export const metadata = { title: "Esqueci a senha | Loja N.UY" };

export default function Page() {
  return (
    <TelaAuth titulo="Esqueci a senha" apoio="Informe o e-mail da conta para receber um link de redefinição." rodape={<Link href="/login">Voltar para entrar</Link>}>
      <FormEsqueci />
    </TelaAuth>
  );
}
