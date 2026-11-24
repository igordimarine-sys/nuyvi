import { celular, fraco } from './ambiente';
import { assinarPausa, estaParado } from './midia';

/*
 * Fundo de fibras em laranja e ciano da marca; mais leve no celular.
 * As fibras só rodam nas seções sem vídeo de tela cheia; fora delas somem (em vez de ficarem congeladas).
 * O código da biblioteca é carregado depois da primeira pintura, para não pesar na abertura.
 */
type Gatilho = { isActive: boolean };
let fx: GhostFibersFx | null = null;
let caixa: HTMLElement | null = null;
let gatilhos: Gatilho[] = [];

export function definirGatilhosFibras(g: Gatilho[]) { gatilhos = g; }

export function atualizarFibras() {
  if (!fx || !caixa) return;
  const parado = estaParado();
  const ativo = !parado && (!gatilhos.length || gatilhos.some(t => t.isActive));
  fx.set({ paused: !ativo, mouseInteraction: ativo && !celular });
  caixa.classList.toggle('apagada', !ativo && !parado);
}

// o botão de pausa também liga e desliga as fibras
assinarPausa(atualizarFibras);

export async function iniciarFibras(el: HTMLElement) {
  if (fraco || !('WebGL2RenderingContext' in window)) return () => {};
  await import('./ghost-fibers.js');
  if (!window.GhostFibers) return () => {};
  caixa = el;
  // desenho em resolução reduzida e a 30 quadros por segundo (o brilho é suave, a diferença não aparece)
  fx = window.GhostFibers(el, {
    glowColor: '#FF7A2E', secondaryColor: '#2EC8E8', lineColor: '#FFB25E', gradient: 'along', layers: 3,
    threads: celular ? 36 : 60, density: celular ? .7 : .8, particles: .35, sparkle: .4, thickness: 1.5, foldGlow: 1.4,
    speed: .35, flow: .3, glow: 1.1, brightness: 1.7, vignette: .4, grain: 0,
    mouseInteraction: !celular, hoverEffect: 'focus', pulseOnClick: false, dpr: celular ? .75 : 1, maxFps: 30, paused: true,
  });
  atualizarFibras();
  return () => { fx?.destroy(); fx = null; caixa = null; };
}
