import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { TAG_CATALOGO, vitrine } from "@/modules/catalogo/vitrine";
import { obterPublicado, TAG_CONTEUDO_SITE } from "./leitura";
import { montarLoja } from "./pagina";

/** HTML de `/loja`: textos do bloco `pagina-loja` + produtos do catálogo. Revalidado pelas tags `conteudo-site` e `catalogo`. Erro do banco propaga. */
export async function paginaDaLoja(): Promise<string> {
  "use cache";
  cacheTag(TAG_CONTEUDO_SITE, TAG_CATALOGO);
  cacheLife("max");
  const [loja, home, publicado, produtos] = await Promise.all([
    readFile(join(process.cwd(), "src/site/loja.html"), "utf8"),
    readFile(join(process.cwd(), "src/site/index.html"), "utf8"),
    obterPublicado(),
    vitrine(),
  ]);
  return montarLoja(loja, home, publicado?.conteudo ?? null, produtos, { blobHost: process.env.NEXT_PUBLIC_BLOB_HOST ?? "", lojaUrl: "/loja" });
}
