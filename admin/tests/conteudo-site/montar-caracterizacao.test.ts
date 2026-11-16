import { describe, expect, it } from "vitest";
import { montar } from "@/modules/conteudo-site/pagina";
import { readFileSync } from "node:fs";
import { HTML_SITE, PASTA_CONTEUDO, conteudoDoSite } from "./dados";

// Caracterização do `montar` de site/build.mjs (passo 1 da absorção do site pelo app, ADR-0007): fixa a saída atual para
// os dados de scripts/conteudo-inicial/. O port para TypeScript tem de reproduzir estes snapshots byte a byte.
// Se mudar de propósito o index.html ou o conteúdo inicial, atualize com `npx vitest run -u` e revise o diff.
const bruto = () => Object.fromEntries(["textos", "loja", "explore", "novidades", "planos"].map((n) => [n, JSON.parse(readFileSync(new URL(`conteudo-inicial/${n}.json`, PASTA_CONTEUDO), "utf8"))]));
const LOJA_URL = "https://loja.exemplo.test";
const BLOB_HOST = "abc123.public.blob.vercel-storage.com";

describe("montar() de pagina.ts (caracterização)", () => {
  it("index.html + conteúdo inicial, sem lojaUrl nem blobHost", async () => {
    const { html, trechos } = montar(HTML_SITE, bruto(), {});
    expect(trechos).toBeGreaterThan(0);
    await expect(html).toMatchFileSnapshot("./__snapshots__/index-sem-loja.html");
  });

  it("com lojaUrl e blobHost: botões dos cartões da Loja apontam para a loja (destino 'inicio')", async () => {
    const { html } = montar(HTML_SITE, conteudoDoSite(), { lojaUrl: LOJA_URL, blobHost: BLOB_HOST });
    expect(html).toContain(`href="${LOJA_URL}"`);
    await expect(html).toMatchFileSnapshot("./__snapshots__/index-com-loja.html");
  });
});
