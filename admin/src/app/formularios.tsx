"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { destinoDepoisDeEntrar } from "@/modules/contas/volta";

// Formulários mínimos, sem design. Mensagens genéricas: nunca dizem se o e-mail existe.
type Resultado = { ok: boolean; msg: string } | null;
const MUITAS = "Muitas tentativas. Aguarde um minuto e tente de novo.";

function Form({ onEnviar, children, rotulo }: {
  onEnviar: (d: FormData) => Promise<Resultado>;
  children: ReactNode;
  rotulo: string;
}) {
  const [res, setRes] = useState<Resultado>(null);
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOcupado(true);
    try {
      setRes(await onEnviar(new FormData(e.currentTarget)));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form onSubmit={enviar}>
      {children}
      <button type="submit" disabled={ocupado}>{rotulo}</button>
      {res && <p role={res.ok ? "status" : "alert"}>{res.msg}</p>}
    </form>
  );
}

const campo = (d: FormData, n: string) => String(d.get(n) ?? "");
const Email = () => <label>E-mail <input name="email" type="email" autoComplete="email" required /></label>;
const Senha = ({ nome = "senha", novo = false }: { nome?: string; novo?: boolean }) => (
  <label>Senha <input name={nome} type="password" autoComplete={novo ? "new-password" : "current-password"} required minLength={novo ? 10 : 1} maxLength={128} /></label>
);

export function FormEntrar() {
  const router = useRouter();
  return (
    <Form rotulo="Entrar" onEnviar={async (d) => {
      const { data, error } = await authClient.signIn.email({ email: campo(d, "email"), password: campo(d, "senha") });
      if (!error) {
        // Equipe vai para o painel; o papel aqui só escolhe o destino, /admin confere no servidor.
        const equipe = data?.user.role === "operador" || data?.user.role === "admin";
        router.push(destinoDepoisDeEntrar(equipe, new URLSearchParams(window.location.search).get("volta")));
        router.refresh();
        return { ok: true, msg: "Entrando..." };
      }
      return { ok: false, msg: error.status === 429 ? MUITAS : "E-mail ou senha incorretos, ou e-mail ainda não confirmado." };
    }}>
      <Email /><Senha />
    </Form>
  );
}

export function FormCadastrar() {
  return (
    <Form rotulo="Criar conta" onEnviar={async (d) => {
      const { error } = await authClient.signUp.email({
        name: campo(d, "nome"), email: campo(d, "email"), password: campo(d, "senha"), callbackURL: "/login",
      });
      if (error?.status === 429) return { ok: false, msg: MUITAS };
      if (error?.status === 400 || error?.status === 422) return { ok: false, msg: "Confira os dados: a senha precisa ter de 10 a 128 caracteres." };
      if (error) return { ok: false, msg: "Não foi possível criar a conta agora." };
      return { ok: true, msg: "Se o e-mail puder ser cadastrado, enviamos um link para confirmá-lo. Confirme antes de entrar." };
    }}>
      <label>Nome <input name="nome" autoComplete="name" required maxLength={100} /></label>
      <Email /><Senha novo />
    </Form>
  );
}

export function FormReenviar() {
  return (
    <Form rotulo="Reenviar link de confirmação" onEnviar={async (d) => {
      const { error } = await authClient.sendVerificationEmail({ email: campo(d, "email"), callbackURL: "/login" });
      return error?.status === 429
        ? { ok: false, msg: MUITAS }
        : { ok: true, msg: "Se houver um cadastro pendente para este e-mail, enviamos um novo link." };
    }}>
      <Email />
    </Form>
  );
}

export function FormEsqueci() {
  return (
    <Form rotulo="Enviar link" onEnviar={async (d) => {
      const { error } = await authClient.requestPasswordReset({ email: campo(d, "email"), redirectTo: "/redefinir-senha" });
      return error?.status === 429
        ? { ok: false, msg: MUITAS }
        : { ok: true, msg: "Se o e-mail tiver cadastro, enviamos um link para redefinir a senha (vale por 30 minutos)." };
    }}>
      <Email />
    </Form>
  );
}

export function FormRedefinir({ token }: { token: string }) {
  return (
    <Form rotulo="Redefinir senha" onEnviar={async (d) => {
      const { error } = await authClient.resetPassword({ newPassword: campo(d, "senha"), token });
      if (!error) return { ok: true, msg: "Senha alterada. Entre com a nova senha." };
      return { ok: false, msg: error.status === 429 ? MUITAS : "Link inválido ou expirado, ou senha fora do tamanho (10 a 128 caracteres)." };
    }}>
      <Senha novo />
    </Form>
  );
}

export function BotaoSair() {
  const router = useRouter();
  return (
    <button type="button" onClick={async () => { await authClient.signOut(); router.push("/login"); router.refresh(); }}>
      Sair
    </button>
  );
}
