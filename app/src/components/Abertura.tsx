import type { CSSProperties } from 'react';
import { LinkLogin } from './ui';

// vídeo dos atletas: arquivo mais leve no celular (escolhido ao abrir a página, como na versão estática)
const srcAtletas = matchMedia('(max-width: 767px)').matches ? '/video/atletas-laranja-cel-v2.mp4' : '/video/atletas-laranja-v2.mp4';

/* 1. Abertura: palco parado. A rolagem não desce a página, só move os elementos (zoom em profundidade). */
export default function Abertura() {
  return (
    <section className="abertura relative h-[330vh] max-md:h-[260vh]" id="topo" aria-labelledby="hero-titulo" data-cor="#07090A">
      <div className="hero sticky top-0 isolate grid h-svh [place-items:end_center] overflow-hidden px-lado pt-24 pb-12 text-center">
        <div className="hero-midia absolute inset-0 -z-2" aria-hidden="true">
          <video className="size-full object-cover" poster="/img/vi/atletas-poster.webp" muted loop playsInline preload="none" data-auto data-video-abertura="atletas" src={srcAtletas} data-deriva="19s" style={{ '--deriva': '19s' } as CSSProperties} />
        </div>
        <div className="rede-fundo invisible absolute inset-0 -z-2 opacity-0 will-change-[transform,opacity]" aria-hidden="true" data-rede-fundo>
          <video className="size-full object-cover" data-deriva="23s" style={{ '--deriva': '23s' } as CSSProperties} src="/video/esportes/ciclismo.mp4" poster="/img/esportes/ciclismo-poster.webp" muted loop playsInline preload="none" disablePictureInPicture data-video-abertura="ciclismo" />
        </div>
        <div className="will-change-[transform,opacity]">
          <h1 id="hero-titulo" className="will-change-transform"><span className="sr-only">NUY</span><img className="mx-auto mb-8 w-[min(78vw,560px)]" src="/img/logo-hero.webp" alt="" width="800" height="328" data-hero-logo /></h1>
          <p className="font-display text-hero-data font-black tracking-[.02em] text-laranja uppercase font-stretch-[125%]" data-hero-item>Treine junto. Evolua conectado.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3" data-hero-item>
            <LinkLogin className="bt bt-claro"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 2.5h5.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6M2.5 8h7M7 5l3 3-3 3" /></svg> Entrar na NUY</LinkLogin>
            <a className="bt bt-linha" href="#baixar">Baixar o app</a>
          </div>
          <p className="mt-4 text-[.8rem] tracking-[.08em] text-nevoa uppercase" data-hero-item>Disponível para iOS e Android</p>
          <a className="rolar mt-9 inline-flex flex-col items-center gap-[.4rem] text-[.75rem] tracking-[.14em] text-nevoa uppercase no-underline" href="#videos" data-hero-item>Role para ver mais <i aria-hidden="true"></i></a>
        </div>
        <div className="invisible pointer-events-none absolute inset-0 z-1 grid place-content-center px-lado text-center opacity-0 will-change-[transform,opacity]" data-rede-frase>
          <h2 id="rede-titulo" className="text-rede"><span className="sol">Uma rede inteira</span><br />de parceiros.</h2>
          <p className="mx-auto mt-4 max-w-[34rem] text-nevoa-clara">Corrida, pedal, quadra, campo. Quem treina perto de você está a um toque.</p>
        </div>
      </div>
    </section>
  );
}
