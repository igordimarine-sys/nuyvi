import { paginaDaLoja } from "@/modules/conteudo-site/pagina-da-loja";

// Mesmo padrão de `/`: o handler não lê cookie, header nem request; a página sai do cache e o estado de login é do navegador.
export async function GET() {
  return new Response(await paginaDaLoja(), { headers: { "content-type": "text/html; charset=utf-8" } });
}
