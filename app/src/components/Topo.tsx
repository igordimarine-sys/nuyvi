import { useSyncExternalStore } from 'react';
import { alternarPausa, assinarPausa, estaParado } from '../lib/midia';
import { LinkLogin } from './ui';

const nav = [['#videos', 'Vídeos'], ['#premium', 'Planos'], ['#explore', 'Explore'], ['#loja', 'Loja'], ['#novidades', 'Novidades']];

export default function Topo() {
  const parado = useSyncExternalStore(assinarPausa, estaParado);
  return (
    <header className="topo fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 py-3 px-lado bg-[linear-gradient(180deg,rgba(7,9,10,.75),rgba(7,9,10,0))]">
      <a className="marca flex items-center gap-3 no-underline" href="#topo" aria-label="NUY, voltar ao início">
        <img className="h-[30px] w-auto" src="/img/logo-header.webp" alt="NUY" width="160" height="66" />
        <span className="max-w-[8.5rem] border-l border-l-[rgba(255,255,255,.22)] pl-3 text-[.72rem] leading-[1.2] font-semibold tracking-[.02em] text-nevoa sm:max-w-none sm:whitespace-nowrap sm:text-[.8rem]">Conexões para viver melhor</span>
      </a>
      <nav aria-label="Principal">
        <ul className="m-0 hidden list-none gap-6 p-0 text-[.875rem] font-semibold lg:flex">
          {nav.map(([href, rotulo]) => (
            <li key={href}><a className="inline-block py-3 text-nevoa no-underline transition-[color] duration-200 ease-entra hover:text-branco" href={href}>{rotulo}</a></li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center gap-2">
        <button className="group grid size-11 cursor-pointer place-items-center rounded-pilula border border-[rgba(255,255,255,.2)] bg-[rgba(7,9,10,.4)] text-branco" type="button" aria-pressed={parado} onClick={alternarPausa}>
          <span className="sr-only">Pausar animações</span>
          <svg className="size-4 group-aria-pressed:hidden" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          <svg className="hidden size-4 group-aria-pressed:block" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
        </button>
        <a className="bt bt-linha min-h-11 px-[1.1rem] text-[.85rem] max-md:hidden max-xs:px-[.9rem]" href="#baixar">Baixar</a>
        <LinkLogin className="bt bt-claro min-h-11 px-[1.1rem] text-[.85rem] max-xs:px-[.9rem]" aria-label="Entrar na NUY"><span className="max-xs:hidden">Entrar na NUY</span><span className="hidden max-xs:inline" aria-hidden="true">Entrar</span></LinkLogin>
      </div>
    </header>
  );
}
