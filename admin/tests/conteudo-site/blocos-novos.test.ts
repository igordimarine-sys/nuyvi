import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { montar } from "@/modules/conteudo-site/pagina";
import { obterPublicado } from "@/modules/conteudo-site/leitura";
import { BLOCOS, conteudoSchema, SLUGS, videoValido, type Conteudo } from "@/modules/conteudo-site/schema";
import { conteudoComBlocosNovos, conteudoDoSite, HTML_SITE, semearVersao, versoes } from "./dados";

// Blocos novos (ADR-0007 A1): campos editáveis do site inteiro. Sem eles (versão antiga) o template fica como está.
const HOST = "abc123.public.blob.vercel-storage.com";
const BLOB_VIDEO = `https://${HOST}/conteudo/video-Ab12.mp4`;
const clonar = <T,>(x: T): T => structuredClone(x);
const html = (c: Conteudo) => montar(HTML_SITE, c, { blobHost: HOST }).html;

// Limites de tamanho e de quantidade são só do painel; `montar` não os repete.
const SO_SCHEMA = new Set(["título com mais de 60 caracteres", "menu vazio", "frase que troca com 1 palavra"]);

describe("montar() com os blocos novos", () => {
  it("valores iniciais geram exatamente o mesmo HTML que o conteúdo sem os blocos novos", () => {
    expect(html(conteudoComBlocosNovos())).toBe(html(conteudoDoSite()));
  });

  it("o HTML servido não carrega marcadores dos campos novos", () => {
    const out = html(conteudoComBlocosNovos());
    expect(out).not.toMatch(/<!--cms:textos\.(geral|videos)\./);
    expect(out).not.toContain("<!--cms:planos.rotulo");
    expect(out).toContain("<!--cms:textos.hero.frase-->"); // os antigos continuam
  });

  it("gera título, menu, rodapé, vídeos, frase que troca, lojas de apps e newsletter a partir do conteúdo", () => {
    const c = clonar(conteudoComBlocosNovos());
    const g = c.textos.geral!;
    g.seoTitulo = "Título <novo> & cia";
    g.menu = [{ texto: "Início", destino: "/" }, { texto: "Loja online", destino: "/loja" }];
    g.rodapeLinks = [{ texto: "Termos", destino: "termos-de-uso.html" }];
    g.lojaIos = "https://apps.apple.com/br/app/nuy/id1";
    g.lojaDica = "Chega logo";
    g.newsInvalido = "E-mail errado </script>";
    g.versao = "";
    g.entrarLongo = "Entrar \"já\"";
    c.textos.videos!.trocaPalavras = ["um", "dois", "três"];
    c.textos.videos!.grandeVideo = BLOB_VIDEO;
    c.textos.hero.videoCelular = "";
    const out = html(c);
    expect(out).toContain("<title>Título &lt;novo&gt; &amp; cia</title>");
    expect(out).toContain('<li><a href="/loja">Loja online</a></li>');
    expect(out).not.toContain("Novidades</a></li>\n      </ul>");
    expect(out).toContain('<ul>\n        <li><a href="termos-de-uso.html">Termos</a></li>\n      </ul>');
    expect(out).toContain(`<video src="${BLOB_VIDEO}"`);
    expect(out).not.toContain("data-src-cel");
    expect(out).toContain('aria-label="Aqui você encontra um, dois e três"');
    expect(out).toContain('<i class="atual"></i><i></i><i></i></span>');
    expect(out).toContain('{"ios":"https://apps.apple.com/br/app/nuy/id1","android":"","dica":"Chega logo"}');
    expect(out).toContain('data-invalido="E-mail errado &lt;/script&gt;"'); // texto do painel nunca vira HTML
    expect(out).toContain('<div class="base"><span>© 2026 N.UY. Todos os direitos reservados.</span></div>');
    expect(out).toContain('aria-label="Entrar &quot;já&quot;"');
  });

  it("recusa o que o painel recusa: link fora da lista, endereço sem https, vídeo fora de video/ e do Blob", () => {
    const casos: [string, (c: Conteudo) => void][] = [
      ["link do menu fora da lista", (c) => { c.textos.geral!.menu[0]!.destino = "https://evil.example"; }],
      ["link javascript no rodapé", (c) => { c.textos.geral!.rodapeLinks[0]!.destino = "javascript:alert(1)"; }],
      ["App Store em http", (c) => { c.textos.geral!.lojaIos = "http://apps.apple.com/x"; }],
      ["Google Play com javascript:", (c) => { c.textos.geral!.lojaAndroid = "javascript:alert(1)"; }],
      ["vídeo de outro host", (c) => { c.textos.videos!.grandeVideo = "https://evil.example/conteudo/x.mp4"; }],
      ["vídeo com ..", (c) => { c.textos.hero.video = "video/../x.mp4"; }],
      ["vídeo com extensão errada", (c) => { c.textos.hero.video = "video/x.avi"; }],
      ["poster inválido", (c) => { c.textos.rede.poster = "http://evil.example/x.png"; }],
      ["frase que troca com 1 palavra", (c) => { c.textos.videos!.trocaPalavras = ["só uma"]; }],
      ["menu vazio", (c) => { c.textos.geral!.menu = []; }],
      ["título com mais de 60 caracteres", (c) => { c.textos.geral!.seoTitulo = "x".repeat(61); }],
    ];
    for (const [nome, mutar] of casos) {
      const c = clonar(conteudoComBlocosNovos());
      mutar(c);
      expect(conteudoSchema.safeParse(c).success, `painel deveria recusar: ${nome}`).toBe(false);
      if (!SO_SCHEMA.has(nome)) expect(() => html(c), `montar deveria recusar: ${nome}`).toThrow(/conteudo inválido/);
    }
  });
});

