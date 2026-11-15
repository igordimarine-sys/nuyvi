// Gera as partes editáveis do index.html a partir do conteúdo do site (ADR-0006).
// Sem dependências: `node build.mjs`. Reescreve só os trechos entre <!--cms:CHAVE--> e <!--/cms:CHAVE-->,
// então o index.html continua sendo uma página pronta e o comando pode rodar quantas vezes quiser.
//
// Fonte do conteúdo:
//   CONTEUDO_URL definida -> busca a última versão publicada na loja (GET /api/conteudo-site). Qualquer falha
//                            (rede, status diferente de 200, JSON ou conteúdo inválido) PARA o build, e a Vercel
//                            mantém o deploy anterior (CA-LOJ-59).
//   CONTEUDO_URL ausente  -> lê conteudo/*.json (fluxo anterior ao corte para o painel).
// LOJA_URL (opcional): endereço da loja, para onde o botão dos cartões da seção Loja aponta (campo `destino`).
// Sem ela o botão continua levando a #baixar. Não é segredo.
// BLOB_PUBLIC_HOST (opcional): host do store Blob da loja (ex.: <id>.public.blob.vercel-storage.com). Sem ele só `img/...` é aceito como imagem.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const raiz = new URL('.', import.meta.url);
const ler = nome => JSON.parse(readFileSync(new URL(`conteudo/${nome}.json`, raiz), 'utf8'));
const dadosLocais = () => ({ textos: ler('textos'), loja: ler('loja'), explore: ler('explore'), novidades: ler('novidades'), planos: ler('planos') });

