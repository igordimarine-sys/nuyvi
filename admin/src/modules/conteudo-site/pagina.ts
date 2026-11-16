// Porte de `montar` de site/build.mjs (ADR-0007, passo 2): mesma lógica, mesma saída byte a byte (snapshots de
// tests/conteudo-site). Remonta os trechos `<!--cms:CHAVE-->...<!--/cms:CHAVE-->` do HTML com o conteúdo do site.
// As regras de imagem ficam copiadas de build.mjs (e não de `imagemValida`, de schema.ts) porque aqui o host do Blob é
// parâmetro e a mensagem de erro é outra.
//
// Blocos novos (ADR-0007 A1): chaves que não estão em CHAVES_ANTIGAS são opcionais. Sem o dado (versão antiga do conteúdo, tabela
// vazia) o texto do template fica como está; com o dado, são gerados. Em ambos os casos o marcador some do HTML servido, então
// o resultado com os valores iniciais é idêntico, byte a byte, ao do conteúdo sem os blocos novos.
import type { ProdutoVitrine } from "@/modules/catalogo/vitrine";
import { DESTINOS_LINK } from "./schema";

// O conteúdo chega sem garantia de forma (JSON da loja): cada trecho valida em tempo de execução, como no build.mjs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Solto = any;
export type DadosPagina = Record<string, Solto>;
export type OpcoesPagina = { lojaUrl?: string; blobHost?: string };

