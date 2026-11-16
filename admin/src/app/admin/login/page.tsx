import Link from "next/link";
import { FormEntrar } from "../../formularios";
import { TelaAuth } from "../../tela-auth";

export const metadata = { title: "Entrar no painel | Loja N.UY", robots: { index: false } };

// Entrada da equipe (operador e admin). Clientes entram em /login.
export default function Page() {
  return (
    <TelaAuth dentroDoPainel titulo="Painel" apoio="Entrada da equipe N.UY." rodape={<Link href="/esqueci-senha">Esqueci a senha</Link>}>
      <FormEntrar painel />
    </TelaAuth>
  );
}
