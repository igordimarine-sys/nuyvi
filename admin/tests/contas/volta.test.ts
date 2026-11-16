import { describe, expect, it } from "vitest";
import { destinoDepoisDeEntrar, voltaSegura } from "@/modules/contas/volta";

describe("voltaSegura (CA-LOJ-77, RN-LOJ-29)", () => {
  it.each(["/loja", "/loja/categoria/x?a=1#y", "/admin/conteudo/historia", "/"])("aceita caminho interno %s", (v) => {
    expect(voltaSegura(v)).toBe(v);
  });

  it.each([
    "//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "http://evil.com/x", "javascript:alert(1)", "%2F%2Fevil.com",
    "", null, undefined, "loja", "/ab\ncd", "/ab\tcd", "/a\u0000b", "/ \\evil.com", "/login", "/login?volta=/loja", "/login/x",
    "/admin/login", "/admin/login?volta=/admin", "/admin/login/x",
  ])("ignora %j", (v) => {
    expect(voltaSegura(v)).toBeNull();
  });
});

describe("destinoDepoisDeEntrar", () => {
  it("cliente: volta válida ou /", () => {
    expect(destinoDepoisDeEntrar(false, "/loja")).toBe("/loja");
    expect(destinoDepoisDeEntrar(false, null)).toBe("/");
    expect(destinoDepoisDeEntrar(false, "//evil.com")).toBe("/");
    expect(destinoDepoisDeEntrar(false, "/login")).toBe("/");
    expect(destinoDepoisDeEntrar(true, "/admin/login")).toBe("/admin");
  });

  it("equipe: /admin, ou a volta quando está dentro de /admin", () => {
    expect(destinoDepoisDeEntrar(true, null)).toBe("/admin");
    expect(destinoDepoisDeEntrar(true, "/loja")).toBe("/admin");
    expect(destinoDepoisDeEntrar(true, "/adminx")).toBe("/admin");
    expect(destinoDepoisDeEntrar(true, "/admin/conteudo/historia")).toBe("/admin/conteudo/historia");
    expect(destinoDepoisDeEntrar(true, "//evil.com")).toBe("/admin");
  });
});
