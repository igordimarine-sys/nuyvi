import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { publicarBloco, consultarSituacao } from "@/app/admin/conteudo/actions";
import { sessaoDe } from "../contas/sessao-falsa";
import { conteudoDoSite, configurarHook, entrarComo, HOOK, semearVersao, versoes } from "./dados";

// Pontos de entrada do painel: a permissão é conferida na própria action (CA-LOJ-56), não só no módulo.
const hook = vi.fn<typeof fetch>();
beforeEach(() => {
  hook.mockReset();
  hook.mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", hook);
  configurarHook({ SITE_DEPLOY_HOOK_URL: HOOK });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  configurarHook({});
  sessaoDe(null);
});

const historia = () => ({ ...conteudoDoSite().textos.historia, texto: "Texto novo pela action." });

describe("publicarBloco", () => {
  it("sem sessão (ou sessão expirada): sessao_expirada, nada gravado, hook não chamado", async () => {
    await semearVersao();
    sessaoDe(null);
    expect(await publicarBloco("historia", historia(), 1)).toEqual({ tipo: "sessao_expirada" });
    expect(await versoes()).toHaveLength(1);
    expect(hook).not.toHaveBeenCalled();
  });

  it.each(["operador", "cliente"] as const)("%s: sem_permissao, nada gravado, hook não chamado", async (papel) => {
    await semearVersao();
    await entrarComo(papel);
    expect(await publicarBloco("historia", historia(), 1)).toEqual({ tipo: "sem_permissao" });
    expect(await versoes()).toHaveLength(1);
    expect(hook).not.toHaveBeenCalled();
  });

  it("admin publica: versão 2 gravada e hook chamado", async () => {
    await semearVersao();
    await entrarComo("admin");
    expect(await publicarBloco("historia", historia(), 1)).toEqual({ tipo: "publicado", numero: 2 });
    expect(await versoes()).toHaveLength(2);
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it("hook fora do ar: falha_disparo e o site não é servido com a versão nova (CA-LOJ-55)", async () => {
    await semearVersao();
    await entrarComo("admin");
    hook.mockResolvedValue(new Response(null, { status: 500 }));
    expect(await publicarBloco("historia", historia(), 1)).toEqual({ tipo: "falha_disparo", versaoBase: 2 });
    expect((await versoes()).at(-1)).toMatchObject({ numero: 2, disparoEstado: "falhou" });
  });

  it("falha inesperada do banco vira { tipo: 'erro' }; erro de redirect/notFound do Next é relançado, não engolido", async () => {
    await semearVersao();
    await entrarComo("admin");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const transacao = vi.spyOn(db, "transaction");
    transacao.mockRejectedValueOnce(new Error("banco caiu"));
    expect(await publicarBloco("historia", historia(), 1)).toEqual({ tipo: "erro" });
    transacao.mockRejectedValueOnce(new Error("NOT_FOUND"));
    await expect(publicarBloco("historia", historia(), 1)).rejects.toThrow("NOT_FOUND");
  });
});

describe("consultarSituacao", () => {
  it("sem sessão ou sem permissão: null", async () => {
    sessaoDe(null);
    expect(await consultarSituacao()).toBeNull();
    await entrarComo("operador");
    expect(await consultarSituacao()).toBeNull();
    await entrarComo("cliente");
    expect(await consultarSituacao()).toBeNull();
  });

  it("admin: situação da publicação", async () => {
    await semearVersao();
    await entrarComo("admin");
    expect(await consultarSituacao()).toEqual({ pendente: false, versaoBase: 1 });
  });
});
