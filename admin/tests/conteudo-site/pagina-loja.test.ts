import { describe, expect, it } from "vitest";
import type { ProdutoVitrine } from "@/modules/catalogo/vitrine";
import { montarLoja } from "@/modules/conteudo-site/pagina";
import { readFileSync } from "node:fs";
import { conteudoComBlocosNovos, conteudoDoSite, HTML_SITE } from "./dados";

// HTML de /loja (ADR-0007 A3, CA-LOJ-67, 78 a 80, RN-LOJ-30). O template de /loja é o arquivo real.
const LOJA = readFileSync(new URL("../../src/site/loja.html", import.meta.url), "utf8");
const produto = (o: Partial<ProdutoVitrine> = {}): ProdutoVitrine => ({ id: "1", nome: "Tênis", categoria: "Calçados", fotoUrl: "https://abc.exemplo.test/a.jpg", fotoAlt: "Tênis azul", precoCentavos: 19990, variaPreco: false, esgotado: false, ...o });
const loja = (produtos: ProdutoVitrine[], c = conteudoComBlocosNovos()) => montarLoja(LOJA, HTML_SITE, c, produtos, { lojaUrl: "/loja" });

describe("montarLoja", () => {
  it("cabeçalho e rodapé são os da home, com links absolutos, sem pausa e com a loja marcada como página atual", () => {
    const out = loja([]);
    expect(out).toContain('<header class="topo">');
    expect(out).toContain('<a class="marca" href="/"');
    expect(out).toContain('<li><a href="/#videos">Vídeos</a></li>');
    expect(out).toContain('href="/#baixar">Baixar</a>');
    expect(out).toContain('src="/img/logo-header.webp"');
    expect(out).toContain('href="/politica-de-privacidade.html"');
    expect(out).not.toContain('class="pausa"');
    expect(out).not.toContain('href="#videos"');
    expect(out).toContain('data-conta data-estado="carregando"'); // o mesmo grupo de conta da home
    expect(out).toContain('id="dados-lojas"');
    expect(out).toContain('<script src="/js/conta.js" defer></script>');
    expect(out).not.toContain("gsap");
  });

  it("o item de menu que leva a /loja ganha aria-current", () => {
    const c = conteudoComBlocosNovos();
    c.textos.geral!.menu = [{ texto: "Loja", destino: "/loja" }, { texto: "Planos", destino: "#premium" }];
    const out = loja([], c);
    expect(out).toContain('<li><a href="/loja" aria-current="page">Loja</a></li>');
    expect(out).toContain('<li><a href="/#premium">Planos</a></li>');
  });

  it("textos do bloco pagina-loja: título da página, descrição, rótulo, título, abertura e estado vazio (CA-LOJ-67, 79)", () => {
    const c = conteudoComBlocosNovos();
    Object.assign(c.textos.paginaLoja!, { seoTitulo: "Minha <loja>", seoDescricao: "Tudo & mais", rotulo: "Rótulo", titulo1: "Linha 1", titulo2: "Linha 2", abertura: "Abertura \"x\"", vazio: "Volte logo" });
    const out = loja([], c);
    expect(out).toContain("<title>Minha &lt;loja&gt;</title>");
    expect(out).toContain('content="Tudo &amp; mais"');
    expect(out).toContain('<span class="rotulo">Rótulo</span>');
    expect(out).toContain("<span>Linha 1</span>");
    expect(out).toContain('<span class="vazado">Linha 2</span>');
    expect(out).toContain("Abertura &quot;x&quot;");
    expect(out).toContain('<div class="loja-vazio"><p class="loja-vazio-texto sol">Volte logo</p></div>');
    expect(out).not.toContain("loja-grade");
  });

  it("sem os blocos novos (versão antiga) ou sem nenhuma versão, usa os textos do template e não quebra", () => {
    expect(loja([], conteudoDoSite())).toContain('<p class="loja-vazio-texto sol">Em breve</p>');
    const vazia = montarLoja(LOJA, HTML_SITE, null, [], {});
    expect(vazia).toContain("<title>Loja N.UY</title>");
    expect(vazia).toContain("Em breve");
  });

  it("produtos: nome, categoria, foto, preço em reais, 'a partir de' só quando os preços diferem, 'Esgotado' com a palavra", () => {
    const out = loja([
      produto({ nome: "Tênis A", variaPreco: true, precoCentavos: 123456 }),
      produto({ nome: "Camisa", categoria: "Roupas", precoCentavos: 5000, fotoUrl: null, esgotado: true }),
    ]);
    expect(out).toContain('<ul class="loja loja-grade" role="list">');
    expect(out).toContain('<h3>Tênis A</h3>');
    expect(out).toContain('<small>a partir de</small>R$ 1.234,56</p>');
    expect(out).toContain('<span class="rotulo">Roupas</span><h3>Camisa</h3><p class="preco-produto">R$ 50,00</p>');
    expect(out).toContain('<span class="etiqueta-esgotado">Esgotado</span>');
    expect(out.match(/produto-esgotado/g)).toHaveLength(1);
    expect(out).toContain('<img src="https://abc.exemplo.test/a.jpg" alt="Tênis azul">');
    expect(out).not.toMatch(/carrinho|comprar/i); // sem carrinho nem compra
    expect(out).not.toMatch(/<article[^>]*>.*<a /); // o cartão não é link
  });

  it("tudo do catálogo é escapado; foto só com https ou caminho do próprio site", () => {
    const out = loja([
      produto({ nome: '<script>alert(1)</script>', categoria: '"><img onerror=x>', fotoAlt: '" onerror="x' }),
      produto({ nome: "Fotos ruins", fotoUrl: "javascript:alert(1)" }),
      produto({ nome: "Protocolo relativo", fotoUrl: "//evil.example/x.jpg" }),
      produto({ nome: "Do site", fotoUrl: "/img/x.webp" }),
    ]);
    expect(out).not.toContain("<script>alert(1)");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).toContain('alt="&quot; onerror=&quot;x"');
    expect(out).not.toContain("javascript:alert");
    expect(out).not.toContain("//evil.example");
    expect(out).toContain('<img src="/img/x.webp"');
  });

  it("as duas primeiras fotos sem lazy, as demais com", () => {
    const out = loja([produto({ nome: "1" }), produto({ nome: "2" }), produto({ nome: "3" })]);
    expect(out.match(/<img src="https:\/\/abc[^>]*>/g)!.map((i) => i.includes('loading="lazy"'))).toEqual([false, false, true]);
  });
});
