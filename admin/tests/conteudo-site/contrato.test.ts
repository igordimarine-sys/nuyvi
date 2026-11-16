import { describe, expect, it } from "vitest";
import { montar } from "@/modules/conteudo-site/pagina";
import { obterPublicado } from "@/modules/conteudo-site/leitura";
import { publicar } from "@/modules/conteudo-site/publicar";
import { conteudoSchema, type Conteudo } from "@/modules/conteudo-site/schema";
import { conteudoComBlocosNovos, conteudoDoSite, entrarComo, HTML_SITE, semearVersao } from "./dados";

// Contrato painel x página (ADR-0007): o conteúdo que o painel aceita PRECISA gerar HTML em `montar` (pagina.ts), e o que o
// painel recusa o `montar` também recusa. Se as regras divergirem, `/` quebra DEPOIS de "publicado".
const LOJA = "https://loja.exemplo.test";
const HOST = "abc123.public.blob.vercel-storage.com"; // = NEXT_PUBLIC_BLOB_HOST do vitest.config
const BLOB = `https://${HOST}/conteudo/foto-Xy12.webp`;
const ANTIGOS = "textos\\.(?:hero\\.(?:frase|plataformas)|rede\\.(?:titulo[12]|texto)|(?:bonus|historia|baixar)\\.(?:rotulo|titulo[12]|texto|itens))|loja\\.(?:rotulo|titulo[12]|produtos)|explore\\.cartoes|novidades\\.noticias|planos\\.(?:economia|nota|dados)";
const MARCADOR_NOVO = new RegExp(`<!--/?cms:(?!(?:${ANTIGOS})-->)[\\w.]+-->`, "g");
const clonar = <T,>(x: T): T => structuredClone(x);

describe("contrato painel x pagina.ts", () => {
  it("o index.html atual é reproduzido sem nenhuma diferença a partir do conteúdo do site", () => {
    const { html, trechos } = montar(HTML_SITE, conteudoDoSite());
    expect(trechos).toBeGreaterThan(20);
    // os marcadores dos campos novos (A1) não vão para o HTML servido; os antigos continuam
    expect(html).toBe(HTML_SITE.replace(MARCADOR_NOVO, ""));
    expect(montar(HTML_SITE, conteudoComBlocosNovos()).html).toBe(html);
  });

  it("o conteúdo gravado no banco (passando pelo JSON) gera o mesmo HTML que o conteúdo direto", async () => {
    await semearVersao();
    const direto = montar(HTML_SITE, conteudoDoSite()).html;
    expect(montar(HTML_SITE, (await obterPublicado())!.conteudo).html).toBe(direto);
  });

  it("o destino do botão da Loja vira a URL da loja (lojaUrl); sem ela continua em #baixar", () => {
    const sem = montar(HTML_SITE, conteudoDoSite()).html;
    const com = montar(HTML_SITE, conteudoDoSite(), { lojaUrl: LOJA }).html;
    expect(sem.match(/class="produto" href="#baixar"/g)).toHaveLength(2);
    expect(com.match(new RegExp(`class="produto" href="${LOJA}"`, "g"))).toHaveLength(2);
  });

  it("o que o painel publica de verdade (foto do Blob, texto com HTML) gera HTML válido e escapado", async () => {
    await entrarComo("admin");
    await semearVersao();
    const planos = conteudoDoSite().planos;
    planos.planos[0] = { ...planos.planos[0]!, capa: BLOB, selo: "<b>Novo</b> & \"melhor\"", mensal: 19.9 };
    expect((await publicar({ bloco: "planos", dados: planos, versaoBase: 1 })).tipo).toBe("publicado");
    const n = conteudoDoSite().novidades;
    n.noticias[0] = { ...n.noticias[0]!, titulo: "<script>alert(1)</script>", imagem: BLOB };
    expect((await publicar({ bloco: "novidades", dados: n, versaoBase: 2 })).tipo).toBe("publicado");
    const { html } = montar(HTML_SITE, (await obterPublicado())!.conteudo, { blobHost: HOST });
    expect(html).toContain(`src="${BLOB}"`);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;b&gt;Novo&lt;/b&gt;"); // selo (também dentro do JSON dos planos) escapado
    expect(html).not.toMatch(/<b>Novo/);
  });

  it("sem o host do Blob configurado no build, só img/... é aceito", () => {
    const c = conteudoDoSite();
    c.novidades.noticias[0]!.imagem = BLOB;
    expect(() => montar(HTML_SITE, c)).toThrow(/conteudo inválido/);
    expect(() => montar(HTML_SITE, c, { blobHost: HOST })).not.toThrow();
  });

  it("os dois lados recusam o mesmo conteúdo inválido", () => {
    const casos: [string, (c: Conteudo) => void][] = [
      ["título do Explore vazio", (c) => { c.explore.cartoes[0]!.titulo = ""; }],
      ["texto só com espaços", (c) => { c.textos.historia.texto = "   "; }],
      ["lista do Explore vazia", (c) => { c.explore.cartoes = []; }],
      ["lista 'O que inclui' vazia", (c) => { c.planos.planos[0]!.itens = []; }],
      ["desconto anual 100", (c) => { c.planos.desconto_anual = 100; }],
      ["desconto anual negativo", (c) => { c.planos.desconto_anual = -1; }],
      ["preço mensal negativo", (c) => { c.planos.planos[0]!.mensal = -5; }],
      ["imagem fora de img/", (c) => { c.novidades.noticias[0]!.imagem = "http://evil.example/x.png"; }],
      ["imagem com ..", (c) => { c.novidades.noticias[0]!.imagem = "img/../segredo.png"; }],
      ["imagem de outro store Blob", (c) => { c.novidades.noticias[0]!.imagem = "https://zzz999.public.blob.vercel-storage.com/conteudo/x.png"; }],
      ["imagem do Blob fora de conteudo/", (c) => { c.novidades.noticias[0]!.imagem = `https://${HOST}/outra/x.png`; }],
      ["SVG no Blob", (c) => { c.novidades.noticias[0]!.imagem = `https://${HOST}/conteudo/x.svg`; }],
      ["link do Explore que não é seção", (c) => { c.explore.cartoes[0]!.link = "#outra"; }],
      ["destino da Loja inválido", (c) => { c.loja.produtos[0]!.destino = "http://evil.example"; }],
    ];
    for (const [nome, mutar] of casos) {
      const c = clonar(conteudoDoSite());
      mutar(c);
      expect(conteudoSchema.safeParse(c).success, `painel deveria recusar: ${nome}`).toBe(false);
      expect(() => montar(HTML_SITE, c, { lojaUrl: LOJA, blobHost: HOST }), `build deveria recusar: ${nome}`).toThrow(/conteudo inválido/);
    }
  });
});
