import { describe, expect, it, vi } from "vitest";
import { montar } from "@/modules/conteudo-site/pagina";
import { enderecoDeLogin, inicialDe, resolverSessao } from "../../../site/js/conta.js";
import { conteudoComBlocosNovos, conteudoDoSite, HTML_SITE } from "../conteudo-site/dados";

// Sessão visível no site (ADR-0007 A2, CA-LOJ-68 a 73). A lógica de decisão do `site/js/conta.js` é pura e roda aqui; o DOM não.
describe("conta.js: estado a partir da sessão", () => {
  it("visitante: sem sessão, resposta sem usuário ou inesperada", () => {
    for (const r of [null, undefined, {}, { user: null }, { user: "x" }, "texto", 42, []]) expect(resolverSessao(r), JSON.stringify(r)).toEqual({ estado: "visitante", nome: "" });
  });

  it("cliente: qualquer papel que não seja operador ou admin", () => {
    for (const role of ["cliente", undefined, "", "ADMIN", "superadmin", 1]) expect(resolverSessao({ user: { name: "Bia", role } }).estado, String(role)).toBe("cliente");
  });

  it("equipe: operador e admin", () => {
    expect(resolverSessao({ session: {}, user: { name: " Ana ", role: "admin" } })).toEqual({ estado: "equipe", nome: "Ana" });
    expect(resolverSessao({ user: { name: "Lu", role: "operador" } }).estado).toBe("equipe");
  });

  it("nome vazio ou ausente vira o texto fixo 'Minha conta'", () => {
    expect(resolverSessao({ user: { name: "  ", role: "cliente" } }).nome).toBe("Minha conta");
    expect(resolverSessao({ user: { role: "cliente" } }).nome).toBe("Minha conta");
  });

  it("inicial em maiúscula, inclusive de nome com acento ou emoji", () => {
    expect(inicialDe("ana")).toBe("A");
    expect(inicialDe("érica")).toBe("É");
    expect(inicialDe("😀 x")).toBe("😀");
    expect(inicialDe("")).toBe("M");
  });

  it("destino do botão de entrar: '/' sem volta; outras páginas levam a volta (só caminho e busca)", () => {
    expect(enderecoDeLogin("/", "")).toBe("/login");
    expect(enderecoDeLogin("/", "?x=1")).toBe("/login");
    expect(enderecoDeLogin("/loja", "")).toBe("/login?volta=%2Floja");
    expect(enderecoDeLogin("/loja", "?a=1&b=2")).toBe("/login?volta=%2Floja%3Fa%3D1%26b%3D2");
  });
});

describe("HTML da página com o grupo de conta", () => {
  it("sai no estado visitante, escondendo a parte logada, sem dado de ninguém, e com os rótulos do conteúdo", () => {
    const c = conteudoComBlocosNovos();
    c.textos.geral!.sair = "Encerrar";
    const out = montar(HTML_SITE, c).html;
    expect(out).toContain('data-conta data-estado="carregando"');
    expect(out).toContain('<div class="conta-logada" data-logada hidden>');
    expect(out).toContain('<span class="conta-nome" data-nome></span><button type="button" class="bt bt-linha" data-sair>Encerrar</button>');
    expect(out).not.toContain('data-painel');
    expect(out).toContain('<span class="conta-nome" data-nome></span>');
    expect(out).toContain('src="/js/conta.js"');
  });

  it("sem os blocos novos, o grupo sai com os rótulos do template e idêntico ao dos valores iniciais", () => {
    expect(montar(HTML_SITE, conteudoDoSite()).html).toBe(montar(HTML_SITE, conteudoComBlocosNovos()).html);
    expect(montar(HTML_SITE, conteudoDoSite()).html).toContain("data-sair>Sair</button>");
  });
});

describe("GET /api/auth/get-session (CA-LOJ-72)", () => {
  it("responde sem cache compartilhado, com ou sem sessão", async () => {
    const { auth } = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth"); // o setup troca `auth` por uma sessão falsa
    const res = await auth.handler(new Request("http://localhost:3000/api/auth/get-session"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toBeNull();
  });
});
