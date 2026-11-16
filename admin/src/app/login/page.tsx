import Link from "next/link";
import { googleConfigurado } from "@/lib/env";
import { BotaoGoogle, FormEntrar } from "../formularios";

export const metadata = { title: "Entrar | Loja N.UY" };

export default function Page() {
  return (
    <main>
      <h1>Entrar</h1>
      <FormEntrar />
      {googleConfigurado && <BotaoGoogle />}
      <p><Link href="/esqueci-senha">Esqueci a senha</Link> · <Link href="/cadastrar">Criar conta</Link> · <Link href="/confirmar-email">Reenviar confirmação</Link></p>
    </main>
  );
}
