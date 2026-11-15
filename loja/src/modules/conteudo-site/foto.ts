import "server-only";
import { put } from "@vercel/blob";
import { exigirPapel } from "@/modules/contas/papeis";
import { PAPEL_CONTEUDO } from "./permissao";
import { imagemValida } from "./schema";

/** Limite da foto (CA-LOJ-54). Um pouco abaixo de 4,5 MB (limite do corpo de uma função da Vercel) por causa do envelope multipart. */
export const TAMANHO_MAXIMO_FOTO = 4_500_000;
const FORMATOS = { jpeg: { tipo: "image/jpeg", ext: "jpg" }, png: { tipo: "image/png", ext: "png" }, webp: { tipo: "image/webp", ext: "webp" } } as const;

export type ResultadoFoto =
  | { ok: true; url: string }
  | { ok: false; motivo: "formato" | "tamanho" | "nao_configurado" | "falha"; mensagem: string };

/** Formato pelos primeiros bytes (assinatura do arquivo), nunca pela extensão nem pelo tipo informado pelo navegador. SVG e GIF não passam. */
export function detectarFormato(b: Uint8Array): keyof typeof FORMATOS | null {
  const igual = (ini: number, ...v: number[]) => v.every((x, i) => b[ini + i] === x);
  if (igual(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (igual(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (igual(0, 0x52, 0x49, 0x46, 0x46) && igual(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  return null;
}

const mb = (n: number) => (n / 1_000_000).toFixed(1).replace(".", ",");

/**
 * Envia uma foto do conteúdo ao Vercel Blob público (prefixo `conteudo/`, sufixo aleatório; o nome do arquivo do
 * usuário nunca é usado). Admin (`exigirPapel`). Nada é apagado: a foto só aparece no site quando uma versão que a
 * referencia é publicada. Sem credencial do Blob no ambiente local, devolve `nao_configurado` (o resto do painel segue).
 */
export async function enviarFoto(arquivo: unknown): Promise<ResultadoFoto> {
  await exigirPapel(PAPEL_CONTEUDO);
  if (!(arquivo instanceof File)) return { ok: false, motivo: "formato", mensagem: "Formato não aceito. Envie JPEG, PNG ou WebP." };
  if (arquivo.size > TAMANHO_MAXIMO_FOTO) return { ok: false, motivo: "tamanho", mensagem: `Arquivo grande demais (${mb(arquivo.size)} MB). O máximo é 4,5 MB.` };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const formato = detectarFormato(bytes);
  if (!formato) return { ok: false, motivo: "formato", mensagem: "Formato não aceito. Envie JPEG, PNG ou WebP." };

  // Fora da Vercel (dev) o SDK só funciona com token; na Vercel vale o OIDC do store conectado, que o SDK resolve sozinho.
  if (!process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, motivo: "nao_configurado", mensagem: "O armazenamento de fotos não está configurado neste ambiente (falta BLOB_READ_WRITE_TOKEN)." };
  }
  try {
    const f = FORMATOS[formato];
    const blob = await put(`conteudo/foto.${f.ext}`, arquivo, { access: "public", addRandomSuffix: true, contentType: f.tipo, abortSignal: AbortSignal.timeout(30_000) });
    // A URL gravada no conteúdo tem que passar na validação do painel e do build (host do Blob, pasta conteudo/).
    if (!imagemValida(blob.url)) throw new Error("URL fora do padrão esperado");
    return { ok: true, url: blob.url };
  } catch (e) {
    console.error(`[conteudo-site] falha ao enviar foto: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    return { ok: false, motivo: "falha", mensagem: "Não foi possível enviar a foto. Verifique a internet e tente de novo." };
  }
}
