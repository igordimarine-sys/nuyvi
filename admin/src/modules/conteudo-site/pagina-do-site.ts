import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { obterPublicado, TAG_CONTEUDO_SITE } from "./leitura";
import { montar } from "./pagina";

/** HTML da página `/`: template + última versão publicada (sem versão, o template como está). Erro do banco propaga: não cacheia falha. */
export async function paginaDoSite(): Promise<string> {
  "use cache";
  cacheTag(TAG_CONTEUDO_SITE);
  cacheLife("max");
  const template = await readFile(join(process.cwd(), "src/site/index.html"), "utf8");
  const publicado = await obterPublicado();
  if (!publicado) return template;
  return montar(template, publicado.conteudo, { blobHost: process.env.NEXT_PUBLIC_BLOB_HOST ?? "", lojaUrl: "/loja" }).html;
}
