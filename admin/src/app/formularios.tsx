"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { destinoDepoisDeEntrar, voltaSegura } from "@/modules/contas/volta";

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

/** `painel`: entrada da equipe (/admin/login). Cliente que entrar por ela tem a sessão encerrada na hora; /admin confere no servidor de qualquer forma. */
export function FormEntrar({ painel = false }: { painel?: boolean }) {
  const router = useRouter();
  return (
    <Form rotulo="Entrar" onEnviar={async (d) => {
      const { data, error } = await authClient.signIn.email({ email: campo(d, "email"), password: campo(d, "senha") });
      if (!error) {
        // Equipe vai para o painel; o papel aqui só escolhe o destino, /admin confere no servidor.
        const equipe = data?.user.role === "operador" || data?.user.role === "admin";
        if (painel && !equipe) {
          await authClient.signOut();
          return { ok: false, msg: "Esta entrada é só para a equipe da N.UY. Clientes entram em /login." };
        }
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

// Códigos que o Better Auth põe em /login?error= quando o retorno do Google falha.
const ERROS_GOOGLE: Record<string, string> = {
  access_denied: "Entrada com o Google cancelada.",
  account_not_linked: "Já existe uma conta com este e-mail, ainda não confirmada. Confirme o e-mail (ou use \"Esqueci a senha\") e depois entre com o Google.",
  email_not_verified: "O Google não confirmou este e-mail. Use outra conta Google ou crie a conta com e-mail e senha.",
  CONTA_EQUIPE: "Contas da equipe entram em /admin/login, com e-mail e senha.",
};

const semAssinatura = () => () => {};

/** Só clientes (/login e /cadastrar); a página só mostra se GOOGLE_CLIENT_ID/SECRET existirem. O servidor recusa conta de equipe. */
export function BotaoGoogle() {
  const [ocupado, setOcupado] = useState(false);
  const [erroClique, setErro] = useState<string | null>(null);
  // ?error= da URL: no servidor (e na hidratação) vale vazio; no navegador, o da barra de endereço.
  const codigo = useSyncExternalStore(semAssinatura, () => new URLSearchParams(window.location.search).get("error"), () => null);
  const erro = erroClique ?? (codigo ? ERROS_GOOGLE[codigo] ?? "Não foi possível entrar com o Google. Tente de novo." : null);
  async function entrar() {
    setOcupado(true);
    const volta = voltaSegura(new URLSearchParams(window.location.search).get("volta"));
    // Sucesso redireciona para o Google; em falha no retorno, o Better Auth volta para /login?error=<código>.
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: volta ?? "/", errorCallbackURL: "/login" });
    if (error) {
      setErro(error.status === 429 ? MUITAS : "Não foi possível entrar com o Google. Tente de novo.");
      setOcupado(false);
    }
  }
  return (
    <div>
      <button type="button" onClick={entrar} disabled={ocupado}>Entrar com Google</button>
      {erro && <p role="alert">{erro}</p>}
    </div>
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

/** Sair do painel (só usado em /admin): volta para a entrada da equipe. */
export function BotaoSair() {
  const router = useRouter();
  return (
    <button type="button" onClick={async () => { await authClient.signOut(); router.push("/admin/login"); router.refresh(); }}>
      Sair
    </button>
  );
}
