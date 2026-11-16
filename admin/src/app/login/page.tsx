import Link from "next/link";
import { googleConfigurado } from "@/lib/env";
import { BotaoGoogle, FormEntrar } from "../formularios";
import { OuSeparador, TelaAuth } from "../tela-auth";

export const metadata = { title: "Entrar | Loja N.UY" };

export default function Page() {
  return (
    <TelaAuth
      titulo="Entrar"
      apoio="Acesse sua conta para acompanhar pedidos e comprar mais rápido."
      rodape={<><Link href="/cadastrar" className="auth-destaque">Criar conta</Link><Link href="/esqueci-senha">Esqueci a senha</Link><Link href="/confirmar-email">Reenviar confirmação</Link></>}
    >
      <FormEntrar />
      {googleConfigurado && <><OuSeparador /><BotaoGoogle /></>}
    </TelaAuth>
  );
}
