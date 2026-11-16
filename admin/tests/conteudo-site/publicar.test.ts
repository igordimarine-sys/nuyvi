import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { conteudoVersoes } from "@/db/schema";
import { obterPublicado } from "@/modules/conteudo-site/leitura";
import { publicar } from "@/modules/conteudo-site/publicar";
import { sessaoDe } from "../contas/sessao-falsa";
import { conteudoDoSite, entrarComo, semearVersao, versao, versoes } from "./dados";

afterEach(() => sessaoDe(null));

const historia = (texto: string) => ({ ...conteudoDoSite().textos.historia, texto });
const nova = (texto = "Texto novo da história.", versaoBase = 1) => ({ bloco: "historia", dados: historia(texto), versaoBase });

describe("publicar", () => {
  it("publica um bloco: só ele muda, a versão já nasce aceita (CA-LOJ-51, RN-LOJ-26)", async () => {
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
    expect(v.disparoEm).toBeInstanceOf(Date);
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

    it("duas publicações ao mesmo tempo sobre a mesma base: uma passa, a outra recebe conflito", async () => {
      await entrarComo("admin");
      await semearVersao();
      const [a, b] = await Promise.all([publicar(nova("A")), publicar(nova("B"))]);
      const tipos = [a.tipo, b.tipo].sort();
      expect(tipos[1]).toBe("publicado");
      expect(tipos[0]).toBe("conflito");
      expect(await versoes()).toHaveLength(2);
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
    });

    it("sem sessão vai para /admin/login", async () => {
      await semearVersao();
      sessaoDe(null);
      await expect(publicar(nova())).rejects.toThrow("REDIRECT:/admin/login");
      expect(await db.select().from(conteudoVersoes)).toHaveLength(1);
    });
  });
});
