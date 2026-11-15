import { describe, expect, it } from "vitest";
import { montar } from "../../../site/build.mjs";
import { GET } from "@/app/api/conteudo-site/route";
import { obterPublicado } from "@/modules/conteudo-site/leitura";
import { publicar } from "@/modules/conteudo-site/publicar";
import { conteudoSchema, type Conteudo } from "@/modules/conteudo-site/schema";
import { sessaoDe } from "../contas/sessao-falsa";
import { conteudoDoSite, configurarHook, entrarComo, HOOK, HTML_SITE, semearVersao } from "./dados";

// Contrato painel x site (ADR-0006, RISCO-16): o conteúdo que o painel aceita e a loja entrega PRECISA gerar o mesmo HTML no
// site/build.mjs, e o que o painel recusa o build também recusa. Se as regras divergirem, o site falha DEPOIS de "publicado".
const LOJA = "https://loja.exemplo.test";
const BLOB = "https://abc123.public.blob.vercel-storage.com/conteudo/foto-Xy12.webp";
const clonar = <T,>(x: T): T => structuredClone(x);

describe("contrato build.mjs x conteúdo da loja", () => {
  it("o index.html atual é reproduzido sem nenhuma diferença a partir do conteúdo do site", () => {
    const { html, trechos } = montar(HTML_SITE, conteudoDoSite());
    expect(trechos).toBeGreaterThan(20);
    expect(html).toBe(HTML_SITE);
  });

  it("o conteúdo servido pelo endpoint (passando pelo JSON) gera o mesmo HTML que o conteúdo direto", async () => {
    await semearVersao();
    sessaoDe(null);
    const pelaApi = (await (await GET()).json()) as Conteudo;
    const direto = montar(HTML_SITE, conteudoDoSite()).html;
    expect(montar(HTML_SITE, pelaApi).html).toBe(direto);
    expect(montar(HTML_SITE, (await obterPublicado())!.conteudo).html).toBe(direto);
  });

  it("o destino do botão da Loja vira a URL da loja (LOJA_URL); sem ela continua em #baixar", () => {
    const sem = montar(HTML_SITE, conteudoDoSite()).html;
    const com = montar(HTML_SITE, conteudoDoSite(), { lojaUrl: LOJA }).html;
    expect(sem.match(/class="produto" href="#baixar"/g)).toHaveLength(2);
    expect(com.match(new RegExp(`class="produto" href="${LOJA}"`, "g"))).toHaveLength(2);
  });

  it("o que o painel publica de verdade (foto do Blob, texto com HTML) gera HTML válido e escapado", async () => {
    await entrarComo("admin");
    await semearVersao();
    configurarHook({ SITE_DEPLOY_HOOK_URL: HOOK });
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 201 });
    try {
      const planos = conteudoDoSite().planos;
      planos.planos[0] = { ...planos.planos[0]!, capa: BLOB, selo: "<b>Novo</b> & \"melhor\"", mensal: 19.9 };
      expect((await publicar({ bloco: "planos", dados: planos, versaoBase: 1 })).tipo).toBe("publicado");
      const n = conteudoDoSite().novidades;
      n.noticias[0] = { ...n.noticias[0]!, titulo: "<script>alert(1)</script>", imagem: BLOB };
      expect((await publicar({ bloco: "novidades", dados: n, versaoBase: 2 })).tipo).toBe("publicado");
    } finally {
      globalThis.fetch = fetchOriginal;
      configurarHook({});
    }
    const { html } = montar(HTML_SITE, (await obterPublicado())!.conteudo);
    expect(html).toContain(`src="${BLOB}"`);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;b&gt;Novo&lt;/b&gt;"); // selo (também dentro do JSON dos planos) escapado
    expect(html).not.toMatch(/<b>Novo/);
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
      ["imagem do Blob fora de conteudo/", (c) => { c.novidades.noticias[0]!.imagem = "https://abc123.public.blob.vercel-storage.com/outra/x.png"; }],
      ["SVG no Blob", (c) => { c.novidades.noticias[0]!.imagem = "https://abc123.public.blob.vercel-storage.com/conteudo/x.svg"; }],
      ["link do Explore que não é seção", (c) => { c.explore.cartoes[0]!.link = "#outra"; }],
      ["destino da Loja inválido", (c) => { c.loja.produtos[0]!.destino = "http://evil.example"; }],
    ];
    for (const [nome, mutar] of casos) {
      const c = clonar(conteudoDoSite());
      mutar(c);
      expect(conteudoSchema.safeParse(c).success, `painel deveria recusar: ${nome}`).toBe(false);
      expect(() => montar(HTML_SITE, c, { lojaUrl: LOJA }), `build deveria recusar: ${nome}`).toThrow(/conteudo inválido/);
    }
  });
});
