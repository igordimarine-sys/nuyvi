import { useLayoutEffect, type RefObject } from 'react';

/*
 * Carrossel genérico (vídeos, planos, explore e novidades): setas, pontos e arrastar/deslizar nativo.
 * Porte direto da função carrossel() da versão estática; age sobre a seção inteira:
 *   [data-car-trilho] a lista que rola, [data-car-ant]/[data-car-prox] as setas, .pontos os indicadores.
 * Usa useLayoutEffect para medir antes do GSAP (que também roda antes da pintura), como na ordem original.
 */
export function useCarrossel(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const secao = ref.current; if (!secao) return;
    const tr = secao.querySelector<HTMLElement>('[data-car-trilho]'); if (!tr) return;
    const itens = [...tr.children] as HTMLElement[];
    const ant = secao.querySelector<HTMLButtonElement>('[data-car-ant]'), prox = secao.querySelector<HTMLButtonElement>('[data-car-prox]');
    const pts = secao.querySelector<HTMLElement>('[data-car-pontos]');
    const passo = () => (itens[1]?.offsetLeft ?? 0) - (itens[0]?.offsetLeft ?? 0);
    function estado() {
      const max = tr!.scrollWidth - tr!.clientWidth - 2, fim = tr!.scrollLeft >= max;
      secao!.classList.toggle('car-cabe', max <= 0);
      if (ant) ant.disabled = tr!.scrollLeft <= 2;
      if (prox) prox.disabled = fim;
      const i = fim ? itens.length - 1 : Math.min(itens.length - 1, Math.round(tr!.scrollLeft / (passo() || 1)));
      if (pts) [...pts.children].forEach((s, k) => s.classList.toggle('atual', k === i));
    }
    const timers: number[] = [];
    const depois = () => { timers.push(window.setTimeout(estado, 120), window.setTimeout(estado, 600)); };
    const voltar = () => { tr.scrollBy({ left: -passo() }); depois(); };
    const avancar = () => { tr.scrollBy({ left: passo() }); depois(); };
    ant?.addEventListener('click', voltar);
    prox?.addEventListener('click', avancar);
    tr.addEventListener('scroll', estado, { passive: true });
    tr.addEventListener('scrollend', estado);
    addEventListener('resize', estado);
    estado();
    return () => {
      ant?.removeEventListener('click', voltar); prox?.removeEventListener('click', avancar);
      tr.removeEventListener('scroll', estado); tr.removeEventListener('scrollend', estado);
      removeEventListener('resize', estado); timers.forEach(clearTimeout);
    };
  }, [ref]);
}
