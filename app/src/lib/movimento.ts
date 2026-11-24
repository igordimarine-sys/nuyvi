import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { MOV, celular, leve } from './ambiente';
import { tocar, type Video } from './midia';
import { atualizarFibras, definirGatilhosFibras } from './fibras';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });
// rolagem suave atual (só no computador com mouse); o botão "voltar ao topo" usa
let rolagemSuave: Lenis | null = null;
export function voltarAoTopo() {
  if (rolagemSuave) rolagemSuave.scrollTo(0, { duration: 1.6 });
  else scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  document.querySelector<HTMLElement>('.marca')?.focus({ preventScroll: true });
}

/*
 * Todas as animações da página, na mesma ordem da versão estática (a ordem de criação dos gatilhos
 * importa para os pins e para o refresh). Roda dentro de um useGSAP; devolve a limpeza do que
 * o contexto do GSAP não desfaz sozinho (ouvintes de janela e observadores).
 */
export function iniciarMovimento(): () => void {
  const limpezas: Array<() => void> = [];
  const ouvir = <K extends keyof WindowEventMap>(alvo: Window, tipo: K, fn: (e: WindowEventMap[K]) => void) => { alvo.addEventListener(tipo, fn); limpezas.push(() => alvo.removeEventListener(tipo, fn)); };

  // as fibras só rodam nas seções sem vídeo de tela cheia
  definirGatilhosFibras([...document.querySelectorAll('main .secao, footer')].filter(s => !(celular && s.id === 'videos')).map(s => ScrollTrigger.create({ trigger: s, start: 'top bottom', end: 'bottom top',
    onToggle: atualizarFibras, onRefresh: atualizarFibras })));
  atualizarFibras();
  limpezas.push(() => definirGatilhosFibras([]));

  // Cabeçalho: some ao rolar para baixo, volta ao rolar para cima, perto do topo e na última seção
  const topo = document.querySelector('.topo'), ultima = document.querySelector('#novidades');
  if (topo) {
    const voltar = document.querySelector('[data-voltar-topo]');
    const marcaUltima = ultima && ScrollTrigger.create({ trigger: ultima, start: 'top 75%',
      onEnter: () => voltar?.classList.add('visivel'), onLeaveBack: () => voltar?.classList.remove('visivel') });
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: st => {
      const y = st.scroll(), v = st.getVelocity();
      if (y < 120 || (marcaUltima && y >= marcaUltima.start)) topo.classList.remove('recolhido');
      else if (v > 40) topo.classList.add('recolhido');
      else if (v < -40) topo.classList.remove('recolhido');
    } });
  }
  gsap.defaults({ ease: MOV.entra, duration: MOV.base });

  // Fundo muda de cor de seção em seção
  document.querySelectorAll<HTMLElement>('[data-cor]').forEach(s => ScrollTrigger.create({
    trigger: s, start: 'top 55%', end: 'bottom 55%',
    onToggle: st => { if (st.isActive) document.body.style.setProperty('--fundo', s.dataset.cor!); },
  }));

  const mm = gsap.matchMedia();
  limpezas.push(() => mm.revert());

  // Rolagem suave só no computador com mouse
  mm.add('(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
    const lenis = new Lenis({ lerp: .1, anchors: true });
    rolagemSuave = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tique = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tique); gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tique); gsap.ticker.lagSmoothing(500, 33); lenis.destroy(); rolagemSuave = null; };
  });

  mm.add({ move: '(prefers-reduced-motion: no-preference)', calmo: '(prefers-reduced-motion: reduce)' }, ctx => {
    const { move } = ctx.conditions as { move: boolean };

    // Abertura em palco parado: a tela fica fixa e a rolagem só move os elementos em profundidade.
    // O logo vem em direção à câmera, o vídeo dos atletas se afasta, o ciclismo surge de dentro e a frase chega.
    // Com 'reduzir movimento' a mesma sequência acontece só com troca de opacidade, sem zoom.
    const vAtletas = document.querySelector<Video>('[data-video-abertura="atletas"]'), vCiclismo = document.querySelector<Video>('[data-video-abertura="ciclismo"]');
    let naAbertura = true;
    const videosAbertura = (p: number) => {
      if (vAtletas) { vAtletas._visivel = naAbertura && p < .55; tocar(vAtletas); }
      if (vCiclismo) { vCiclismo._visivel = naAbertura && p > .22; tocar(vCiclismo); }
    };
    const palco = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.abertura', start: 'top top', end: 'bottom bottom', scrub: move ? .6 : true,
      onUpdate: st => videosAbertura(st.progress) } });
    // os vídeos da abertura tocam enquanto qualquer parte dela está na tela
    ScrollTrigger.create({ trigger: '.abertura', start: 'top bottom', end: 'bottom top',
      onToggle: st => { naAbertura = st.isActive; videosAbertura(palco.scrollTrigger!.progress); } });
    videosAbertura(0);
    palco.fromTo('.hero [data-hero-item]', { autoAlpha: 1 }, { autoAlpha: 0, duration: .12, ease: MOV.sai, immediateRender: false }, 0);
    if (move) {
      palco.to('#hero-titulo', { scale: 8, duration: .5, ease: 'power2.in' }, 0)
        .to('#hero-titulo', { autoAlpha: 0, duration: .12 }, .38)
        .fromTo('.hero-midia', { scale: 1 }, { scale: 1.35, duration: .5, ease: 'power1.in' }, 0)
        .to('.hero-midia', { autoAlpha: 0, duration: .2 }, .3)
        .fromTo('[data-rede-fundo]', { autoAlpha: 0, scale: 1.7 }, { autoAlpha: 1, scale: 1, duration: .45, ease: 'power2.out' }, .3)
        .fromTo('[data-rede-frase]', { autoAlpha: 0, scale: .72 }, { autoAlpha: 1, scale: 1, duration: .2, ease: MOV.entra }, .62);
    } else {
      palco.to('#hero-titulo', { autoAlpha: 0, duration: .15 }, .2)
        .to('.hero-midia', { autoAlpha: 0, duration: .15 }, .3)
        .fromTo('[data-rede-fundo]', { autoAlpha: 0 }, { autoAlpha: 1, duration: .15 }, .3)
        .fromTo('[data-rede-frase]', { autoAlpha: 0 }, { autoAlpha: 1, duration: .15 }, .6);
    }
    palco.to({}, { duration: .15 }, .85); // segura a frase um pouco antes de liberar a página

    // Títulos: cada linha sobe por trás de uma máscara (com 'reduzir movimento', só aparece)
    document.querySelectorAll('[data-titulo]').forEach(t => {
      const linhas = t.querySelectorAll('.t-linha > span');
      const de = move ? { yPercent: 110 } : { opacity: 0 }, para = move ? { yPercent: 0 } : { opacity: 1 };
      gsap.fromTo(linhas, de, { ...para, duration: MOV.grande, stagger: MOV.linha, ease: MOV.entra,
        scrollTrigger: { trigger: t, start: 'top 88%', once: true } });
    });

    if (!move) return; // com 'reduzir movimento' os cartões e imagens já ficam no lugar

    // Cartões entram em sequência
    gsap.set('[data-revela-card]', { autoAlpha: 0, y: MOV.desloca });
    ScrollTrigger.batch('[data-revela-card]', { start: 'top 92%', once: true,
      onEnter: b => { gsap.to(b, { autoAlpha: 1, y: 0, duration: MOV.grande, stagger: MOV.linha, ease: MOV.entra }); } });

    // Abertura: o logo assenta e os textos sobem; ao rolar, tudo se afasta
    gsap.timeline({ defaults: { ease: MOV.entra } })
      .from('[data-hero-logo]', { opacity: .01, scale: 1.12, duration: MOV.grande * 2 }, .1)
      .from('[data-hero-item]', { autoAlpha: 0, y: MOV.desloca, duration: MOV.grande, stagger: MOV.linha }, .7);
    // No celular e tablet param aqui: ficam a abertura, os títulos e a entrada dos cartões.
    // Cortina das imagens, zoom, paralaxe e o zoom do vôlei redesenham a tela a cada movimento do dedo e pesavam na rolagem.
    if (leve) {
      gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.historia', start: 'top top', end: 'bottom bottom', scrub: .6 } })
        .from('[data-hist-texto] .rotulo', { autoAlpha: 0, duration: .2 }, .05)
        .from('[data-hist-texto] .t-linha > span', { yPercent: 110, duration: .3, stagger: .1, ease: MOV.entra }, .1)
        .from('[data-hist-texto] .texto', { autoAlpha: 0, duration: .25 }, .4)
        .to({}, { duration: .2 });
      return;
    }
    // Imagens grandes: abrem como uma cortina e o zoom assenta
    document.querySelectorAll('[data-revela-img]').forEach(m => {
      gsap.fromTo(m, { clipPath: 'inset(12% 8% 12% 8% round 1.25rem)' }, { clipPath: 'inset(0% 0% 0% 0% round 1.25rem)', ease: 'none',
        scrollTrigger: { trigger: m, start: 'top 95%', end: 'top 35%', scrub: .6 } });
      const z = m.querySelector('[data-zoom]');
      if (z) gsap.fromTo(z, { scale: 1.3 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // Paralaxe na faixa "Baixe agora"
    gsap.fromTo('[data-paralaxe]', { yPercent: -6, scale: 1.2 }, { yPercent: 6, scale: 1.2, ease: 'none',
      scrollTrigger: { trigger: '.faixa', start: 'top bottom', end: 'bottom top', scrub: true } });

    // História presa na tela: a imagem se aproxima e o texto sobe linha por linha
    const th = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.historia', start: 'top top', end: 'bottom bottom', scrub: .6 } });
    th.fromTo('[data-hist-img]', { scale: 1.35 }, { scale: 1, duration: 1 }, 0)
      .from('[data-hist-texto] .rotulo', { autoAlpha: 0, y: MOV.desloca, duration: .2, ease: MOV.entra }, .05)
      .from('[data-hist-texto] .t-linha > span', { yPercent: 110, duration: .3, stagger: .1, ease: MOV.entra }, .1)
      .from('[data-hist-texto] .texto', { autoAlpha: 0, y: MOV.desloca, duration: .25, ease: MOV.entra }, .4)
      .to({}, { duration: .2 });
  });

  // Palco entre todas as seções, no mesmo idioma da abertura: a tela para, a seção que sai vem em
  // direção à câmera e some, e a próxima surge do fundo no mesmo lugar (a rolagem não desce a página).
  // Computador: a seção que sai fica presa (pin) e a próxima é compensada (y) para ficar parada.
  // Toque: rolagem normal, sem animar a seção inteira. 'Reduzir movimento': rolagem normal.
  mm.add({ mesa: '(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)', move: '(prefers-reduced-motion: no-preference)' }, ctx => {
    const { mesa, move } = ctx.conditions as { mesa: boolean; move: boolean };
    if (!move || !mesa) return;
    const cenas = [...document.querySelectorAll<HTMLElement>('main .cena')];
    const entra = (c: HTMLElement) => c.firstElementChild as HTMLElement;   // camada que chega (compensação e profundidade)
    const secao = (c: HTMLElement) => entra(c).firstElementChild as HTMLElement;
    const sai = (c: HTMLElement) => secao(c).querySelector<HTMLElement>(':scope > .hero, :scope > .palco') || secao(c); // seções com palco próprio saem só pelo palco
    const mexidos = cenas.flatMap(c => [entra(c), sai(c)]);
    // antes de medir posições, tira os deslocamentos (senão os gatilhos de dentro das seções seriam medidos fora do lugar)
    const limpar = () => { gsap.set(mexidos, { clearProps: 'transform,opacity,visibility' }); };
    const linhas: gsap.core.Timeline[] = [];
    // depois de medir, redesenha cada troca no ponto certo (cada elemento pertence a uma única troca, então a ordem não importa)
    // (passa por 1 e 0 antes de voltar a p: se p já for 1 ou 0, o GSAP não redesenharia, e as seções que já
    //  saíram voltariam a aparecer por cima da seguinte depois do 'limpar')
    const redesenhar = () => linhas.forEach(t => { const p = t.scrollTrigger ? t.scrollTrigger.progress : 0; t.progress(1, true).progress(0, true).progress(p, true); });
    ScrollTrigger.addEventListener('refreshInit', limpar);
    ScrollTrigger.addEventListener('refresh', redesenhar);

    cenas.forEach((cC, i) => {
      if (i === 0) return;
      const cA = cenas[i - 1], eC = entra(cC), sA = sai(cA);
      // pausa curta antes da troca quando a seção que sai não teve rolagem própria (cabe numa tela só)
      const pausa = (cA.offsetHeight - innerHeight) < innerHeight * .4 ? .28 : .06, resto = 1 - pausa;
      const origemA = () => sA === secao(cA) ? `50% ${sA.offsetHeight - innerHeight / 2}px` : '50% 50%';
      const origemC = () => `50% ${innerHeight / 2}px`;
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: cA, start: 'bottom bottom', end: () => '+=' + innerHeight,
        pin: true, pinSpacing: false, scrub: true, invalidateOnRefresh: true } });
      tl.fromTo(eC, { y: () => -innerHeight }, { y: 0, duration: 1 }, 0)
        .fromTo(sA, { scale: 1, autoAlpha: 1, transformOrigin: origemA }, { scale: 1.2, autoAlpha: 0, transformOrigin: origemA, duration: resto * .44, ease: 'power2.in' }, pausa)
        .fromTo(eC, { scale: .86, autoAlpha: 0, transformOrigin: origemC }, { scale: 1, autoAlpha: 1, transformOrigin: origemC, duration: resto * .5, ease: 'power2.out' }, pausa + resto * .5);
      linhas.push(tl);
    });
    ScrollTrigger.refresh();
    return () => { ScrollTrigger.removeEventListener('refreshInit', limpar); ScrollTrigger.removeEventListener('refresh', redesenhar); limpar(); };
  });

  // Recalcula depois das fontes e imagens
  const remedir = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(remedir);
  if (document.readyState === 'complete') remedir(); else ouvir(window, 'load', remedir);
  // ao voltar para a página (botão Voltar com cache do navegador, ou retorno à aba), remede as trocas
  ouvir(window, 'pageshow', e => { if (e.persisted) remedir(); });
  const aoVoltarAba = () => { if (!document.hidden) remedir(); };
  document.addEventListener('visibilitychange', aoVoltarAba);
  limpezas.push(() => document.removeEventListener('visibilitychange', aoVoltarAba));
  // Sempre que uma seção muda de tamanho (janela redimensionada, título que se reajusta, mídia que carrega),
  // remede as trocas presas; sem isso as seções se sobrepõem até recarregar a página.
  if ('ResizeObserver' in window) {
    const medidas = new WeakMap<Element, string>(); let espera = 0;
    const ro = new ResizeObserver(es => {
      const mudou = es.some(e => { const t = e.target as HTMLElement, m = t.offsetWidth + 'x' + t.offsetHeight, ant = medidas.get(t); medidas.set(t, m); return ant !== undefined && ant !== m; });
      if (mudou) { clearTimeout(espera); espera = window.setTimeout(remedir, 180); }
    });
    document.querySelectorAll('main .secao, footer').forEach(s => ro.observe(s));
    limpezas.push(() => { ro.disconnect(); clearTimeout(espera); });
  }

  return () => limpezas.reverse().forEach(f => f());
}
