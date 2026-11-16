import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessaoDe } from "../contas/sessao-falsa";
import { entrarComo } from "./dados";

// Upload de vídeo pela rota da foto (CA-LOJ-63): só o Blob é simulado. Tipo conferido pelo conteúdo, limite de 4,5 MB, mesma autorização.
const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => put(...a) }));
const { POST } = await import("@/app/api/conteudo-site/foto/route");
const { detectarVideo } = await import("@/modules/conteudo-site/video");

const HOST = "painel.exemplo.test";
const bytes = (...v: number[]) => Uint8Array.from(v);
const ascii = (t: string) => [...t].map((c) => c.charCodeAt(0));
// 4 bytes de tamanho + "ftyp" + marca "isom"
const MP4 = bytes(0, 0, 0, 0x18, ...ascii("ftypisom"), 0, 0, 2, 0, ...ascii("isomiso2"));
// cabeçalho EBML + DocType "webm"
const WEBM = bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, ...ascii("webm"), 0x42, 0x87);

function pedido(o: { origin?: string | null; video?: BlobPart; campo?: string } = {}) {
  const headers: Record<string, string> = { host: HOST };
  if (o.origin !== null) headers.origin = o.origin ?? `https://${HOST}`;
  const form = new FormData();
  form.set(o.campo ?? "video", new File([o.video ?? MP4], "v.mp4", { type: "video/mp4" }));
  return new Request(`https://${HOST}/api/conteudo-site/foto`, { method: "POST", headers, body: form });
}

beforeEach(() => {
  put.mockReset();
  put.mockResolvedValue({ url: "https://abc123.public.blob.vercel-storage.com/conteudo/video-Xy12.mp4" });
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "token-falso-de-teste");
  vi.stubEnv("NEXT_PUBLIC_BLOB_HOST", "abc123.public.blob.vercel-storage.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  sessaoDe(null);
});

describe("detectarVideo", () => {
  it("MP4 por ftyp e WebM por EBML + DocType; o resto não passa", () => {
    expect(detectarVideo(MP4)).toBe("mp4");
    expect(detectarVideo(WEBM)).toBe("webm");
    expect(detectarVideo(bytes(0, 0, 0, 0x14, ...ascii("ftypqt  ")))).toBeNull(); // QuickTime
    expect(detectarVideo(bytes(0x1a, 0x45, 0xdf, 0xa3, ...ascii("matroska")))).toBeNull(); // EBML de outro DocType
    expect(detectarVideo(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectarVideo(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBeNull(); // JPEG
    expect(detectarVideo(bytes())).toBeNull();
  });
});

describe("POST /api/conteudo-site/foto com vídeo (CA-LOJ-63)", () => {
  it("admin com MP4 válido: 200, URL do Blob, na pasta conteudo/ e com o tipo certo", async () => {
    await entrarComo("admin");
    const res = await POST(pedido());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: "https://abc123.public.blob.vercel-storage.com/conteudo/video-Xy12.mp4" });
    expect(put).toHaveBeenCalledWith("conteudo/video.mp4", expect.anything(), expect.objectContaining({ access: "public", contentType: "video/mp4", addRandomSuffix: true }));
  });

  it("WebM válido: 200", async () => {
    await entrarComo("admin");
    put.mockResolvedValue({ url: "https://abc123.public.blob.vercel-storage.com/conteudo/video-Ab.webm" });
    expect((await POST(pedido({ video: WEBM }))).status).toBe(200);
    expect(put.mock.calls[0]?.[0]).toBe("conteudo/video.webm");
  });

  it("tipo falso (HTML/imagem com extensão .mp4): 422 e nada é enviado", async () => {
    await entrarComo("admin");
    const res = await POST(pedido({ video: "<html><script>alert(1)</script></html>" }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, motivo: "formato", mensagem: "Este arquivo não parece ser um vídeo MP4 ou WebM." });
    expect(put).not.toHaveBeenCalled();
  });

  it("maior que 4,5 MB: 422 com a mensagem do tamanho", async () => {
    await entrarComo("admin");
    const grande = new Uint8Array(4_500_001);
    grande.set(MP4);
    const res = await POST(pedido({ video: grande }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, motivo: "tamanho", mensagem: "Arquivo grande demais (4,5 MB). O máximo é 4,5 MB." });
    expect(put).not.toHaveBeenCalled();
  });

  it("sem sessão: 401; operador e cliente: 403; Origin de outro site: 403; nada é enviado", async () => {
    sessaoDe(null);
    expect((await POST(pedido())).status).toBe(401);
    for (const papel of ["operador", "cliente"] as const) {
      await entrarComo(papel);
      expect((await POST(pedido())).status).toBe(403);
    }
    await entrarComo("admin");
    expect((await POST(pedido({ origin: "https://site-malicioso.test" }))).status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("armazenamento não configurado: 503; falha do Blob: 502", async () => {
    await entrarComo("admin");
    vi.stubEnv("NEXT_PUBLIC_BLOB_HOST", "");
    expect((await POST(pedido())).status).toBe(503);
    vi.stubEnv("NEXT_PUBLIC_BLOB_HOST", "abc123.public.blob.vercel-storage.com");
    put.mockRejectedValue(new Error("blob caiu"));
    const res = await POST(pedido());
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ motivo: "falha", mensagem: "Não foi possível enviar o vídeo. Verifique a internet e tente de novo." });
  });
});