const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
function erro(msg: string): never {
  throw new Error(`conteudo inválido: ${msg}`);
}
function texto(v: unknown, onde: string): string {
  if (typeof v !== "string" || !v.trim()) erro(`${onde} está vazio`);
  return esc(v.trim());
}
/** Texto sem escape de HTML, para dentro de JSON (o `<` é neutralizado quando o JSON vai para a página). */
function cru(v: unknown, onde: string): string {
  if (typeof v !== "string" || !v.trim()) erro(`${onde} está vazio`);
  return v.trim();
}
function lista(v: unknown, onde: string): Solto[] {
  if (!Array.isArray(v) || !v.length) erro(`${onde} precisa de pelo menos um item`);
  return v;
}
// Imagens: versionadas no site ("img/..."; o painel antigo gravava "/img/..." e a página usa caminho relativo) ou
// enviadas pelo painel ao Vercel Blob público (https, exatamente o host de blobHost, pasta conteudo/).
const IMG_SITE = /^img\/[\w\-./]+\.(webp|jpe?g|png|avif|gif|svg)$/i;
const HOST_BLOB = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/; // formato do host; o valor aceito vem de blobHost
const IMG_BLOB = /^\/conteudo\/[\w\-./]+\.(webp|jpe?g|png)$/i;
function imagemDe(v: unknown, onde: string, blobHost: string): string {
  const p = String(v ?? "").replace(/^\//, "");
  if (IMG_SITE.test(p) && !p.includes("..")) return esc(p);
  try {
    const u = new URL(String(v));
    if (blobHost && HOST_BLOB.test(blobHost) && u.protocol === "https:" && u.hostname === blobHost && !u.port && !u.username && !u.search && !u.hash && IMG_BLOB.test(u.pathname) && !u.pathname.includes("..") && u.href === v) return esc(v);
  } catch {
    /* cai no erro abaixo */
  }
  return erro(`${onde}: imagem "${v}" fora de img/ e do host do Blob configurado`);
}
// Destino do botão dos cartões da Loja: "inicio" (página inicial da loja) ou "categoria/<slug>".
// Sem `destino` (conteúdo antigo) ou sem lojaUrl, o botão leva a #baixar, como antes.
function destino(v: unknown, lojaUrl: string, onde: string): string {
  if (v === undefined || v === null || v === "") return "#baixar";
  if (v !== "inicio" && !/^categoria\/[a-z0-9-]+$/.test(String(v))) erro(`${onde}: destino "${v}" inválido`);
  if (!lojaUrl) return "#baixar";
  return esc(v === "inicio" ? lojaUrl : `${lojaUrl}/${v}`);
}
const VID_SITE = /^video\/[\w\-./]+\.(mp4|webm)$/i;
const VID_BLOB = /^\/conteudo\/[\w\-./]+\.(mp4|webm)$/i;
function videoDe(v: unknown, onde: string, blobHost: string): string {
  const p = String(v ?? "").replace(/^\//, "");
  if (VID_SITE.test(p) && !p.includes("..")) return esc(p);
  try {
    const u = new URL(String(v));
    if (blobHost && HOST_BLOB.test(blobHost) && u.protocol === "https:" && u.hostname === blobHost && !u.port && !u.username && !u.search && !u.hash && VID_BLOB.test(u.pathname) && !u.pathname.includes("..") && u.href === v) return esc(v);
  } catch {
    /* cai no erro abaixo */
  }
  return erro(`${onde}: vídeo "${v}" fora de video/ e do host do Blob configurado`);
}
// Só https para endereço externo (CA-LOJ-65, lojas de apps); vazio = botão desativado.
function urlHttps(v: unknown, onde: string): string {
  if (v === undefined || v === null || v === "") return "";
  try {
    if (new URL(String(v)).protocol === "https:" && /^https:\/\//i.test(String(v))) return String(v);
  } catch {
    /* cai no erro abaixo */
  }
  return erro(`${onde}: endereço "${v}" deve começar com https://`);
}
const DESTINOS = new Set<string>(DESTINOS_LINK.map((d) => d.valor));
function link(l: Solto, onde: string): string {
  if (!DESTINOS.has(l?.destino)) erro(`${onde}: destino "${l?.destino}" fora da lista`);
  return `<li><a href="${esc(l.destino)}">${texto(l.texto, `${onde}, texto`)}</a></li>`;
}
// Atributos de comportamento e de layout de cada vídeo ficam fixos aqui; o conteúdo só traz caminho e imagem de espera.
const VIDEOS: Record<string, (s: string, p: string, cel: string) => string> = {
  hero: (s, p, cel) => `<video poster="${p}" muted loop playsinline preload="none" data-auto data-video-abertura="atletas" data-src="${s}"${cel ? ` data-src-cel="${cel}"` : ""} data-deriva="19s" style="--deriva:19s"></video>`,
  rede: (s, p) => `<video data-deriva="23s" style="--deriva:23s" src="${s}" poster="${p}" muted loop playsinline preload="none" disablepictureinpicture data-video-abertura="ciclismo"></video>`,
  grande: (s, p) => `<video src="${s}" poster="${p}" muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true" width="1280" height="720" data-fundo-video></video>`,
  v1: (s, p) => `<video src="${s}" poster="${p}" muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true" width="540" height="960" data-fundo-video></video>`,
  v2: (s, p) => `<video src="${s}" poster="${p}" muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true" width="480" height="854" data-fundo-video></video>`,
  bonus: (s, p) => `<video data-deriva="31s" style="object-position:60% 50%;--deriva:31s" src="${s}" poster="${p}" muted loop playsinline preload="none" disablepictureinpicture data-fundo-video data-zoom aria-hidden="true"></video>`,
  historia: (s, p) => `<video data-deriva="27s" style="--deriva:27s" src="${s}" poster="${p}" muted loop playsinline preload="none" disablepictureinpicture data-fundo-video data-hist-img></video>`,
  baixar: (s, p) => `<video data-deriva="29s" style="--deriva:29s" src="${s}" poster="${p}" muted loop playsinline preload="none" disablepictureinpicture data-fundo-video data-paralaxe></video>`,
};
/**
 * Grupo de conta do cabeçalho (ADR-0007 A2). Sai sempre no estado visitante, igual para todos (a página é cacheada e nunca leva
 * dado de ninguém); `public/js/conta.js` pergunta a sessão e troca. Textos fixos (só leitor de tela e erro de saída): PREM-15.
 */
export function grupoConta(longo: string, curto: string, painel: string, sair: string): string {
  return `<div class="conta" data-conta data-estado="carregando" role="group" aria-label="Conta">`
    + `<a class="bt bt-claro" href="/login" data-login aria-label="${longo}"><span class="rot-longo">${longo}</span><span class="rot-curto" aria-hidden="true">${curto}</span></a>`
    + `<div class="conta-logada" data-logada hidden><button type="button" class="conta-toggle" data-conta-toggle aria-expanded="false" aria-controls="conta-painel"><span class="conta-inicial" data-inicial aria-hidden="true"></span><span class="sr-only" data-conta-rotulo>Conta</span></button>`
    + `<div class="conta-painel" id="conta-painel" data-conta-painel><span class="sr-only">Conectado como </span><span class="conta-nome" data-nome></span><a class="bt bt-claro" href="/admin" data-painel>${painel}</a><button type="button" class="bt bt-linha" data-sair>${sair}</button></div></div>`
    + `<p class="sr-only" role="status" data-conta-aviso></p><p class="conta-erro" role="alert" data-conta-erro hidden>Não foi possível sair. Tente de novo.</p></div>`;
}
/** Chaves que já existiam antes de A1: continuam obrigatórias e com o marcador no HTML. */
const CHAVES_ANTIGAS = new Set([
  "textos.hero.frase", "textos.hero.plataformas", "textos.rede.titulo1", "textos.rede.titulo2", "textos.rede.texto",
  "textos.bonus.rotulo", "textos.bonus.titulo1", "textos.bonus.titulo2", "textos.bonus.texto", "textos.bonus.itens",
  "textos.historia.rotulo", "textos.historia.titulo1", "textos.historia.titulo2", "textos.historia.texto",
  "textos.baixar.rotulo", "textos.baixar.titulo1", "textos.baixar.titulo2", "textos.baixar.texto",
  "loja.rotulo", "loja.titulo1", "loja.titulo2", "loja.produtos", "explore.cartoes", "novidades.noticias",
  "planos.economia", "planos.nota", "planos.dados",
]);
const seta = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
const LINKS = ["#videos", "#premium", "#bonus", "#historia", "#explore", "#loja", "#baixar", "#novidades"];

/** Remonta os trechos `<!--cms:...-->` de `html` com `dados` ({textos, loja, explore, novidades, planos}). Lança se o conteúdo for inválido. */
export function montar(html: string, dados: DadosPagina, { lojaUrl = "", blobHost = "" }: OpcoesPagina = {}): { html: string; trechos: number } {
  const imagem = (v: unknown, onde: string) => imagemDe(v, onde, blobHost.toLowerCase());
  const desconto = (): number => {
    const d = dados.planos.desconto_anual;
    if (typeof d !== "number" || d < 0 || d >= 100) erro("desconto anual inválido");
    return d;
  };

  const blocos: Record<string, () => string> = {
    "textos.bonus.itens": () => lista(dados.textos.bonus.itens, "bônus: itens").map((t, i) => `<li>${texto(t, `bônus: item ${i + 1}`)}</li>`).join(""),

    "loja.produtos": () =>
      lista(dados.loja.produtos, "loja: produtos")
        .map((p, i) => {
          const o = `loja: produto ${i + 1}`;
          return (
            `<a class="produto" href="${destino(p.destino, lojaUrl, o)}" data-revela-card><span class="foto"><img src="${imagem(p.foto, o)}" alt="${esc(p.alt ?? "")}" loading="lazy"></span>` +
            `<span class="info"><h3>${texto(p.nome, `${o}, nome`)}</h3><p>${texto(p.descricao, `${o}, descrição`)}</p><span class="ir">${texto(p.botao, `${o}, botão`)}</span></span></a>`
          );
        })
        .join("\n      "),

    "explore.cartoes": () => {
      const c = lista(dados.explore.cartoes, "explore: cartões");
      return c
        .map((k, i) => {
          const o = `explore: cartão ${i + 1}`;
          if (!LINKS.includes(k.link)) erro(`${o}: link "${k.link}" não é uma seção da página`);
          const pos = /^\d{1,3}% \d{1,3}%$/.test(k.posicao ?? "") ? ` style="object-position:${k.posicao}"` : "";
          return (
            `<li role="group" aria-roledescription="slide" aria-label="${i + 1} de ${c.length}"><a class="cartao" href="${k.link}" data-revela-card>` +
            `<img${k.inteira ? ' class="contida"' : ""} src="${imagem(k.imagem, o)}" alt="" loading="lazy"${k.inteira ? "" : pos}>` +
            `<span class="info"><h3>${texto(k.titulo, `${o}, título`)}</h3><p>${texto(k.texto, `${o}, texto`)}</p><span class="ir">${dados.explore.verMais ? texto(dados.explore.verMais, `${o}, ver mais`) : "Ver mais"} ${seta}</span></span></a></li>`
          );
        })
        .join("\n        ");
    },

    "novidades.noticias": () => {
      const n = lista(dados.novidades.noticias, "novidades: notícias");
      return n
        .map((k, i) => {
          const o = `novidades: notícia ${i + 1}`;
          return (
            `<li role="group" aria-roledescription="slide" aria-label="${i + 1} de ${n.length}"><article class="noticia" data-revela-card>` +
            `<div class="foto"><img src="${imagem(k.imagem, o)}" alt="" loading="lazy"></div><div class="info"><time>${texto(k.data, `${o}, data`)}</time><h3>${texto(k.titulo, `${o}, título`)}</h3></div></article></li>`
          );
        })
        .join("\n        ");
    },

    "planos.economia": () => `-${desconto()}%`,

    // os planos continuam montados pelo script da página (carrossel e troca mensal/anual); aqui só vão os dados
    "planos.dados": () => {
      const planos = lista(dados.planos.planos, "planos").map((p, i) => {
        const o = `plano ${i + 1}`;
        if (typeof p.mensal !== "number" || p.mensal < 0) erro(`${o}: preço mensal inválido`);
        return {
          id: `p${i + 1}`,
          nome: texto(p.nome, `${o}, nome`),
          mensal: p.mensal,
          texto: texto(p.texto, `${o}, texto`),
          cta: texto(p.botao, `${o}, botão`),
          capa: imagem(p.capa, o),
          destaque: p.selo ? esc(p.selo) : "",
          itens: lista(p.itens, `${o}, itens`).map((t, k) => texto(t, `${o}, item ${k + 1}`)),
        };
      });
      const json = JSON.stringify({ desconto: desconto() / 100, planos }).replace(/</g, "\\u003c");
      return `<script type="application/json" id="dados-planos">${json}</script>`;
    },
  };

  // Blocos novos: devolvem `undefined` quando o conteúdo não tem o dado (versão antiga), e o template fica como está.
  const g = dados.textos?.geral;
  const v = dados.textos?.videos;
  const p = dados.textos?.paginaLoja;
  const video = (slot: string, caminho: Solto, posterV: Solto, celular: Solto, onde: string): string | undefined => {
    if (caminho === undefined || posterV === undefined) return undefined;
    return VIDEOS[slot]!(videoDe(caminho, onde, blobHost.toLowerCase()), imagem(posterV, `${onde}, imagem de espera`), celular ? videoDe(celular, `${onde} (celular)`, blobHost.toLowerCase()) : "");
  };
  const novos: Record<string, () => string | undefined> = {
    "textos.geral.seo": () => g && `<title>${texto(g.seoTitulo, "geral: título da página")}</title>\n<meta name="description" content="${texto(g.seoDescricao, "geral: descrição")}">`,
    "textos.geral.menu": () => g && lista(g.menu, "geral: menu").map((l, i) => link(l, `geral: menu, link ${i + 1}`)).join("\n      "),
    "textos.geral.entrar": () => g && grupoConta(texto(g.entrarLongo, "geral: entrar (completo)"), texto(g.entrarCurto, "geral: entrar (curto)"), texto(g.painel, "geral: Painel"), texto(g.sair, "geral: Sair")),
    "textos.paginaLoja.seo": () => p && `<title>${texto(p.seoTitulo, "página da loja: título")}</title>\n<meta name="description" content="${texto(p.seoDescricao, "página da loja: descrição")}">`,
    "textos.geral.rodapeLinks": () => g && lista(g.rodapeLinks, "geral: links do rodapé").map((l, i) => link(l, `geral: rodapé, link ${i + 1}`)).join("\n        "),
    "textos.geral.rodapeBase": () => g && `<span>${texto(g.direitos, "geral: direitos")}</span>${typeof g.versao === "string" && g.versao.trim() ? `<span>${texto(g.versao, "geral: versão")}</span>` : ""}`,
    "textos.geral.newsCampo": () => g && `<input id="email" type="email" name="email" placeholder="${texto(g.newsExemplo, "geral: exemplo do e-mail")}" autocomplete="email" required aria-describedby="email-aviso">`,
    "textos.geral.newsForm": () => g && `<form data-news novalidate data-ok="${texto(g.newsSucesso, "geral: sucesso da newsletter")}" data-invalido="${texto(g.newsInvalido, "geral: e-mail inválido")}">`,
    // Endereços das lojas de apps (só https, vazio = botão desativado) e a dica; lido por public/js/rodape.js
    "textos.geral.lojas": () => g && `<script type="application/json" id="dados-lojas">${JSON.stringify({ ios: urlHttps(g.lojaIos, "geral: App Store"), android: urlHttps(g.lojaAndroid, "geral: Google Play"), dica: cru(g.lojaDica, "geral: dica do botão desativado") }).replace(/</g, "\\u003c")}</script>`,
    "textos.hero.video": () => video("hero", dados.textos.hero.video, dados.textos.hero.poster, dados.textos.hero.videoCelular, "abertura"),
    "textos.rede.video": () => video("rede", dados.textos.rede.video, dados.textos.rede.poster, "", "rede de parceiros"),
    "textos.bonus.video": () => video("bonus", dados.textos.bonus.video, dados.textos.bonus.poster, "", "bônus"),
    "textos.historia.video": () => video("historia", dados.textos.historia.video, dados.textos.historia.poster, "", "história"),
    "textos.baixar.video": () => video("baixar", dados.textos.baixar.video, dados.textos.baixar.poster, "", "baixe o app"),
    "textos.videos.grande": () => v && video("grande", v.grandeVideo, v.grandePoster, "", "vídeos: vídeo grande"),
    "textos.videos.v1": () => v && video("v1", v.v1Video, v.v1Poster, "", "vídeos: vídeo vertical 1"),
    "textos.videos.v2": () => v && video("v2", v.v2Video, v.v2Poster, "", "vídeos: vídeo vertical 2"),
    "textos.videos.troca": () => {
      if (!v) return undefined;
      const p = lista(v.trocaPalavras, "vídeos: palavras que trocam").map((t, i) => texto(t, `vídeos: palavra ${i + 1}`));
      const lidas = p.length > 1 ? `${p.slice(0, -1).join(", ")} e ${p.at(-1)}` : (p[0] ?? "");
      return `<h2 class="troca" aria-label="${texto(v.trocaInicio, "vídeos: início da frase")} ${texto(v.trocaMeio, "vídeos: meio da frase")} ${lidas}" data-troca>\n`
        + `        <span class="troca-fixo" aria-hidden="true">${texto(v.trocaInicio, "vídeos: início da frase")}</span>\n`
        + `        <span class="troca-fixo" aria-hidden="true">${texto(v.trocaMeio, "vídeos: meio da frase")}</span>\n`
        + `        <span class="troca-pilula" aria-hidden="true" data-troca-pilula>${p.map((t, i) => `<span class="troca-palavra${i === 0 ? " atual" : ""}">${t}</span>`).join("")}</span>\n`
        + `        <span class="troca-pontos" aria-hidden="true" data-troca-pontos>${p.map((_, i) => (i === 0 ? '<i class="atual"></i>' : "<i></i>")).join("")}</span>\n`
        + `      </h2>`;
    },
  };

  // chave sem bloco próprio = texto simples, ex.: textos.hero.frase, loja.titulo1, planos.nota
  const valor = (chave: string): string => {
    if (blocos[chave]) return blocos[chave]();
    return texto(chave.split(".").reduce((o: Solto, k) => o?.[k], dados), chave);
  };
  /** Chave nova: bloco gerado ou texto simples; sem o dado devolve `undefined` (fica o texto do template). */
  const valorNovo = (chave: string): string | undefined => {
    if (novos[chave]) return novos[chave]();
    const x = chave.split(".").reduce((o: Solto, k) => o?.[k], dados);
    return x === undefined ? undefined : texto(x, chave);
  };

  const usadas = new Set<string>();
  const novo = html.replace(/<!--cms:([\w.]+)-->([\s\S]*?)<!--\/cms:\1-->/g, (_, chave: string, interior: string) => {
    usadas.add(chave);
    if (CHAVES_ANTIGAS.has(chave)) return `<!--cms:${chave}-->${valor(chave)}<!--/cms:${chave}-->`;
    return valorNovo(chave) ?? interior;
  });
  if (!usadas.size) erro("nenhum marcador <!--cms:...--> encontrado no index.html");
  return { html: novo, trechos: usadas.size };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Página /loja (ADR-0007 A3): vitrine básica, sem carrinho nem página de produto. Cabeçalho e rodapé saem do MESMO gerador da home
// (o `montar` do template de `/`), só adaptados à página; o resto vem do template `loja.html`, dos textos do bloco `pagina-loja`
// e do catálogo (nome, categoria, foto, preço e estoque nunca vêm do conteúdo do site, RN-LOJ-18).

const brl = (centavos: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100).replace(/\u00a0/g, " ");
/** Foto do catálogo: só https ou caminho do próprio site; qualquer outra coisa não vira `<img>`. */
const fotoSegura = (u: string | null): string | null => (u && (/^https:\/\//i.test(u) || /^\/(?!\/)/.test(u)) ? u : null);

/** Grade de produtos, ou o estado vazio com o texto do painel (CA-LOJ-79). */
export function vitrineHtml(produtos: readonly ProdutoVitrine[], textos: Solto): string {
  const t = (campo: string, padrao: string) => (typeof textos?.[campo] === "string" && textos[campo].trim() ? esc(textos[campo].trim()) : padrao);
  if (!produtos.length) return `<div class="loja-vazio"><p class="loja-vazio-texto sol">${t("vazio", "Em breve")}</p></div>`;
  const itens = produtos.map((p, i) => {
    const foto = fotoSegura(p.fotoUrl);
    const img = foto ? `<img src="${esc(foto)}" alt="${esc(p.fotoAlt ?? "")}"${i < 2 ? "" : ' loading="lazy"'}>` : "";
    const etiqueta = p.esgotado ? `<span class="etiqueta-esgotado">${t("esgotado", "Esgotado")}</span>` : "";
    const aPartirDe = p.variaPreco ? `<small>${t("aPartirDe", "a partir de")}</small>` : "";
    return `<li><article class="produto produto-estatico${p.esgotado ? " produto-esgotado" : ""}"><div class="foto">${img}${etiqueta}</div>`
      + `<div class="info"><span class="rotulo">${esc(p.categoria)}</span><h3>${esc(p.nome)}</h3><p class="preco-produto">${aPartirDe}${esc(brl(p.precoCentavos))}</p></div></article></li>`;
  });
  return `<ul class="loja loja-grade" role="list">${itens.join("\n      ")}</ul>`;
}

// Fora de `/`, os destinos de seção e os caminhos relativos do cabeçalho e do rodapé precisam ser absolutos.
const absolutos = (h: string) => h
  .replace(/href="#topo"/g, 'href="/"')
  .replace(/href="#([\w-]+)"/g, 'href="/#$1"')
  .replace(/href="(?![a-z]+:|\/|#)([^"]+)"/g, 'href="/$1"')
  .replace(/src="img\//g, 'src="/img/');
const trecho = (html: string, re: RegExp, nome: string): string => html.match(re)?.[0] ?? erro(`template da página inicial sem ${nome}`);

/**
 * Monta `/loja`. `dados` = conteúdo publicado (ou `null` com a tabela vazia: ficam os textos dos templates); `home` e `loja` são os
 * templates de `/` e de `/loja`. Aceita `lojaUrl`/`blobHost` como o `montar`.
 */
export function montarLoja(loja: string, home: string, dados: DadosPagina | null, produtos: readonly ProdutoVitrine[], opcoes: OpcoesPagina = {}): string {
  const inicio = dados ? montar(home, dados, opcoes).html : home;
  const cabecalho = absolutos(trecho(inicio, /<header class="topo">[\s\S]*?<\/header>/, "cabeçalho"))
    .replace(/<button class="pausa"[\s\S]*?<\/button>\s*/, "") // sem animação contínua, sem pausa
    .replace(/<a href="\/loja">/g, '<a href="/loja" aria-current="page">');
  const rodape = absolutos(trecho(inicio, /<footer class="rodape">[\s\S]*?<\/footer>/, "rodapé"));
  const lojas = trecho(inicio, /<script type="application\/json" id="dados-lojas">[\s\S]*?<\/script>/, "endereços das lojas de apps");
  const pagina = dados ? montar(loja, dados, opcoes).html : loja;
  return pagina
    .replace("<!--cabecalho-->", () => cabecalho)
    .replace("<!--rodape-->", () => rodape)
    .replace("<!--dados-lojas-->", () => lojas)
    .replace("<!--vitrine-->", () => vitrineHtml(produtos, dados?.textos?.paginaLoja));
}
