import "server-only";
import { put } from "@vercel/blob";
import { exigirPapel } from "@/modules/contas/papeis";
import { armazenamentoFaltando, mb, TAMANHO_MAXIMO_FOTO, type ResultadoFoto } from "./foto";
import { PAPEL_CONTEUDO } from "./permissao";
import { videoValido } from "./schema";
import { descreverErro } from "@/lib/erro-log";

/** Mesmo limite da foto: corpo de uma função da Vercel (ADR-0007 A1; acima disso, envio direto ao Blob, não é escopo agora). */
export const TAMANHO_MAXIMO_VIDEO = TAMANHO_MAXIMO_FOTO;
const FORMATOS = { mp4: "video/mp4", webm: "video/webm" } as const;
const NAO_ACEITO = "Este arquivo não parece ser um vídeo MP4 ou WebM.";

/** Formato pelos primeiros bytes: MP4 = caixa `ftyp` no byte 4 (e não QuickTime); WebM = cabeçalho EBML com o DocType "webm". Nunca pela extensão. */
export function detectarVideo(b: Uint8Array): keyof typeof FORMATOS | null {
  const ascii = (ini: number, fim: number) => String.fromCharCode(...b.subarray(ini, fim));
  if (b.length >= 12 && ascii(4, 8) === "ftyp" && ascii(8, 12) !== "qt  ") return "mp4";
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 && ascii(0, Math.min(b.length, 64)).includes("webm")) return "webm";
  return null;
}

/** Envia um vídeo de fundo ao Blob público (`conteudo/`, sufixo aleatório, sem reencodar). Admin (`exigirPapel`). */
export async function enviarVideo(arquivo: unknown): Promise<ResultadoFoto> {
  await exigirPapel(PAPEL_CONTEUDO);
  if (!(arquivo instanceof File)) return { ok: false, motivo: "formato", mensagem: "Formato não aceito. Envie MP4 ou WebM." };
  if (arquivo.size > TAMANHO_MAXIMO_VIDEO) return { ok: false, motivo: "tamanho", mensagem: `Arquivo grande demais (${mb(arquivo.size)} MB). O máximo é 4,5 MB.` };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const formato = detectarVideo(bytes);
  if (!formato) return { ok: false, motivo: "formato", mensagem: NAO_ACEITO };
  const falta = armazenamentoFaltando();
  if (falta) return { ok: false, motivo: "nao_configurado", mensagem: `O armazenamento de vídeos não está configurado neste ambiente (falta ${falta}).` };
  try {
    const blob = await put(`conteudo/video.${formato}`, Buffer.from(bytes), { access: "public", addRandomSuffix: true, contentType: FORMATOS[formato], abortSignal: AbortSignal.timeout(30_000) });
    if (!videoValido(blob.url)) throw new Error("URL fora do padrão esperado");
    return { ok: true, url: blob.url };
  } catch (e) {
    console.error(`[conteudo-site] falha ao enviar vídeo: ${descreverErro(e)}`);
    return { ok: false, motivo: "falha", mensagem: "Não foi possível enviar o vídeo. Verifique a internet e tente de novo." };
  }
}
