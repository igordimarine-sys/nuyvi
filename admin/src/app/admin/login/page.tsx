import Link from "next/link";
import { FormEntrar } from "../../formularios";

export const metadata = { title: "Entrar no painel | Loja N.UY", robots: { index: false } };

// Entrada da equipe (operador e admin). Clientes entram em /login.
export default function Page() {
  return (
    <>
      <h1>Entrar no painel</h1>
      <FormEntrar painel />
      <p><Link href="/esqueci-senha">Esqueci a senha</Link></p>
    </>
  );
}