export function urlSegura(v, nome) {
  const u = new URL(v);
  if (!(u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname)))) throw new Error(`${nome} deve ser https (http só para localhost)`);
  return u;
}
async function dadosDaLoja(url) {
  const res = await fetch(urlSegura(url, 'CONTEUDO_URL'), { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (res.status !== 200) throw new Error(`CONTEUDO_URL respondeu ${res.status}`);
  return await res.json();
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function erro(msg) { throw new Error(`conteudo inválido: ${msg}`); }
function texto(v, onde) { if (typeof v !== 'string' || !v.trim()) erro(`${onde} está vazio`); return esc(v.trim()); }
function lista(v, onde) { if (!Array.isArray(v) || !v.length) erro(`${onde} precisa de pelo menos um item`); return v; }
// Imagens: versionadas no site ("img/..."; o painel antigo gravava "/img/..." e a página usa caminho relativo) ou
// enviadas pelo painel ao Vercel Blob público (https, exatamente o host de BLOB_PUBLIC_HOST, pasta conteudo/).
const IMG_SITE = /^img\/[\w\-./]+\.(webp|jpe?g|png|avif|gif|svg)$/i;
const HOST_BLOB = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/; // formato do host; o valor aceito vem de BLOB_PUBLIC_HOST
const IMG_BLOB = /^\/conteudo\/[\w\-./]+\.(webp|jpe?g|png)$/i;
function imagemDe(v, onde, blobHost) {
  const p = String(v ?? '').replace(/^\//, '');
  if (IMG_SITE.test(p) && !p.includes('..')) return esc(p);
  try {
    const u = new URL(String(v));
    if (blobHost && HOST_BLOB.test(blobHost) && u.protocol === 'https:' && u.hostname === blobHost && !u.port && !u.username && !u.search && !u.hash && IMG_BLOB.test(u.pathname) && !u.pathname.includes('..') && u.href === v) return esc(v);
  } catch { /* cai no erro abaixo */ }
  return erro(`${onde}: imagem "${v}" fora de img/ e do host do Blob configurado`);
}
// Destino do botão dos cartões da Loja: "inicio" (página inicial da loja) ou "categoria/<slug>".
// Sem `destino` (conteúdo antigo) ou sem LOJA_URL, o botão leva a #baixar, como antes.
function destino(v, lojaUrl, onde) {
  if (v === undefined || v === null || v === '') return '#baixar';
  if (v !== 'inicio' && !/^categoria\/[a-z0-9-]+$/.test(String(v))) erro(`${onde}: destino "${v}" inválido`);
  if (!lojaUrl) return '#baixar';
  return esc(v === 'inicio' ? lojaUrl : `${lojaUrl}/${v}`);
}
const seta = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
const LINKS = ['#videos', '#premium', '#bonus', '#historia', '#explore', '#loja', '#baixar', '#novidades'];

/** Remonta os trechos `<!--cms:...-->` de `html` com `dados` ({textos, loja, explore, novidades, planos}). Lança se o conteúdo for inválido. */
export function montar(html, dados, { lojaUrl = '', blobHost = '' } = {}) {
  const imagem = (v, onde) => imagemDe(v, onde, blobHost.toLowerCase());
  const desconto = () => { const d = dados.planos.desconto_anual; if (typeof d !== 'number' || d < 0 || d >= 100) erro('desconto anual inválido'); return d; };

  const blocos = {
    'textos.bonus.itens': () => lista(dados.textos.bonus.itens, 'bônus: itens').map((t, i) => `<li>${texto(t, `bônus: item ${i + 1}`)}</li>`).join(''),

    'loja.produtos': () => lista(dados.loja.produtos, 'loja: produtos').map((p, i) => {
      const o = `loja: produto ${i + 1}`;
      return `<a class="produto" href="${destino(p.destino, lojaUrl, o)}" data-revela-card><span class="foto"><img src="${imagem(p.foto, o)}" alt="${esc(p.alt ?? '')}" loading="lazy"></span>`
        + `<span class="info"><h3>${texto(p.nome, `${o}, nome`)}</h3><p>${texto(p.descricao, `${o}, descrição`)}</p><span class="ir">${texto(p.botao, `${o}, botão`)}</span></span></a>`;
    }).join('\n      '),

    'explore.cartoes': () => {
      const c = lista(dados.explore.cartoes, 'explore: cartões');
      return c.map((k, i) => {
        const o = `explore: cartão ${i + 1}`;
        if (!LINKS.includes(k.link)) erro(`${o}: link "${k.link}" não é uma seção da página`);
        const pos = /^\d{1,3}% \d{1,3}%$/.test(k.posicao ?? '') ? ` style="object-position:${k.posicao}"` : '';
        return `<li role="group" aria-roledescription="slide" aria-label="${i + 1} de ${c.length}"><a class="cartao" href="${k.link}" data-revela-card>`
          + `<img${k.inteira ? ' class="contida"' : ''} src="${imagem(k.imagem, o)}" alt="" loading="lazy"${k.inteira ? '' : pos}>`
          + `<span class="info"><h3>${texto(k.titulo, `${o}, título`)}</h3><p>${texto(k.texto, `${o}, texto`)}</p><span class="ir">Ver mais ${seta}</span></span></a></li>`;
      }).join('\n        ');
    },

    'novidades.noticias': () => {
      const n = lista(dados.novidades.noticias, 'novidades: notícias');
      return n.map((k, i) => {
        const o = `novidades: notícia ${i + 1}`;
        return `<li role="group" aria-roledescription="slide" aria-label="${i + 1} de ${n.length}"><article class="noticia" data-revela-card>`
          + `<div class="foto"><img src="${imagem(k.imagem, o)}" alt="" loading="lazy"></div><div class="info"><time>${texto(k.data, `${o}, data`)}</time><h3>${texto(k.titulo, `${o}, título`)}</h3></div></article></li>`;
      }).join('\n        ');
    },

    'planos.economia': () => `-${desconto()}%`,

    // os planos continuam montados pelo script da página (carrossel e troca mensal/anual); aqui só vão os dados
    'planos.dados': () => {
      const planos = lista(dados.planos.planos, 'planos').map((p, i) => {
        const o = `plano ${i + 1}`;
        if (typeof p.mensal !== 'number' || p.mensal < 0) erro(`${o}: preço mensal inválido`);
        return { id: `p${i + 1}`, nome: texto(p.nome, `${o}, nome`), mensal: p.mensal, texto: texto(p.texto, `${o}, texto`), cta: texto(p.botao, `${o}, botão`),
          capa: imagem(p.capa, o), destaque: p.selo ? esc(p.selo) : '', itens: lista(p.itens, `${o}, itens`).map((t, k) => texto(t, `${o}, item ${k + 1}`)) };
      });
      const json = JSON.stringify({ desconto: desconto() / 100, planos }).replace(/</g, '\\u003c');
      return `<script type="application/json" id="dados-planos">${json}</script>`;
    },
  };

  // chave sem bloco próprio = texto simples, ex.: textos.hero.frase, loja.titulo1, planos.nota
  const valor = chave => {
    if (blocos[chave]) return blocos[chave]();
    return texto(chave.split('.').reduce((o, k) => o?.[k], dados), chave);
  };

  const usadas = new Set();
  const novo = html.replace(/<!--cms:([\w.]+)-->[\s\S]*?<!--\/cms:\1-->/g, (_, chave) => { usadas.add(chave); return `<!--cms:${chave}-->${valor(chave)}<!--/cms:${chave}-->`; });
  if (!usadas.size) erro('nenhum marcador <!--cms:...--> encontrado no index.html');
  return { html: novo, trechos: usadas.size };
}

// Só roda como comando (`node build.mjs`); importar o módulo (teste de contrato) não escreve nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dados = process.env.CONTEUDO_URL ? await dadosDaLoja(process.env.CONTEUDO_URL) : dadosLocais();
  const lojaUrl = process.env.LOJA_URL ? urlSegura(process.env.LOJA_URL, 'LOJA_URL').href.replace(/\/$/, '') : '';
  const arq = new URL('index.html', raiz);
  const { html, trechos } = montar(readFileSync(arq, 'utf8'), dados, { lojaUrl, blobHost: process.env.BLOB_PUBLIC_HOST ?? '' });
  writeFileSync(arq, html);
  console.log(`index.html atualizado (${trechos} trechos, conteúdo de ${process.env.CONTEUDO_URL ? 'CONTEUDO_URL' : 'conteudo/*.json'}).`);
}
