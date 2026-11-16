import { beforeEach, describe, expect, it } from "vitest";
import { exigirPapel } from "@/modules/contas/papeis";
import { sessao, sessaoDe } from "./sessao-falsa";

// Autorização no servidor: sem sessão vai ao login; papel insuficiente vira 404 (CA-LOJ-43: operador sem acesso a admin).
describe("exigirPapel", () => {
  beforeEach(() => sessaoDe(null));

  it("sem sessão, manda para /login", async () => {
    await expect(exigirPapel("cliente")).rejects.toThrow("REDIRECT:/login");
  });

  it("com e-mail não confirmado, trata como sem sessão", async () => {
    sessaoDe(sessao({ emailVerified: false }));
    await expect(exigirPapel("cliente")).rejects.toThrow("REDIRECT:/login");
  });

  it("com papel desconhecido, trata como sem acesso", async () => {
    sessaoDe(sessao({ role: "superadmin" }));
    await expect(exigirPapel("cliente")).rejects.toThrow("REDIRECT:/login");
  });

  it.each([
    ["cliente", "cliente"],
    ["operador", "cliente"],
    ["operador", "operador"],
    ["admin", "cliente"],
    ["admin", "operador"],
    ["admin", "admin"],
  ])("%s acessa o que exige %s", async (papel, minimo) => {
    sessaoDe(sessao({ role: papel }));
    const u = await exigirPapel(minimo as "cliente");
    expect(u).toMatchObject({ id: "u1", papel, sessaoId: "s1" });
  });

  it.each([
    ["cliente", "operador"],
    ["cliente", "admin"],
    ["operador", "admin"],
  ])("%s não acessa o que exige %s (404, sem revelar que existe)", async (papel, minimo) => {
    sessaoDe(sessao({ role: papel }));
    await expect(exigirPapel(minimo as "admin")).rejects.toThrow("NOT_FOUND");
  });
});
