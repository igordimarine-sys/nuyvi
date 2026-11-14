// Gera as partes editáveis do index.html a partir de conteudo/*.json (editados pelo painel /admin).
// Sem dependências: `node build.mjs`. Reescreve só os trechos entre <!--cms:CHAVE--> e <!--/cms:CHAVE-->,
// então o index.html continua sendo uma página pronta e o comando pode rodar quantas vezes quiser.
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('.', import.meta.url);
const ler = nome => JSON.parse(readFileSync(new URL(`conteudo/${nome}.json`, raiz), 'utf8'));
const dados = { textos: ler('textos'), loja: ler('loja'), explore: ler('explore'), novidades: ler('novidades'), planos: ler('planos') };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function erro(msg) { throw new Error(`conteudo inválido: ${msg}`); }
function texto(v, onde) { if (typeof v !== 'string' || !v.trim()) erro(`${onde} está vazio`); return esc(v.trim()); }
function lista(v, onde) { if (!Array.isArray(v) || !v.length) erro(`${onde} precisa de pelo menos um item`); return v; }
// imagens só do próprio site (o painel grava "/img/conteudo/x.webp"; a página usa caminho relativo)
function imagem(v, onde) {
  const p = String(v ?? '').replace(/^\//, '');
  if (!/^img\/[\w\-./]+\.(webp|jpe?g|png|avif|gif|svg)$/i.test(p) || p.includes('..')) erro(`${onde}: imagem "${v}" fora de img/`);
  return esc(p);
}
const seta = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
const LINKS = ['#videos', '#premium', '#bonus', '#historia', '#explore', '#loja', '#baixar', '#novidades'];

const blocos = {
  'textos.bonus.itens': () => lista(dados.textos.bonus.itens, 'bônus: itens').map((t, i) => `<li>${texto(t, `bônus: item ${i + 1}`)}</li>`).join(''),

  'loja.produtos': () => lista(dados.loja.produtos, 'loja: produtos').map((p, i) => {
    const o = `loja: produto ${i + 1}`;
    return `<a class="produto" href="#baixar" data-revela-card><span class="foto"><img src="${imagem(p.foto, o)}" alt="${esc(p.alt ?? '')}" loading="lazy"></span>`
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
function desconto() { const d = dados.planos.desconto_anual; if (typeof d !== 'number' || d < 0 || d >= 100) erro('desconto anual inválido'); return d; }

// chave sem bloco próprio = texto simples, ex.: textos.hero.frase, loja.titulo1, planos.nota
function valor(chave) {
  if (blocos[chave]) return blocos[chave]();
  const v = chave.split('.').reduce((o, k) => o?.[k], dados);
  return texto(v, chave);
}

const arq = new URL('index.html', raiz);
const html = readFileSync(arq, 'utf8');
const usadas = new Set();
const novo = html.replace(/<!--cms:([\w.]+)-->[\s\S]*?<!--\/cms:\1-->/g, (_, chave) => { usadas.add(chave); return `<!--cms:${chave}-->${valor(chave)}<!--/cms:${chave}-->`; });
if (!usadas.size) erro('nenhum marcador <!--cms:...--> encontrado no index.html');
writeFileSync(arq, novo);
console.log(`index.html atualizado (${usadas.size} trechos).`);
