import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessaoDe } from "../contas/sessao-falsa";
import { entrarComo } from "./dados";

// Só a borda do Blob é simulada (nada de rede). Rota, permissão, sessão e validação da foto rodam de verdade.
const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => put(...a) }));
const { POST } = await import("@/app/api/conteudo-site/foto/route");

const HOST = "painel.exemplo.test";
const PNG = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c00" } }).png().toBuffer();

function pedido(o: { origin?: string | null; corpo?: BodyInit; foto?: BlobPart } = {}) {
  const headers: Record<string, string> = { host: HOST };
  if (o.origin !== null) headers.origin = o.origin ?? `https://${HOST}`;
  const form = new FormData();
  form.set("foto", new File([o.foto ?? PNG], "foto.png", { type: "image/png" }));
  return new Request(`https://${HOST}/api/conteudo-site/foto`, { method: "POST", headers, body: o.corpo ?? form });
}

beforeEach(() => {
  put.mockReset();
  put.mockResolvedValue({ url: "https://abc123.public.blob.vercel-storage.com/conteudo/foto-Xy12.png" });
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "token-falso-de-teste");
  vi.stubEnv("NEXT_PUBLIC_BLOB_HOST", "abc123.public.blob.vercel-storage.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  sessaoDe(null);
});

describe("POST /api/conteudo-site/foto (CA-LOJ-54, CA-LOJ-56)", () => {
  it.each([
    ["Origin de outro site", "https://site-malicioso.test"],
    ["Origin ausente", null],
    ["Origin 'null'", "null"],
  ])("%s: 403, mesmo com admin logado, e nada é enviado", async (_n, origin) => {
    await entrarComo("admin");
    const res = await POST(pedido({ origin }));
    expect(res.status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("sem sessão: 401, sem enviar", async () => {
    sessaoDe(null);
    const res = await POST(pedido());
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ ok: false, motivo: "sessao" });
    expect(put).not.toHaveBeenCalled();
  });

  it.each(["operador", "cliente"] as const)("%s: 403, sem enviar", async (papel) => {
    await entrarComo(papel);
    const res = await POST(pedido());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, motivo: "permissao" });
    expect(put).not.toHaveBeenCalled();
  });

  it("admin com imagem válida: 200 com a URL do Blob e sem cache", async () => {
    await entrarComo("admin");
    const res = await POST(pedido());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, url: "https://abc123.public.blob.vercel-storage.com/conteudo/foto-Xy12.png" });
    expect(put).toHaveBeenCalledTimes(1);
  });

  describe("status dos erros (admin)", () => {
    beforeEach(async () => {
      await entrarComo("admin");
    });

    it("formato não aceito: 422", async () => {
      const res = await POST(pedido({ foto: "isto não é uma imagem" }));
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ ok: false, motivo: "formato" });
    });

    it("grande demais: 422", async () => {
      const grande = new Uint8Array(4_500_001);
      grande.set(PNG);
      const res = await POST(pedido({ foto: grande }));
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ ok: false, motivo: "tamanho" });
    });

    it("armazenamento não configurado: 503", async () => {
      vi.stubEnv("NEXT_PUBLIC_BLOB_HOST", "");
      const res = await POST(pedido());
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ ok: false, motivo: "nao_configurado" });
      expect(put).not.toHaveBeenCalled();
    });

    it("falha do Blob: 502", async () => {
      put.mockRejectedValueOnce(new Error("blob fora do ar"));
      const res = await POST(pedido());
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ ok: false, motivo: "falha" });
    });

    it("corpo que não é multipart: 400", async () => {
      const res = await POST(pedido({ corpo: "lixo" }));
      expect(res.status).toBe(400);
      expect(put).not.toHaveBeenCalled();
    });
  });
});
