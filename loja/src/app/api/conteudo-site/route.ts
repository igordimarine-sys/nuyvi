import { obterPublicado } from "@/modules/conteudo-site/leitura";

// Público de propósito: é o que o build do site (CONTEUDO_URL) lê. Devolve só o conteúdo da última versão publicada
// (nada de autor, data ou histórico). Sem cache: um build disparado logo após publicar precisa ver a versão nova.
const CABECALHOS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  try {
    const publicado = await obterPublicado();
    if (!publicado) return Response.json({ erro: "Nenhum conteúdo publicado." }, { status: 404, headers: CABECALHOS });
    return Response.json(publicado.conteudo, { headers: { ...CABECALHOS, "X-Conteudo-Versao": String(publicado.numero) } });
  } catch (e) {
    console.error(`[conteudo-site] leitura pública falhou: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    return Response.json({ erro: "Conteúdo indisponível." }, { status: 500, headers: CABECALHOS });
  }
}
