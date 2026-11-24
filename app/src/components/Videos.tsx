import { useLayoutEffect, useRef } from 'react';
import { useCarrossel } from '../hooks/useCarrossel';
import { Pontos, Setas, VideoFundo } from './ui';

const PALAVRAS = ['amigos', 'eventos', 'acessórios', 'dicas', 'saúde', 'diversão'];

/*
 * "Aqui você encontra [amigos/eventos/...]": a frase fixa ocupa a largura inteira da seção numa linha só
 * (a fonte é calculada pela largura) e a pílula com a palavra alternada fica centralizada logo abaixo.
 * A troca só roda com o título visível e sem a pausa ligada.
 */
function TrocaPalavras() {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const caixa = ref.current!;
    const fixo = caixa.querySelector<HTMLElement>('[data-troca-fixo]')!;
    const pilula = caixa.querySelector<HTMLElement>('[data-troca-pilula]')!;
    const palavras = [...pilula.children] as HTMLElement[], pontos = [...caixa.querySelector('[data-troca-pontos]')!.children];
    let i = 0, visivel = false, timer = 0;
    const saidas: number[] = [];
    // "Aqui você encontra" ocupa a largura inteira da seção, numa linha só
    const encaixar = () => { fixo.style.fontSize = ''; const base = parseFloat(getComputedStyle(fixo).fontSize); fixo.style.fontSize = (base * caixa.clientWidth / fixo.offsetWidth) + 'px'; };
    const largura = () => { encaixar(); const em = parseFloat(getComputedStyle(pilula).fontSize); pilula.style.width = (palavras[i].offsetWidth + em * .64) + 'px'; };
    function proxima() {
      const atual = palavras[i]; i = (i + 1) % palavras.length;
      atual.classList.remove('atual'); atual.classList.add('saindo');
      saidas.push(window.setTimeout(() => atual.classList.remove('saindo'), 600));
      palavras[i].classList.add('atual');
      pontos.forEach((p, k) => p.classList.toggle('atual', k === i));
      largura();
    }
    const rodar = () => { clearInterval(timer); timer = 0; if (visivel && !document.documentElement.classList.contains('parado')) timer = window.setInterval(proxima, 2200); };
    largura();
    document.fonts?.ready.then(largura);
    // a folha de fontes carrega sem bloquear a página: quando a fonte chega, remede
    document.fonts?.addEventListener?.('loadingdone', largura);
    // remede quando a largura do título muda de fato (o evento 'resize' pode chegar antes do layout novo)
    let larguraCaixa = 0, quadro = 0;
    const ro = new ResizeObserver(() => { if (caixa.clientWidth !== larguraCaixa) { larguraCaixa = caixa.clientWidth; quadro = requestAnimationFrame(largura); } });
    ro.observe(caixa);
    const io = new IntersectionObserver(es => { visivel = es[0].isIntersecting; rodar(); });
    io.observe(caixa);
    const mo = new MutationObserver(rodar);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      clearInterval(timer); saidas.forEach(clearTimeout); cancelAnimationFrame(quadro);
      ro.disconnect(); io.disconnect(); mo.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', largura);
      palavras.forEach((p, k) => { p.classList.remove('saindo'); p.classList.toggle('atual', k === 0); });
      pontos.forEach((p, k) => p.classList.toggle('atual', k === 0));
      fixo.style.fontSize = ''; pilula.style.width = '';
    };
  }, []);
  return (
    <h2 ref={ref} id="videos-titulo" className="troca" aria-label="Aqui você encontra amigos, eventos, acessórios, dicas, saúde e diversão" data-troca>
      <span className="troca-fixo" aria-hidden="true" data-troca-fixo>Aqui você encontra</span>
      <span className="troca-pilula" aria-hidden="true" data-troca-pilula>{PALAVRAS.map((p, k) => <span key={p} className={k === 0 ? 'troca-palavra atual' : 'troca-palavra'}>{p}</span>)}</span>
      <span className="troca-pontos" aria-hidden="true" data-troca-pontos>{PALAVRAS.map((p, k) => <i key={p} className={k === 0 ? 'atual' : undefined}></i>)}</span>
    </h2>
  );
}

const VIDEOS = [
  { forma: 'deitado', src: '/video/pordentro.mp4', poster: '/img/pordentro-poster.webp', w: 1280, h: 720, tipo: 'Por dentro do app', titulo: 'Veja por dentro' },
  { forma: 'vertical', src: '/video/avatar360.mp4', poster: '/img/avatar360-poster.webp', w: 540, h: 960, tipo: 'Performance', titulo: 'Avatar 3D' },
  { forma: 'vertical', src: '/video/videochamada.mp4', poster: '/img/vi/videochamada.webp', w: 480, h: 854, tipo: 'Premium', titulo: 'Especialistas por vídeo' },
];

/* 4. Vídeos: título "Aqui você encontra" e carrossel "Veja por dentro" */
export default function Videos() {
  const ref = useRef<HTMLElement>(null);
  useCarrossel(ref);
  return (
    <section ref={ref} className="secao" id="videos" aria-labelledby="videos-titulo" data-cor="#0d0a0c">
      <span className="rotulo">Vídeos</span>
      <TrocaPalavras />
      <div className="mt-10 flex items-center justify-between gap-4">
        <p className="m-0 text-[.8rem] font-bold tracking-[.16em] text-nevoa uppercase">Veja por dentro</p>
        <Setas alvo="videos-trilho" anterior="Vídeo anterior" proximo="Próximo vídeo" />
      </div>
      <div className="car car-videos" role="region" aria-roledescription="carrossel" aria-label="Vídeos do app">
        <ul className="car-trilho videos-trilho" id="videos-trilho" data-car-trilho>
          {VIDEOS.map((v, k) => (
            <li key={v.src} role="group" aria-roledescription="slide" aria-label={`${k + 1} de ${VIDEOS.length}`}>
              <div className={`video-card ${v.forma}`} data-revela-card>
                <VideoFundo src={v.src} poster={v.poster} aria-hidden="true" width={v.w} height={v.h} />
                <span className="absolute inset-x-5 bottom-5 z-1 flex items-end justify-between gap-4">
                  <span>
                    <span className="mb-[.35rem] block text-[.72rem] font-bold tracking-[.16em] text-laranja uppercase">{v.tipo}</span>
                    <span className="block font-display text-card-video leading-[.95] font-black uppercase font-stretch-[125%]">{v.titulo}</span>
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <Pontos total={VIDEOS.length} />
    </section>
  );
}
