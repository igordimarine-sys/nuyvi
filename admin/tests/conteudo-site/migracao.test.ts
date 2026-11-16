import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { obterPublicado } from "@/modules/conteudo-site/leitura";
import { conteudoDoSite, versoes } from "./dados";

const SCRIPT = fileURLToPath(new URL("../../scripts/migrar-conteudo.mjs", import.meta.url));
const rodar = () => execFileSync(process.execPath, [SCRIPT], { env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }, encoding: "utf8" });

describe("scripts/migrar-conteudo.mjs", () => {
  it("grava a versão 1 (migração, aceita, 9 blocos) a partir de scripts/conteudo-inicial, e é idempotente", async () => {
    expect(rodar()).toContain("Versão 1 do conteúdo gravada");
    const [v, ...resto] = await versoes();
    expect(resto).toHaveLength(0);
    expect(v).toMatchObject({ numero: 1, origem: "migracao", autorId: null, disparoEstado: "aceito" });
    expect(v!.disparoEm).not.toBeNull();
    expect(v!.blocosAlterados).toEqual(["abertura", "parceiros", "planos", "bonus", "historia", "explore", "loja", "novidades", "baixar"]);

    // o que foi gravado passa na validação do painel e é o conteúdo do site + destino dos cartões da Loja
    expect((await obterPublicado())!.conteudo).toEqual(conteudoDoSite());

    expect(rodar()).toContain("Já existe versão do conteúdo");
    expect(await versoes()).toHaveLength(1);
  });
});
