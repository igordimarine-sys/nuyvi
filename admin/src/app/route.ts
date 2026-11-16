import { paginaDoSite } from "@/modules/conteudo-site/pagina-do-site";

export async function GET() {
  return new Response(await paginaDoSite(), { headers: { "content-type": "text/html; charset=utf-8" } });
}
