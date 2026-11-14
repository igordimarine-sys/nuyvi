import { Suspense } from "react";
import { FormRedefinir } from "../formularios";

export const metadata = { title: "Redefinir senha | Loja N.UY" };

async function Conteudo({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p>Link inválido ou expirado. Peça um novo em &ldquo;Esqueci a senha&rdquo;.</p>;
  return <FormRedefinir token={token} />;
}

export default function Page(props: { searchParams: Promise<{ token?: string }> }) {
  return (
    <main>
      <h1>Redefinir senha</h1>
      <Suspense fallback={<p>Carregando...</p>}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
