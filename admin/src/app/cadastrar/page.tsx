import Link from "next/link";
import { googleConfigurado } from "@/lib/env";
import { BotaoGoogle, FormCadastrar } from "../formularios";

export const metadata = { title: "Criar conta | Loja N.UY" };

export default function Page() {
  return (
    <main>
      <h1>Criar conta</h1>
      <FormCadastrar />
      {googleConfigurado && <BotaoGoogle />}
      <p><Link href="/login">Já tenho conta</Link></p>
    </main>
  );
}
