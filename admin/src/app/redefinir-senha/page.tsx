import Link from "next/link";
import { Suspense } from "react";
import { FormRedefinir } from "../formularios";
import { TelaAuth } from "../tela-auth";

export const metadata = { title: "Redefinir senha | Loja N.UY" };

async function Conteudo({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p className="auth-msg" role="alert">Link inválido ou expirado. Peça um novo em &ldquo;Esqueci a senha&rdquo;.</p>;
  return <FormRedefinir token={token} />;
}

export default function Page(props: { searchParams: Promise<{ token?: string }> }) {
  return (
    <TelaAuth titulo="Redefinir senha" rodape={<Link href="/login">Voltar para entrar</Link>}>
      <Suspense fallback={<p className="auth-apoio">Carregando...</p>}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </TelaAuth>
  );
}
