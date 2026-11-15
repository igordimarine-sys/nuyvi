import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { conteudoVersoes } from "@/db/schema";
import { obterPublicado } from "@/modules/conteudo-site/leitura";
import { publicar } from "@/modules/conteudo-site/publicar";
import { sessaoDe } from "../contas/sessao-falsa";
import { conteudoDoSite, configurarHook, entrarComo, HOOK, semearVersao, versao, versoes } from "./dados";

const hook = vi.fn<typeof fetch>();
beforeEach(() => {
  hook.mockReset();
  hook.mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", hook);
  configurarHook({ SITE_DEPLOY_HOOK_URL: HOOK });
});
afterEach(() => {
  vi.unstubAllGlobals();
  configurarHook({});
  sessaoDe(null);
});

const historia = (texto: string) => ({ ...conteudoDoSite().textos.historia, texto });
const nova = (texto = "Texto novo da história.", versaoBase = 1) => ({ bloco: "historia", dados: historia(texto), versaoBase });

describe("publicar", () => {
  it("publica um bloco: só ele muda, o disparo é aceito e a versão fica registrada (CA-LOJ-51, RN-LOJ-26)", async () => {
    const admin = await entrarComo("admin");
    await semearVersao();
    const r = await publicar(nova());
    expect(r).toEqual({ tipo: "publicado", numero: 2 });

    const atual = (await obterPublicado())!;
    expect(atual.numero).toBe(2);
    expect(atual.conteudo.textos.historia.texto).toBe("Texto novo da história.");
    expect(atual.conteudo).toEqual({ ...conteudoDoSite(), textos: { ...conteudoDoSite().textos, historia: historia("Texto novo da história.") } });

    const v = (await versao(2))!;
    expect(v).toMatchObject({ origem: "painel", autorId: admin.id, blocosAlterados: ["historia"], disparoEstado: "aceito", disparoErro: null });
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0]?.[0]).toBe(HOOK);
    expect(hook.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    // a URL do hook (segredo) não vai a lugar nenhum do banco
    expect(JSON.stringify(await versoes())).not.toContain("segredo-falso");
  });

  it("lista: adicionar, remover e reordenar valem na versão publicada (CA-LOJ-53)", async () => {
    await entrarComo("admin");
    await semearVersao();
    const c = conteudoDoSite().explore.cartoes;
    const novoCartao = { ...c[0]!, titulo: "Cartão novo" };
    const r = await publicar({ bloco: "explore", dados: { cartoes: [c[2]!, novoCartao, c[0]!] }, versaoBase: 1 });
    expect(r.tipo).toBe("publicado");
    expect((await obterPublicado())!.conteudo.explore.cartoes.map((x) => x.titulo)).toEqual([c[2]!.titulo, "Cartão novo", c[0]!.titulo]);
  });

  describe("validação (CA-LOJ-52)", () => {
    beforeEach(async () => {
      await entrarComo("admin");
      await semearVersao();
    });

    it("campo obrigatório vazio é apontado e nada é publicado", async () => {
      const c = conteudoDoSite().explore.cartoes;
      const r = await publicar({ bloco: "explore", dados: { cartoes: [{ ...c[0]!, titulo: "   " }, ...c.slice(1)] }, versaoBase: 1 });
      expect(r).toEqual({ tipo: "invalido", erros: [{ caminho: "cartoes.0.titulo", mensagem: "Preencha este campo." }] });
      expect(await versoes()).toHaveLength(1);
      expect(hook).not.toHaveBeenCalled();
    });

    it("desconto fora da faixa (95%) é recusado; 90 passa", async () => {
      const p = conteudoDoSite().planos;
      const r = await publicar({ bloco: "planos", dados: { ...p, desconto_anual: 95 }, versaoBase: 1 });
      expect(r).toEqual({ tipo: "invalido", erros: [{ caminho: "desconto_anual", mensagem: "Informe um número de 0 a 90." }] });
      expect((await publicar({ bloco: "planos", dados: { ...p, desconto_anual: 90 }, versaoBase: 1 })).tipo).toBe("publicado");
    });

    it.each([
      ["lista vazia", "novidades", { noticias: [] }, "noticias"],
      ["imagem fora de img/ e do Blob", "novidades", { noticias: [{ data: "x", titulo: "y", imagem: "https://evil.example/x.png" }] }, "noticias.0.imagem"],
      ["imagem do Blob em pasta errada", "novidades", { noticias: [{ data: "x", titulo: "y", imagem: "https://abc123.public.blob.vercel-storage.com/produtos/x.png" }] }, "noticias.0.imagem"],
      ["SVG no Blob", "novidades", { noticias: [{ data: "x", titulo: "y", imagem: "https://abc123.public.blob.vercel-storage.com/conteudo/x.svg" }] }, "noticias.0.imagem"],
      ["preço com 3 casas", "planos", { ...conteudoDoSite().planos, planos: [{ ...conteudoDoSite().planos.planos[0]!, mensal: 1.999 }] }, "planos.0.mensal"],
      ["destino do botão fora da lista", "loja", { ...conteudoDoSite().loja, produtos: [{ ...conteudoDoSite().loja.produtos[0]!, destino: "https://evil.example" }] }, "produtos.0.destino"],
      ["link do Explore que não é seção", "explore", { cartoes: [{ ...conteudoDoSite().explore.cartoes[0]!, link: "https://evil.example" }] }, "cartoes.0.link"],
    ])("%s", async (_nome, bloco, dados, caminho) => {
      const r = await publicar({ bloco, dados, versaoBase: 1 });
      expect(r.tipo).toBe("invalido");
      expect(r.tipo === "invalido" && r.erros.map((e) => e.caminho)).toContain(caminho);
      expect(await versoes()).toHaveLength(1);
    });

    it("bloco desconhecido e versão base inválida", async () => {
      expect((await publicar({ bloco: "rodape", dados: {}, versaoBase: 1 })).tipo).toBe("invalido");
      expect((await publicar({ ...nova(), versaoBase: "1" })).tipo).toBe("invalido");
      expect(await versoes()).toHaveLength(1);
    });
  });

  describe("conflito de versão", () => {
    it("base desatualizada: recarregue, sem gravar; diz o que a outra publicação mudou", async () => {
      await entrarComo("admin");
      await semearVersao();
      await semearVersao(2, conteudoDoSite(), { blocosAlterados: ["abertura"] });
      const r = await publicar(nova("Minha", 1));
      expect(r).toMatchObject({ tipo: "conflito", versaoBase: 2, blocosAlterados: ["abertura"], mesmoBloco: false });
      expect(await versoes()).toHaveLength(2);
      expect(hook).not.toHaveBeenCalled();
      // reenviando com a base nova (o "publicar o meu bloco" da tela) dá certo
      expect((await publicar(nova("Minha", 2))).tipo).toBe("publicado");
    });

    it("mesmo bloco: avisa e devolve o publicado atual", async () => {
      await entrarComo("admin");
      await semearVersao();
      const outro = conteudoDoSite();
      outro.textos.historia.texto = "Texto da outra pessoa";
      await semearVersao(2, outro, { blocosAlterados: ["historia"] });
      const r = await publicar(nova("Minha", 1));
      expect(r).toMatchObject({ tipo: "conflito", mesmoBloco: true });
      expect(r.tipo === "conflito" && (r.atual as { texto: string }).texto).toBe("Texto da outra pessoa");
    });

    it("duas publicações ao mesmo tempo sobre a mesma base: uma passa, a outra recebe conflito ou 'em andamento'", async () => {
      await entrarComo("admin");
      await semearVersao();
      const [a, b] = await Promise.all([publicar(nova("A")), publicar(nova("B"))]);
      const tipos = [a.tipo, b.tipo].sort();
      expect(tipos[1]).toBe("publicado");
      expect(["conflito", "em_andamento"]).toContain(tipos[0]);
      expect(await versoes()).toHaveLength(2);
    });
  });

  describe("falha do disparo (CA-LOJ-55)", () => {
    it("hook responde erro: nada é servido, a versão fica 'falhou' sem a URL, e a nova tentativa parte do publicado", async () => {
      await entrarComo("admin");
      await semearVersao();
      hook.mockResolvedValue(new Response(null, { status: 500 }));
      const consola = vi.spyOn(console, "error").mockImplementation(() => {});
      const r = await publicar(nova("Texto que não chegou"));
      expect(r).toEqual({ tipo: "falha_disparo", versaoBase: 2 });

      expect((await obterPublicado())!.numero).toBe(1);
      expect((await obterPublicado())!.conteudo.textos.historia.texto).toBe(conteudoDoSite().textos.historia.texto);
      expect(await versao(2)).toMatchObject({ disparoEstado: "falhou", disparoErro: "hook respondeu 500" });
      expect(JSON.stringify(consola.mock.calls)).not.toContain("segredo-falso");
      expect(JSON.stringify(await versoes())).not.toContain("segredo-falso");

      // nova tentativa com a base devolvida (2), mexendo em OUTRO bloco: o texto da tentativa que falhou não vaza
      hook.mockResolvedValue(new Response(null, { status: 201 }));
      const ab = { ...conteudoDoSite().textos.hero, frase: "Frase nova" };
      expect(await publicar({ bloco: "abertura", dados: ab, versaoBase: 2 })).toEqual({ tipo: "publicado", numero: 3 });
      const atual = (await obterPublicado())!.conteudo;
      expect(atual.textos.hero.frase).toBe("Frase nova");
      expect(atual.textos.historia.texto).toBe(conteudoDoSite().textos.historia.texto);
      consola.mockRestore();
    });

    it("hook sem resposta (rede ou tempo esgotado) também é falha", async () => {
      await entrarComo("admin");
      await semearVersao();
      const consola = vi.spyOn(console, "error").mockImplementation(() => {});
      hook.mockRejectedValue(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }));
      expect((await publicar(nova())).tipo).toBe("falha_disparo");
      expect((await versao(2))!.disparoErro).toBe("hook: tempo esgotado");
      consola.mockRestore();
    });

    it("sem hook: fora de produção grava como aceito com a nota; em produção é falha", async () => {
      await entrarComo("admin");
      await semearVersao();
      configurarHook({});
      const r = await publicar(nova("Sem hook"));
      expect(r).toMatchObject({ tipo: "publicado", numero: 2 });
      expect(r.tipo === "publicado" && r.aviso).toContain("não foi atualizado");
      expect(await versao(2)).toMatchObject({ disparoEstado: "aceito", disparoErro: "sem hook configurado" });
      expect(hook).not.toHaveBeenCalled();

      configurarHook({ VERCEL_ENV: "production" });
      const consola = vi.spyOn(console, "error").mockImplementation(() => {});
      expect((await publicar(nova("Em produção", 2))).tipo).toBe("falha_disparo");
      expect(await versao(3)).toMatchObject({ disparoEstado: "falhou", disparoErro: "hook não configurado" });
      consola.mockRestore();
    });
  });

  describe("publicação pendente", () => {
    it("em andamento bloqueia a próxima", async () => {
      await entrarComo("admin");
      await semearVersao();
      await semearVersao(2, conteudoDoSite(), { disparoEstado: "pendente", disparoEm: null });
      expect(await publicar(nova("X", 2))).toEqual({ tipo: "em_andamento" });
      expect(await versoes()).toHaveLength(2);
    });

    it("pendente presa (> 2 min) é liberada como 'falhou' e a publicação segue", async () => {
      await entrarComo("admin");
      await semearVersao();
      await semearVersao(2, conteudoDoSite(), { disparoEstado: "pendente", disparoEm: null, criadoEm: new Date(Date.now() - 3 * 60_000) });
      expect(await publicar(nova("Depois da presa", 2))).toEqual({ tipo: "publicado", numero: 3 });
      expect(await versao(2)).toMatchObject({ disparoEstado: "falhou", disparoErro: "expirada sem disparo" });
      expect((await obterPublicado())!.conteudo.textos.historia.texto).toBe("Depois da presa");
    });
  });

  it("sem versão inicial publicada não há base para montar a nova", async () => {
    await entrarComo("admin");
    expect((await publicar(nova("X", 0))).tipo).toBe("sem_conteudo");
    expect(await versoes()).toHaveLength(0);
  });

  describe("permissão (CA-LOJ-56)", () => {
    it.each([["operador"], ["cliente"]] as const)("%s não publica por nenhum caminho e nada muda", async (papel) => {
      await entrarComo(papel);
      await semearVersao();
      await expect(publicar(nova())).rejects.toThrow("NOT_FOUND");
      expect(await versoes()).toHaveLength(1);
      expect(hook).not.toHaveBeenCalled();
    });

    it("sem sessão vai para /entrar", async () => {
      await semearVersao();
      sessaoDe(null);
      await expect(publicar(nova())).rejects.toThrow("REDIRECT:/entrar");
      expect(await db.select().from(conteudoVersoes)).toHaveLength(1);
    });
  });
});
