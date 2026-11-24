import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type VideoHTMLAttributes } from 'react';
import { registrarFundo, type Video } from '../lib/midia';
import { LINKS_APP, LOGIN_URL } from '../lib/ambiente';

/* Setas do carrossel. aria-controls aponta para a lista que rola. */
export function Setas({ alvo, anterior, proximo }: { alvo: string; anterior: string; proximo: string }) {
  return (
    <div className="setas">
      <button type="button" className="seta" data-car-ant aria-controls={alvo}><span className="sr-only">{anterior}</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg></button>
      <button type="button" className="seta" data-car-prox aria-controls={alvo}><span className="sr-only">{proximo}</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg></button>
    </div>
  );
}

/* Pontos do carrossel (o estado "atual" é marcado pelo useCarrossel) */
export function Pontos({ total }: { total: number }) {
  return <div className="pontos" data-car-pontos aria-hidden="true">{Array.from({ length: total }, (_, k) => <span key={k} />)}</div>;
}

/* Título em linhas: cada linha sobe por trás de uma máscara. estilo: '' | 'vazado' | 'sol' */
export function Linhas({ linhas }: { linhas: Array<[string, '' | 'vazado' | 'sol']> }) {
  return <>{linhas.map(([texto, estilo], k) => <span key={k} className="t-linha"><span className={estilo || undefined}>{texto}</span></span>)}</>;
}

/* Vídeo de fundo: só toca quando está na tela (muted, playsinline, loop; baixa com uma tela de antecedência) */
export function VideoFundo({ deriva, style, ...props }: VideoHTMLAttributes<HTMLVideoElement> & { deriva?: string; 'data-zoom'?: boolean; 'data-paralaxe'?: boolean; 'data-hist-img'?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useLayoutEffect(() => registrarFundo(ref.current as Video), []);
  const estilo = deriva ? { ...style, '--deriva': deriva } as CSSProperties : style;
  return <video ref={ref} muted loop playsInline preload="none" disablePictureInPicture data-fundo-video data-deriva={deriva} style={estilo} {...props} />;
}

/* Link de login: enquanto não houver endereço, fica como "Em breve" */
export function LinkLogin({ className, children, ...props }: { className: string; children: ReactNode; 'aria-label'?: string }) {
  const embreve = LOGIN_URL === '#';
  return <a className={className} href={LOGIN_URL} data-login title={embreve ? 'Em breve' : undefined} onClick={embreve ? e => e.preventDefault() : undefined} {...props}>{children}</a>;
}

/* Link de loja de aplicativo: abre em nova aba quando houver endereço; senão fica desativado ("Em breve") */
export function LinkLoja({ loja, className, children }: { loja: keyof typeof LINKS_APP; className?: string; children: ReactNode }) {
  const u: string = LINKS_APP[loja];
  if (u !== '#') return <a className={className} href={u} data-loja={loja} target="_blank" rel="noopener">{children}<span className="sr-only"> (abre em nova aba)</span></a>;
  return <a className={className} href="#" data-loja={loja} aria-disabled="true" title="Em breve" onClick={e => e.preventDefault()}>{children}</a>;
}
