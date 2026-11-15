import { z } from "zod";
import type { ConteudoBloco } from "@/db/schema";

// Validação do conteúdo do site. Espelha as regras de site/build.mjs (texto não vazio, lista com pelo menos um item,
// desconto 0 a 99, imagem em img/ ou no Blob, link do Explore entre as seções): o que passa aqui TEM que passar no
// build, senão o site falha depois de "publicado" (RISCO-16). O teste de contrato (tests/conteudo-site) cobre isso.
// Sem `server-only`: o formulário do painel usa os mesmos schemas para validar no navegador.

const VAZIO = "Preencha este campo.";
const LISTA = "Adicione pelo menos um item.";
const texto = z.string({ error: VAZIO }).trim().min(1, VAZIO);
const opcional = z.string().trim().default("");
const lista = <T extends z.ZodType>(item: T) => z.array(item, { error: LISTA }).min(1, LISTA);

// Imagem: versionada no site ("img/...") ou enviada ao Vercel Blob público (https, pasta conteudo/, só bitmap).
const IMG_SITE = /^img\/[\w\-./]+\.(webp|jpe?g|png|avif|gif|svg)$/i;
const HOST_BLOB = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;
// Host do store Blob da loja (não é segredo: aparece nas imagens do site). NEXT_PUBLIC_ para o formulário validar igual ao servidor.
// Sem ele, só "img/..." é aceito.
const IMG_BLOB = /^\/conteudo\/[\w\-./]+\.(webp|jpe?g|png)$/i;
export function imagemValida(v: string): boolean {
  const p = v.replace(/^\//, "");
  if (IMG_SITE.test(p) && !p.includes("..")) return true;
  try {
    const u = new URL(v);
    const host = process.env.NEXT_PUBLIC_BLOB_HOST?.toLowerCase();
    return !!host && HOST_BLOB.test(host) && u.protocol === "https:" && u.hostname === host && !u.port && !u.username && !u.search && !u.hash && IMG_BLOB.test(u.pathname) && !u.pathname.includes("..") && u.href === v;
  } catch {
    return false;
  }
}
const imagem = z.string({ error: "Envie uma foto." }).refine(imagemValida, "Envie uma foto.");

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

/** Destinos do botão dos cartões da Loja (CA-LOJ-58). Hoje só a página inicial; categorias entram com o catálogo (fase 1b).
 *  O valor guardado vira URL no build (`LOJA_URL` + valor), nunca é URL livre. */
export const DESTINOS_LOJA = [{ valor: "inicio", rotulo: "Página inicial da loja" }] as const;

const posicao = z
  .string()
  .trim()
  .default("")
  .refine((v) => v === "" || /^\d{1,3}% \d{1,3}%$/.test(v), "Use o formato 62% 50% ou deixe vazio.");

const hero = z.object({ frase: texto, plataformas: texto });
const rede = z.object({ titulo1: texto, titulo2: texto, texto });
const bonus = z.object({ rotulo: texto, titulo1: texto, titulo2: texto, texto, itens: lista(texto) });
const historia = z.object({ rotulo: texto, titulo1: texto, titulo2: texto, texto });
const baixar = historia;
const planos = z.object({
  desconto_anual: desconto,
  nota: texto,
  planos: lista(z.object({ nome: texto, mensal: preco, texto, botao: texto, capa: imagem, selo: opcional, itens: lista(texto) })),
});
const explore = z.object({
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
const novidades = z.object({ noticias: lista(z.object({ data: texto, titulo: texto, imagem })) });

/** O conteúdo completo: os 5 documentos no formato de site/conteudo/*.json (+ `destino` nos cartões da Loja). */
export const conteudoSchema = z.object({ textos: z.object({ hero, rede, bonus, historia, baixar }), loja, explore, novidades, planos });
export type Conteudo = z.infer<typeof conteudoSchema>;

export type Bloco = ConteudoBloco;
type Definicao = { nome: string; ref: readonly [keyof Conteudo] | readonly ["textos", keyof Conteudo["textos"]]; schema: z.ZodType };

/** Os 9 blocos, na ordem em que aparecem no site. `ref` diz onde o bloco vive dentro do conteúdo. */
export const BLOCOS: Record<Bloco, Definicao> = {
  abertura: { nome: "Abertura", ref: ["textos", "hero"], schema: hero },
  parceiros: { nome: "Rede de parceiros (abertura)", ref: ["textos", "rede"], schema: rede },
  planos: { nome: "Planos e preços", ref: ["planos"], schema: planos },
  bonus: { nome: "Bônus do plano anual", ref: ["textos", "bonus"], schema: bonus },
  historia: { nome: "História", ref: ["textos", "historia"], schema: historia },
  explore: { nome: "Explore (cartões)", ref: ["explore"], schema: explore },
  loja: { nome: "Loja (cartões)", ref: ["loja"], schema: loja },
  baixar: { nome: "Baixe o app", ref: ["textos", "baixar"], schema: baixar },
  novidades: { nome: "Novidades", ref: ["novidades"], schema: novidades },
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
  }
}
