import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessaoDe } from "../contas/sessao-falsa";
import { entrarComo } from "./dados";

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => put(...a) }));
const { detectarFormato, enviarFoto, TAMANHO_MAXIMO_FOTO } = await import("@/modules/conteudo-site/foto");

const bytes = (...v: number[]) => new Uint8Array([...v, ...new Array(64).fill(0)]);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, ...new Array(32).fill(0)]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const GIF = new TextEncoder().encode("GIF89a....");
const arquivo = (dados: BlobPart, nome = "foto.jpg", tipo = "image/jpeg") => new File([dados], nome, { type: tipo });

beforeEach(() => {
  put.mockReset();
  put.mockResolvedValue({ url: "https://abc123.public.blob.vercel-storage.com/conteudo/foto-Xy12.jpg" });
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "token-falso-de-teste");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  sessaoDe(null);
});

describe("detectarFormato (pelo conteúdo, nunca pela extensão)", () => {
  it("reconhece JPEG, PNG e WebP; recusa SVG, GIF e lixo", () => {
    expect(detectarFormato(JPEG)).toBe("jpeg");
    expect(detectarFormato(PNG)).toBe("png");
    expect(detectarFormato(WEBP)).toBe("webp");
    expect(detectarFormato(SVG)).toBeNull();
    expect(detectarFormato(GIF)).toBeNull();
    expect(detectarFormato(new Uint8Array())).toBeNull();
    expect(detectarFormato(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull(); // RIFF/WAVE
  });
});

describe("enviarFoto (CA-LOJ-54)", () => {
  beforeEach(async () => {
    await entrarComo("admin");
  });

  it("aceita imagem válida: envia ao Blob público em conteudo/, com sufixo aleatório e tipo detectado (não o informado)", async () => {
    const r = await enviarFoto(arquivo(PNG, "vovo-de-novo.jpg", "image/jpeg"));
    expect(r).toEqual({ ok: true, url: "https://abc123.public.blob.vercel-storage.com/conteudo/foto-Xy12.jpg" });
    const [caminho, , opcoes] = put.mock.calls[0]!;
    expect(caminho).toBe("conteudo/foto.png"); // nome do usuário nunca é usado
    expect(opcoes).toMatchObject({ access: "public", addRandomSuffix: true, contentType: "image/png" });
  });

  it("recusa SVG mesmo com extensão e tipo de imagem, GIF e arquivo que não é imagem", async () => {
    for (const f of [arquivo(SVG, "x.png", "image/png"), arquivo(GIF, "x.gif", "image/gif"), arquivo("texto", "x.jpg")]) {
      expect(await enviarFoto(f)).toMatchObject({ ok: false, motivo: "formato", mensagem: "Formato não aceito. Envie JPEG, PNG ou WebP." });
    }
    expect(await enviarFoto("não é arquivo")).toMatchObject({ ok: false, motivo: "formato" });
    expect(put).not.toHaveBeenCalled();
  });

  it("recusa acima do limite, dizendo o tamanho", async () => {
    const grande = new Uint8Array(TAMANHO_MAXIMO_FOTO + 1);
    grande.set(JPEG);
    const r = await enviarFoto(arquivo(grande));
    expect(r).toMatchObject({ ok: false, motivo: "tamanho" });
    expect(!r.ok && r.mensagem).toMatch(/^Arquivo grande demais \(4,5 MB\)\. O máximo é 4,5 MB\.$/);
    expect(put).not.toHaveBeenCalled();
  });

  it("sem credencial do Blob (ambiente local): mensagem clara, sem tentar enviar", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    const r = await enviarFoto(arquivo(JPEG));
    expect(r).toMatchObject({ ok: false, motivo: "nao_configurado" });
    expect(!r.ok && r.mensagem).toContain("BLOB_READ_WRITE_TOKEN");
    expect(put).not.toHaveBeenCalled();
  });

  it("falha do Blob vira a mensagem de falha de envio; URL fora do padrão também", async () => {
    put.mockRejectedValueOnce(new Error("blob fora do ar"));
    expect(await enviarFoto(arquivo(JPEG))).toMatchObject({ ok: false, motivo: "falha", mensagem: "Não foi possível enviar a foto. Verifique a internet e tente de novo." });
    put.mockResolvedValueOnce({ url: "https://outro-host.example/conteudo/x.jpg" });
    expect(await enviarFoto(arquivo(JPEG))).toMatchObject({ ok: false, motivo: "falha" });
  });

  it.each([["operador"], ["cliente"]] as const)("%s não envia foto (CA-LOJ-56)", async (papel) => {
    await entrarComo(papel);
    await expect(enviarFoto(arquivo(JPEG))).rejects.toThrow("NOT_FOUND");
    expect(put).not.toHaveBeenCalled();
  });
});
