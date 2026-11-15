import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/conteudo-site/route";
import { db } from "@/db";
import { conteudoVersoes } from "@/db/schema";
import { historico, lerPainel, obterPublicado } from "@/modules/conteudo-site/leitura";
import { sessaoDe } from "../contas/sessao-falsa";
import { criarUsuario } from "../fabricas";
import { conteudoDoSite, entrarComo, semearVersao } from "./dados";

afterEach(() => sessaoDe(null));

describe("GET /api/conteudo-site (público)", () => {
  it("devolve só o conteúdo da última versão publicada, sem nenhum dado da equipe, e sem cache", async () => {
    const autor = await criarUsuario({ name: "Pessoa Secreta da Equipe", email: "segredo@equipe.exemplo.test" });
    await semearVersao();
    const novo = conteudoDoSite();
    novo.textos.historia.texto = "Versão 2";
    await semearVersao(2, novo, { origem: "painel", autorId: autor.id });

    sessaoDe(null); // sem login
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const texto = await res.text();
    const corpo = JSON.parse(texto) as Record<string, unknown>;
    expect(Object.keys(corpo).sort()).toEqual(["explore", "loja", "novidades", "planos", "textos"]);
    expect(corpo).toEqual(novo);
    for (const proibido of [autor.id, autor.email, "Pessoa Secreta", "autor", "disparo", "criado"]) expect(texto).not.toContain(proibido);
  });

  it("versão pendente ou que falhou nunca é servida", async () => {
    await semearVersao();
    const rascunho = conteudoDoSite();
    rascunho.textos.historia.texto = "Ainda não publicada";
    await semearVersao(2, rascunho, { disparoEstado: "falhou", disparoErro: "x" });
    await db.insert(conteudoVersoes).values({ numero: 3, conteudo: rascunho, blocosAlterados: ["historia"], origem: "painel" }); // pendente
    expect((await obterPublicado())!.numero).toBe(1);
    expect(JSON.stringify(await (await GET()).json())).not.toContain("Ainda não publicada");
  });

  it("sem nenhuma versão: 404 (o build do site falha e o deploy anterior continua)", async () => {
    const res = await GET();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("painel e histórico (admin)", () => {
  it("histórico: quem, quando, qual bloco; conta removida e migração; sem o conteúdo da versão (CA-LOJ-57)", async () => {
    const ana = await entrarComo("admin", "Ana");
    await semearVersao();
    await semearVersao(2, conteudoDoSite(), { autorId: ana.id, blocosAlterados: ["historia", "baixar"] });
    await semearVersao(3, conteudoDoSite(), { disparoEstado: "falhou", disparoErro: "hook respondeu 500" });
    const h = await historico();
    expect(h.proximo).toBeNull();
    expect(h.itens.map((i) => i.numero)).toEqual([3, 2, 1]);
    expect(h.itens[1]).toMatchObject({ autor: "Ana", origem: "painel", blocos: ["historia", "baixar"], estado: "aceito" });
    expect(h.itens[0]).toMatchObject({ autor: null, estado: "falhou" }); // sem autor (conta removida)
    expect(h.itens[2]).toMatchObject({ origem: "migracao", autor: null });
    expect(JSON.stringify(h)).not.toContain("hook respondeu"); // motivo técnico não vai para a tela
    expect(Object.keys(h.itens[0]!)).not.toContain("conteudo");
  });

  it("histórico paginado: 50 por página, do mais novo ao mais antigo", async () => {
    await entrarComo("admin");
    await semearVersao();
    for (let n = 2; n <= 55; n++) await semearVersao(n); // 54 versões a mais, todas aceitas
    const p1 = await historico();
    expect(p1.itens).toHaveLength(50);
    expect(p1.itens[0]!.numero).toBe(55);
    expect(p1.proximo).toBe(6);
    const p2 = await historico(p1.proximo!);
    expect(p2.itens.map((i) => i.numero)).toEqual([5, 4, 3, 2, 1]);
    expect(p2.proximo).toBeNull();
  });

  it("lerPainel: versaoBase é o maior número (inclusive falhou) e traz a última publicação por bloco", async () => {
    const ana = await entrarComo("admin", "Ana");
    await semearVersao();
    await semearVersao(2, conteudoDoSite(), { autorId: ana.id, blocosAlterados: ["historia"] });
    await semearVersao(3, conteudoDoSite(), { disparoEstado: "falhou", disparoErro: "x" });
    const p = await lerPainel();
    expect(p.versaoBase).toBe(3);
    expect(p.pendente).toBe(false);
    expect(p.publicado!.numero).toBe(2);
    expect(p.porBloco.historia).toMatchObject({ numero: 2, autor: "Ana" });
    expect(p.porBloco.abertura).toMatchObject({ numero: 1, origem: "migracao" });
    expect(p.ultima).toMatchObject({ numero: 2, blocos: ["historia"] });
  });

  it.each([["operador"], ["cliente"]] as const)("%s não lê histórico nem painel (CA-LOJ-56)", async (papel) => {
    await entrarComo(papel);
    await semearVersao();
    await expect(historico()).rejects.toThrow("NOT_FOUND");
    await expect(lerPainel()).rejects.toThrow("NOT_FOUND");
  });
});
