import { enviarFoto } from "@/modules/conteudo-site/foto";
import { enviarVideo } from "@/modules/conteudo-site/video";
import { situacaoDeAcesso } from "@/modules/conteudo-site/permissao";

// Upload de foto (campo "foto", CA-LOJ-54) ou de vídeo (campo "video", CA-LOJ-63) do painel de conteúdo. Rota e não Server Action para não elevar o limite de corpo
// (1 MB) de todas as actions. Admin; `enviarFoto` confere o papel de novo.
const SEM_CACHE = { "Cache-Control": "no-store" };

function mesmaOrigem(request: Request) {
  try {
    return new URL(request.headers.get("origin") ?? "").host === request.headers.get("host");
  } catch {
    return false; // sem Origin, ou "null"
  }
}

export async function POST(request: Request) {
  // Defesa extra contra envio de outro site (o cookie já é SameSite=Lax): Origin precisa ser o próprio host.
  if (!mesmaOrigem(request)) {
    return Response.json({ ok: false, mensagem: "Origem não permitida." }, { status: 403, headers: SEM_CACHE });
  }
  const acesso = await situacaoDeAcesso();
  if (acesso.tipo === "sem_sessao") return Response.json({ ok: false, motivo: "sessao", mensagem: "Sua sessão expirou. Entre de novo." }, { status: 401, headers: SEM_CACHE });
  if (acesso.tipo === "sem_permissao") return Response.json({ ok: false, motivo: "permissao", mensagem: "Sem permissão." }, { status: 403, headers: SEM_CACHE });

  let arquivo: FormDataEntryValue | null;
  let ehVideo = false;
  try {
    const form = await request.formData();
    ehVideo = form.has("video");
    arquivo = form.get(ehVideo ? "video" : "foto");
  } catch {
    return Response.json({ ok: false, motivo: "falha", mensagem: "Não foi possível ler o arquivo enviado." }, { status: 400, headers: SEM_CACHE });
  }
  const r = ehVideo ? await enviarVideo(arquivo) : await enviarFoto(arquivo);
  return Response.json(r, { status: r.ok ? 200 : r.motivo === "falha" ? 502 : r.motivo === "nao_configurado" ? 503 : 422, headers: SEM_CACHE });
}
