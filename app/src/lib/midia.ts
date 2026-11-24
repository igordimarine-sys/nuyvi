import { reduz } from './ambiente';

/*
 * Pausa das animações e controle dos vídeos (porte direto do script da versão estática).
 * - "parado" vale para a página toda, fica salvo no navegador e marca o <html> com a classe .parado
 * - cada vídeo de fundo baixa com uma tela de antecedência e só toca enquanto está de fato na tela
 * - os vídeos começam um de cada vez (nunca vários no mesmo quadro), para a rolagem não engasgar
 */
export type Video = HTMLVideoElement & { _visivel?: boolean; _carregado?: boolean; _naFila?: boolean };

// com 'reduzir movimento' o vídeo de fundo começa parado (a pessoa pode ligar no botão)
let parado = reduz;
try { const g = localStorage.getItem('nuyvi-parado'); if (g !== null) parado = g === '1'; } catch { /* sem armazenamento */ }

const ouvintes = new Set<() => void>();
const fundos = new Set<Video>();

export const estaParado = () => parado;
export function assinarPausa(fn: () => void) { ouvintes.add(fn); return () => { ouvintes.delete(fn); }; }

export function carregar(v: Video) {
  if (v._carregado) return; v._carregado = true;
  if (v.preload !== 'auto') { v.preload = 'auto'; if (v.readyState === 0 && v.paused && v.getAttribute('src')) v.load(); }
}

let filaPlay = 0;
export function tocar(v: Video) {
  if (!parado && v._visivel) {
    carregar(v); if (!v.paused || v._naFila) return;
    const agora = performance.now(); filaPlay = Math.max(filaPlay + 140, agora); v._naFila = true;
    setTimeout(() => { v._naFila = false; if (parado || !v._visivel) return; const pr = v.play(); if (pr) pr.catch(() => {}); }, filaPlay - agora);
  } else if (!v.paused) v.pause();
}

function aplicarPausa() {
  document.documentElement.classList.toggle('parado', parado);
  fundos.forEach(tocar);
  ouvintes.forEach(fn => fn());
}

export function alternarPausa() {
  parado = !parado;
  try { localStorage.setItem('nuyvi-parado', parado ? '1' : '0'); } catch { /* sem armazenamento */ }
  aplicarPausa();
}

// observadores compartilhados por todos os vídeos de fundo fora da abertura
const temIO = 'IntersectionObserver' in window;
const antes = temIO ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { carregar(e.target as Video); antes!.unobserve(e.target); } }), { rootMargin: '120% 0px' }) : null;
const naTela = temIO ? new IntersectionObserver(es => es.forEach(e => { const v = e.target as Video; v._visivel = e.isIntersecting; tocar(v); }), { rootMargin: '8% 0px' }) : null;

/** Registra um vídeo de fundo (data-fundo-video). Os da abertura têm controle próprio e não passam por aqui. */
export function registrarFundo(v: Video) {
  fundos.add(v);
  if (antes && naTela) { antes.observe(v); naTela.observe(v); } else v._visivel = true;
  tocar(v);
  return () => { fundos.delete(v); antes?.unobserve(v); naTela?.unobserve(v); };
}

// estado inicial da página
document.documentElement.classList.toggle('parado', parado);
