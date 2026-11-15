import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// CA-LOJ-59 / RNF-14: com a loja fora do ar (ou respondendo errado), o build do site PARA e o index.html fica
// intacto, então a Vercel mantém o deploy anterior. Roda o build.mjs como processo filho numa cópia de site/.
const SITE = fileURLToPath(new URL("../../../site/", import.meta.url));
const original = readFileSync(join(SITE, "index.html"), "utf8");
let copia: string;
let servidor: Server;
let status = 200;
let corpo = "{}";
const urlDoServidor = () => `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/conteudo-site`;

beforeAll(async () => {
  copia = mkdtempSync(join(tmpdir(), "site-build-"));
  for (const f of ["build.mjs", "index.html", "conteudo"]) cpSync(join(SITE, f), join(copia, f), { recursive: true });
  servidor = createServer((_req, res) => {
    res.writeHead(status, { "content-type": "application/json" }).end(corpo);
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
});
afterAll(() => {
  servidor.close();
  rmSync(copia, { recursive: true, force: true });
});

// Assíncrono de propósito: o servidor falso vive neste processo e precisa atender enquanto o filho roda (spawnSync travaria).
function rodar(conteudoUrl: string) {
  // env mínimo: nada herdado (CONTEUDO_URL/LOJA_URL do ambiente de quem roda não podem mudar o resultado)
  return new Promise<{ codigo: number | null; saida: string; html: string }>((ok) => {
    execFile(process.execPath, [join(copia, "build.mjs")], { env: { PATH: process.env.PATH ?? "", CONTEUDO_URL: conteudoUrl } as unknown as NodeJS.ProcessEnv, encoding: "utf8", timeout: 30_000 }, (erro, stdout, stderr) => {
      const codigo = erro ? (typeof erro.code === "number" ? erro.code : null) : 0;
      ok({ codigo, saida: `${stdout}${stderr}`, html: readFileSync(join(copia, "index.html"), "utf8") });
    });
  });
}

describe("site/build.mjs com a loja fora do ar (CA-LOJ-59, RNF-14)", () => {
  it("porta fechada: sai com código diferente de zero e o index.html não muda", async () => {
    const livre = createServer();
    await new Promise<void>((ok) => livre.listen(0, "127.0.0.1", ok));
    const porta = (livre.address() as AddressInfo).port;
    await new Promise((ok) => livre.close(ok)); // agora a porta está fechada
    const r = await rodar(`http://127.0.0.1:${porta}/api/conteudo-site`);
    expect(r.codigo).not.toBeNull();
    expect(r.codigo).not.toBe(0);
    expect(r.html).toBe(original);
  });

  it.each([404, 500, 503])("resposta %i: sai com código diferente de zero, cita o status e o index.html não muda", async (s) => {
    status = s;
    const r = await rodar(urlDoServidor());
    expect(r.codigo).not.toBeNull();
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain(String(s));
    expect(r.html).toBe(original);
  });

  it("controle: com a loja no ar e conteúdo válido o mesmo comando termina com 0 (os testes acima não passam por outro motivo)", async () => {
    const ler = (n: string) => JSON.parse(readFileSync(join(copia, "conteudo", `${n}.json`), "utf8"));
    corpo = JSON.stringify({ textos: ler("textos"), loja: ler("loja"), explore: ler("explore"), novidades: ler("novidades"), planos: ler("planos") });
    status = 200;
    const r = await rodar(urlDoServidor());
    expect(r.saida).toContain("index.html atualizado");
    expect(r.codigo).toBe(0);
  });
});
