import { z } from "zod";
import type { ConteudoBloco } from "@/db/schema";

// Validação do conteúdo do site. Espelha as regras de `montar` (pagina.ts) (texto não vazio, lista com pelo menos um item,
// desconto 0 a 99, imagem em img/ ou no Blob, link do Explore entre as seções): o que passa aqui TEM que passar em
// `montar`, senão a página `/` falha depois de "publicado" (RISCO-16). O teste de contrato (tests/conteudo-site) cobre isso.
// Sem `server-only`: o formulário do painel usa os mesmos schemas para validar no navegador.

const VAZIO = "Preencha este campo.";
const LISTA = "Adicione pelo menos um item.";
const texto = z.string({ error: VAZIO }).trim().min(1, VAZIO);
const opcional = z.string().trim().default("");
const lista = <T extends z.ZodType>(item: T) => z.array(item, { error: LISTA }).min(1, LISTA);

// Imagem: versionada no site ("img/...") ou enviada ao Vercel Blob público (https, pasta conteudo/, só bitmap).
// Vídeo: versionado no site ("video/...") ou enviado ao Blob (pasta conteudo/, mp4 ou webm). Mesmas regras de origem.
const IMG_SITE = /^img\/[\w\-./]+\.(webp|jpe?g|png|avif|gif|svg)$/i;
const VID_SITE = /^video\/[\w\-./]+\.(mp4|webm)$/i;
const HOST_BLOB = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;
// Host do store Blob da loja (não é segredo: aparece nas imagens do site). NEXT_PUBLIC_ para o formulário validar igual ao servidor.
// Sem ele, só "img/..." e "video/..." são aceitos.
const IMG_BLOB = /^\/conteudo\/[\w\-./]+\.(webp|jpe?g|png)$/i;
const VID_BLOB = /^\/conteudo\/[\w\-./]+\.(mp4|webm)$/i;
function arquivoValido(v: string, site: RegExp, blob: RegExp): boolean {
  const p = v.replace(/^\//, "");
  if (site.test(p) && !p.includes("..")) return true;
  try {
    const u = new URL(v);
    const host = process.env.NEXT_PUBLIC_BLOB_HOST?.toLowerCase();
    return !!host && HOST_BLOB.test(host) && u.protocol === "https:" && u.hostname === host && !u.port && !u.username && !u.search && !u.hash && blob.test(u.pathname) && !u.pathname.includes("..") && u.href === v;
  } catch {
    return false;
  }
}
export const imagemValida = (v: string) => arquivoValido(v, IMG_SITE, IMG_BLOB);
export const videoValido = (v: string) => arquivoValido(v, VID_SITE, VID_BLOB);
const imagem = z.string({ error: "Envie uma foto." }).refine(imagemValida, "Envie uma foto.");
const video = z.string({ error: "Escolha ou envie um vídeo." }).refine(videoValido, "Escolha ou envie um vídeo.");
const videoOpcional = z.string().trim().default("").refine((v) => v === "" || videoValido(v), "Escolha ou envie um vídeo.");
// Poster de vídeo: a mensagem é a do inventário (6.7), não a da foto.
const poster = z.string({ error: "Envie a imagem de espera deste vídeo." }).refine(imagemValida, "Envie a imagem de espera deste vídeo.");
// Limites de tamanho (C1 40, C2 100, C3 400): só para o layout não quebrar. Campo novo ausente em versão antiga = `.optional()`.
const ate = (max: number) => texto.max(max, `Use no máximo ${max} caracteres.`);
const ateOpc = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).default("");
const httpsOpcional = z
  .string()
  .trim()
  .max(300, "Use no máximo 300 caracteres.")
  .default("")
  .refine((v) => v === "" || (/^https:\/\//i.test(v) && URL.canParse(v)), "Use um endereço que comece com https://.");

const preco = z
  .number({ error: "Informe um valor em reais, 0 ou maior. Ex.: 19,90." })
  .min(0, "Informe um valor em reais, 0 ou maior. Ex.: 19,90.")
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Informe um valor em reais, 0 ou maior. Ex.: 19,90.");
const desconto = z
  .number({ error: "Informe um número de 0 a 90." })
  .int("Informe um número de 0 a 90.")
  .min(0, "Informe um número de 0 a 90.")
  .max(90, "Informe um número de 0 a 90.");

/** Seções da página para onde um cartão do Explore pode levar (`link` no JSON, âncora no HTML). */
export const LINKS_EXPLORE = [
  { valor: "#videos", rotulo: "Vídeos" },
  { valor: "#premium", rotulo: "Planos" },
  { valor: "#bonus", rotulo: "Bônus anual" },
  { valor: "#historia", rotulo: "História" },
  { valor: "#explore", rotulo: "Explore" },
  { valor: "#loja", rotulo: "Loja" },
  { valor: "#baixar", rotulo: "Baixar o app" },
  { valor: "#novidades", rotulo: "Novidades" },
] as const;

/** Destinos dos links do menu e do rodapé (CA-LOJ-65): lista fechada, nada de endereço livre. */
export const DESTINOS_LINK = [
  ...LINKS_EXPLORE.map((l) => (l.valor === "#loja" ? { valor: l.valor, rotulo: "Seção Loja (cartões da página inicial)" } : l)),
  { valor: "/", rotulo: "Início do site" },
  { valor: "/loja", rotulo: "Página da loja" },
  { valor: "/login", rotulo: "Entrar" },
  { valor: "politica-de-privacidade.html", rotulo: "Política de privacidade" },
  { valor: "termos-de-uso.html", rotulo: "Termos de uso" },
] as const;

/** Destinos do botão dos cartões da Loja (CA-LOJ-58). Hoje só a página inicial; categorias entram com o catálogo (fase 1b).
 *  O valor guardado nunca é URL livre; `montar` o transforma no endereço da loja. */
export const DESTINOS_LOJA = [{ valor: "inicio", rotulo: "Página inicial da loja" }] as const;

const posicao = z
  .string()
  .trim()
  .default("")
  .refine((v) => v === "" || /^\d{1,3}% \d{1,3}%$/.test(v), "Use o formato 62% 50% ou deixe vazio.");

const hero = z.object({
  frase: texto,
  plataformas: texto,
  botaoEntrar: ate(20).optional(),
  botaoBaixar: ate(20).optional(),
  rolar: ate(30).optional(),
  video: video.optional(),
  videoCelular: videoOpcional,
  poster: poster.optional(),
});
const rede = z.object({ titulo1: texto, titulo2: texto, texto, video: video.optional(), poster: poster.optional() });
const bonus = z.object({ rotulo: texto, titulo1: texto, titulo2: texto, texto, itens: lista(texto), video: video.optional(), poster: poster.optional() });
const historia = z.object({ rotulo: texto, titulo1: texto, titulo2: texto, texto, video: video.optional(), poster: poster.optional() });
const baixar = z.object({
  rotulo: texto, titulo1: texto, titulo2: texto, texto,
  botaoIos: ate(20).optional(),
  botaoAndroid: ate(20).optional(),
  video: video.optional(),
  poster: poster.optional(),
});
const planos = z.object({
  desconto_anual: desconto,
  nota: texto,
  rotulo: ate(40).optional(),
  titulo1: ate(40).optional(),
  titulo2: ate(40).optional(),
  rotuloMensal: ate(16).optional(),
  rotuloAnual: ate(16).optional(),
  planos: lista(z.object({ nome: texto, mensal: preco, texto, botao: texto, capa: imagem, selo: opcional, itens: lista(texto) })),
});
const explore = z.object({
  rotulo: ate(40).optional(),
  titulo1: ate(40).optional(),
  titulo2: ate(40).optional(),
  verMais: ate(16).optional(),
  cartoes: lista(
    z.object({
      titulo: texto,
      texto,
      imagem,
      posicao,
      inteira: z.boolean(),
      link: z.enum(LINKS_EXPLORE.map((l) => l.valor) as [string, ...string[]], { error: "Escolha uma seção." }),
    }),
  ),
});
const loja = z.object({
  rotulo: texto,
  titulo1: texto,
  titulo2: texto,
  produtos: lista(
    z.object({
      nome: texto,
      descricao: texto,
      foto: imagem,
      alt: opcional,
      botao: texto,
      destino: z.enum(DESTINOS_LOJA.map((d) => d.valor) as [string, ...string[]], { error: "Escolha para onde o botão leva." }),
    }),
  ),
});
const novidades = z.object({
  rotulo: ate(40).optional(),
  titulo1: ate(40).optional(),
  titulo2: ate(40).optional(),
  noticias: lista(z.object({ data: texto, titulo: texto, imagem })),
});

// Blocos novos (ADR-0007 A1). Vivem dentro de `textos`; ausentes nas versões antigas (a CHECK do banco não exige chave nova no topo).
const videos = z.object({
  rotulo: ate(40), titulo1: ate(40), titulo2: ate(40),
  trocaInicio: ate(20), trocaMeio: ate(20),
  trocaPalavras: z.array(ate(20), { error: "Adicione pelo menos 2 palavras." }).min(2, "Adicione pelo menos 2 palavras.").max(8, "Use no máximo 8 palavras."),
  grandeEtiqueta: ate(30), grandeTitulo: ate(40), grandeVideo: video, grandePoster: poster,
  v1Etiqueta: ate(30), v1Titulo: ate(40), v1Video: video, v1Poster: poster,
  v2Etiqueta: ate(30), v2Titulo: ate(40), v2Video: video, v2Poster: poster,
});
const destinoLink = z.enum(DESTINOS_LINK.map((d) => d.valor) as [string, ...string[]], { error: "Escolha para onde o link leva." });
const geral = z.object({
  seoTitulo: texto.max(60, "Use no máximo 60 caracteres."),
  seoDescricao: texto.max(160, "Use no máximo 160 caracteres."),
  slogan: ate(40),
  menu: z.array(z.object({ texto: ate(20), destino: destinoLink }), { error: LISTA }).min(1, LISTA).max(6, "Use no máximo 6 links."),
  botaoBaixar: ate(16),
  entrarLongo: ate(20),
  entrarCurto: ate(10),
  sair: ate(12),
  painel: ate(14),
  lojaIos: httpsOpcional,
  lojaAndroid: httpsOpcional,
  lojaDica: ate(30),
  rodapeSlogan: ate(40),
  rodapeLinks: z.array(z.object({ texto: ate(30), destino: destinoLink }), { error: LISTA }).min(1, LISTA).max(8, "Use no máximo 8 links."),
  direitos: ate(100),
  versao: ateOpc(60),
  newsRotulo: ate(50),
  newsExemplo: ate(30),
  newsBotao: ate(16),
  newsSucesso: ate(100),
  newsInvalido: ate(100),
});
const paginaLoja = z.object({
  seoTitulo: texto.max(60, "Use no máximo 60 caracteres."),
  seoDescricao: texto.max(160, "Use no máximo 160 caracteres."),
  rotulo: ate(40), titulo1: ate(40), titulo2: ate(40),
  abertura: ate(400),
  vazio: ate(100),
  aPartirDe: ate(20),
  esgotado: ate(16),
});

/** O conteúdo completo: os 5 documentos no formato de scripts/conteudo-inicial/*.json (+ `destino` nos cartões da Loja). */
export const conteudoSchema = z.object({
  textos: z.object({ hero, rede, bonus, historia, baixar, videos: videos.optional(), geral: geral.optional(), paginaLoja: paginaLoja.optional() }),
  loja,
  explore,
  novidades,
  planos,
});
export type Conteudo = z.infer<typeof conteudoSchema>;

export type Bloco = ConteudoBloco;
type Definicao = { nome: string; ref: readonly [keyof Conteudo] | readonly ["textos", keyof Conteudo["textos"]]; schema: z.ZodType };

/** Os 12 blocos, na ordem em que aparecem no site (Geral primeiro: o cabeçalho; Página da loja por último). `ref` diz onde o bloco vive dentro do conteúdo. */
export const BLOCOS: Record<Bloco, Definicao> = {
  geral: { nome: "Geral (buscadores, cabeçalho, rodapé)", ref: ["textos", "geral"], schema: geral },
  abertura: { nome: "Abertura", ref: ["textos", "hero"], schema: hero },
  parceiros: { nome: "Rede de parceiros (abertura)", ref: ["textos", "rede"], schema: rede },
  videos: { nome: "Vídeos", ref: ["textos", "videos"], schema: videos },
  planos: { nome: "Planos e preços", ref: ["planos"], schema: planos },
  bonus: { nome: "Bônus do plano anual", ref: ["textos", "bonus"], schema: bonus },
  historia: { nome: "História", ref: ["textos", "historia"], schema: historia },
  explore: { nome: "Explore (cartões)", ref: ["explore"], schema: explore },
  loja: { nome: "Loja (cartões)", ref: ["loja"], schema: loja },
  baixar: { nome: "Baixe o app", ref: ["textos", "baixar"], schema: baixar },
  novidades: { nome: "Novidades", ref: ["novidades"], schema: novidades },
  "pagina-loja": { nome: "Página da loja (/loja)", ref: ["textos", "paginaLoja"], schema: paginaLoja },
};
export const SLUGS = Object.keys(BLOCOS) as Bloco[];
export const ehBloco = (v: unknown): v is Bloco => typeof v === "string" && Object.hasOwn(BLOCOS, v);

/** O pedaço do conteúdo que pertence ao bloco (o que o formulário edita). */
export function fatia(c: Conteudo, bloco: Bloco): unknown {
  const ref = BLOCOS[bloco].ref;
  return ref.length === 1 ? c[ref[0]] : c.textos[ref[1]];
}

/** Conteúdo novo = `c` com o bloco trocado por `dados` (já validado). Não altera `c`. */
export function comFatia(c: Conteudo, bloco: Bloco, dados: unknown): Conteudo {
  const ref = BLOCOS[bloco].ref;
  const novo = structuredClone(c) as Record<string, unknown>;
  if (ref.length === 1) novo[ref[0]] = dados;
  else (novo.textos as Record<string, unknown>)[ref[1]] = dados;
  return conteudoSchema.parse(novo);
}

/** Erros de validação como lista plana: caminho ("planos.0.nome") e mensagem para o campo. */
export function errosDe(erro: z.ZodError): { caminho: string; mensagem: string }[] {
  return erro.issues.map((i) => ({ caminho: i.path.join("."), mensagem: i.message }));
}

const corta = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
/** Uma linha do que há dentro do bloco, para a lista de blocos. */
export function resumo(c: Conteudo, bloco: Bloco): string {
  switch (bloco) {
    case "abertura": return corta(c.textos.hero.frase);
    case "parceiros": return corta(`${c.textos.rede.titulo1} ${c.textos.rede.titulo2}`);
    case "planos": return plural(c.planos.planos.length, "plano", "planos");
    case "bonus": return corta(c.textos.bonus.titulo1);
    case "historia": return corta(c.textos.historia.titulo1);
    case "explore": return plural(c.explore.cartoes.length, "cartão", "cartões");
    case "loja": return plural(c.loja.produtos.length, "cartão", "cartões");
    case "baixar": return corta(c.textos.baixar.titulo1);
    case "novidades": return plural(c.novidades.noticias.length, "notícia", "notícias");
    case "geral": return corta(c.textos.geral?.seoTitulo ?? "");
    case "videos": return c.textos.videos ? "3 vídeos" : "";
    case "pagina-loja": return corta(c.textos.paginaLoja?.seoTitulo ?? "");
  }
}
