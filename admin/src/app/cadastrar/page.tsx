import Link from "next/link";
import { FormCadastrar } from "../formularios";

export const metadata = { title: "Criar conta | Loja N.UY" };

export default function Page() {
  return (
    <main>
      <h1>Criar conta</h1>
      <FormCadastrar />
      <p><Link href="/entrar">Já tenho conta</Link></p>
    </main>
  );
}
