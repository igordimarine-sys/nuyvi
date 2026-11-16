import Link from "next/link";
import { googleConfigurado } from "@/lib/env";
import { BotaoGoogle, FormCadastrar } from "../formularios";
import { OuSeparador, TelaAuth } from "../tela-auth";

export const metadata = { title: "Criar conta | Loja N.UY" };

export default function Page() {
  return (
    <TelaAuth titulo="Criar conta" rodape={<Link href="/login" className="auth-destaque">Já tenho conta</Link>}>
      <FormCadastrar />
      {googleConfigurado && <><OuSeparador /><BotaoGoogle /></>}
    </TelaAuth>
  );
}