describe("schema dos blocos novos", () => {
  it("os 12 blocos existem, na ordem da página", () => {
    expect(SLUGS).toEqual(["geral", "abertura", "parceiros", "videos", "planos", "bonus", "historia", "explore", "loja", "baixar", "novidades", "pagina-loja"]);
  });

  it("conteúdo antigo (sem os blocos novos) continua válido; com eles também", () => {
    expect(conteudoSchema.safeParse(conteudoDoSite()).success).toBe(true);
    expect(conteudoSchema.safeParse(conteudoComBlocosNovos()).success).toBe(true);
  });

  it("endereços das lojas: vazio vale (botão desativado); só https", () => {
    const g = conteudoComBlocosNovos().textos.geral!;
    expect(BLOCOS.geral.schema.safeParse({ ...g, lojaIos: "https://apps.apple.com/x" }).success).toBe(true);
    for (const ruim of ["http://x.com", "ftp://x.com", "apps.apple.com", "javascript:alert(1)", " //x.com"]) {
      const r = BLOCOS.geral.schema.safeParse({ ...g, lojaAndroid: ruim });
      expect(r.success, ruim).toBe(false);
      expect(!r.success && r.error.issues[0]?.message).toBe("Use um endereço que comece com https://.");
    }
  });

  it("link de lista fechada: destino livre não passa", () => {
    const g = conteudoComBlocosNovos().textos.geral!;
    const r = BLOCOS.geral.schema.safeParse({ ...g, menu: [{ texto: "x", destino: "https://evil.example" }] });
    expect(!r.success && r.error.issues[0]?.message).toBe("Escolha para onde o link leva.");
  });

  it("vídeo: img/ não vale como vídeo; video/ e o Blob valem", () => {
    expect(videoValido("video/pordentro.mp4")).toBe(true);
    expect(videoValido("/video/esportes/volei.webm")).toBe(true);
    expect(videoValido(BLOB_VIDEO)).toBe(true);
    for (const ruim of ["img/x.mp4", "video/x.mov", "video/../x.mp4", `https://${HOST}/outra/x.mp4`, `http://${HOST}/conteudo/x.mp4`, `https://${HOST}/conteudo/x.mp4?a=1`, ""]) expect(videoValido(ruim), ruim).toBe(false);
  });
});

const SCRIPT = fileURLToPath(new URL("../../scripts/conteudo-blocos-novos.mjs", import.meta.url));
const rodar = () => execFileSync(process.execPath, [SCRIPT], { env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }, encoding: "utf8" });

describe("scripts/conteudo-blocos-novos.mjs", () => {
  it("grava a versão N+1 (migração, aceita) com os campos novos e é idempotente", async () => {
    await semearVersao();
    expect(rodar()).toContain("Versão com os blocos novos gravada");
    const todas = await versoes();
    expect(todas).toHaveLength(2);
    expect(todas[1]).toMatchObject({ numero: 2, origem: "migracao", autorId: null, disparoEstado: "aceito" });
    expect(todas[1]!.disparoEm).not.toBeNull();
    expect(todas[1]!.blocosAlterados).toContain("geral");
    expect(todas[1]!.blocosAlterados).toContain("pagina-loja");

    const publicado = (await obterPublicado())!;
    expect(publicado.numero).toBe(2);
    expect(publicado.conteudo).toEqual(conteudoComBlocosNovos());
    // o site fica igual ao de antes do script
    expect(html(publicado.conteudo)).toBe(html(conteudoDoSite()));

    expect(rodar()).toContain("já tem os blocos novos");
    expect(await versoes()).toHaveLength(2);
  });

  it("sem versão nenhuma: falha com mensagem clara e não grava", async () => {
    expect(() => rodar()).toThrow();
    expect(await versoes()).toHaveLength(0);
  });
});
