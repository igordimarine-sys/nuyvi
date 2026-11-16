import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { publicarBloco } from "@/app/admin/conteudo/actions";
import { TAG_CONTEUDO_SITE } from "@/modules/conteudo-site/leitura";
import { sessaoDe } from "../contas/sessao-falsa";
import { conteudoDoSite, entrarComo, semearVersao, versoes } from "./dados";

// Pontos de entrada do painel: a permissão é conferida na própria action (CA-LOJ-56), não só no módulo.
const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (t: string) => updateTag(t) }));

afterEach(() => {
  vi.restoreAllMocks();
  updateTag.mockReset();
  sessaoDe(null);
});

const historia = () => ({ ...conteudoDoSite().textos.historia, texto: "Texto novo pela action." });

describe("publicarBloco", () => {
  it("sem sessão (ou sessão expirada): sessao_expirada, nada gravado, página não revalidada", async () => {
    await semearVersao();
    sessaoDe(null);
    expect(await publicarBloco("historia", historia(), 1)).toEqual({ tipo: "sessao_expirada" });
    expect(await versoes()).toHaveLength(1);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it.each(["operador", "cliente"] as const)("%s: sem_permissao, nada gravado, página não revalidada", async (papel) => {
    await semearVersao();
    await entrarComo(papel);
    expect(await publicarBloco("historia", historia(), 1)).toEqual({ tipo: "sem_permissao" });
    expect(await versoes()).toHaveLength(1);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("admin publica: versão 2 gravada e a tag da página revalidada", async () => {
    await semearVersao();
    await entrarComo("admin");
    expect(await publicarBloco("historia", historia(), 1)).toEqual({ tipo: "publicado", numero: 2 });
    expect(await versoes()).toHaveLength(2);
    expect(updateTag).toHaveBeenCalledExactlyOnceWith(TAG_CONTEUDO_SITE);
  });

  it("conteúdo inválido e conflito não revalidam a página", async () => {
    await semearVersao();
    await entrarComo("admin");
    expect((await publicarBloco("historia", { ...historia(), texto: "" }, 1)).tipo).toBe("invalido");
    await semearVersao(2);
    expect((await publicarBloco("historia", historia(), 1)).tipo).toBe("conflito");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("falha inesperada do banco vira { tipo: 'erro' }; erro de redirect/notFound do Next é relançado, não engolido", async () => {
    await semearVersao();
    await entrarComo("admin");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const transacao = vi.spyOn(db, "transaction");
    transacao.mockRejectedValueOnce(new Error("banco caiu"));
    expect(await publicarBloco("historia", historia(), 1)).toEqual({ tipo: "erro" });
    expect(updateTag).not.toHaveBeenCalled();
    transacao.mockRejectedValueOnce(new Error("NOT_FOUND"));
    await expect(publicarBloco("historia", historia(), 1)).rejects.toThrow("NOT_FOUND");
  });
});
