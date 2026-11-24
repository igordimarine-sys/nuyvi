import { useRef, useState, type FormEvent } from 'react';
import { voltarAoTopo } from '../lib/movimento';
import { LinkLoja } from './ui';

/* Botão "voltar ao topo": aparece na última seção (classe .visivel posta pelo ScrollTrigger) */
export function VoltarTopo() {
  return (
    <button type="button" className="voltar-topo fixed right-lado bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-45 grid size-[52px] cursor-pointer place-items-center rounded-pilula [border:0] bg-branco text-preto [box-shadow:0_10px_30px_-8px_rgba(0,0,0,.6)] hover:bg-laranja"
      data-voltar-topo aria-label="Voltar ao topo" onClick={e => { e.preventDefault(); voltarAoTopo(); }}>
      <svg className="size-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>
    </button>
  );
}

/* Cadastro de e-mail (sem servidor ainda) */
function FormNovidades() {
  const input = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean }>({ texto: '', erro: false });
  const [invalido, setInvalido] = useState(false);
  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = input.current!.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setAviso({ texto: 'Digite um e-mail válido, como nome@email.com.', erro: true }); setInvalido(true); input.current!.focus(); return; }
    setInvalido(false);
    setAviso({ texto: 'Pronto! Você vai receber as novidades da NUY.', erro: false }); e.currentTarget.reset();
  }
  return (
    <div>
      <form className="mt-5 flex max-w-[28rem] flex-wrap gap-2" data-news noValidate onSubmit={enviar}>
        <label className="block font-bold" htmlFor="email">Receba as novidades da NUY</label>
        <input ref={input} className="min-h-12 flex-[1_1_14rem] rounded-pilula border border-[rgba(255,255,255,.2)] bg-transparent px-4 py-0 text-branco [font:inherit] placeholder:text-cinza"
          id="email" type="email" name="email" placeholder="seu@email.com" autoComplete="email" required aria-describedby="email-aviso" aria-invalid={invalido || undefined} />
        <button className="bt bt-claro" type="submit">Assinar</button>
      </form>
      <p className={`mt-2 min-h-6 text-[.9rem] ${aviso.erro ? 'text-alerta' : 'text-verde'}`} id="email-aviso" role="status" aria-live="polite" data-news-aviso>{aviso.texto}</p>
    </div>
  );
}

const links = [['#videos', 'Vídeos'], ['#premium', 'Planos'], ['#explore', 'Explore'], ['#loja', 'Loja'], ['/politica-de-privacidade.html', 'Política de privacidade'], ['/termos-de-uso.html', 'Termos de uso']];

/* 11. Rodapé */
export default function Rodape() {
  return (
    <footer className="border-t border-[rgba(255,255,255,.08)] bg-rodape px-lado pt-[clamp(4rem,8vw,6rem)] pb-10">
      <div className="grid gap-10 nv:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <img src="/img/logo-header.webp" alt="NUY" width="160" height="66" style={{ height: 40, width: 'auto' }} />
          <p className="texto mt-4 text-[.95rem]">Conexões para viver melhor.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkLoja loja="ios" className="inline-flex rounded-[.6rem] transition-transform duration-200 ease-entra hover:-translate-y-[2px]"><img className="h-12 w-auto" src="/img/lojas/app-store.svg" alt="Baixar na App Store" height="48" /></LinkLoja>
            <LinkLoja loja="android" className="inline-flex rounded-[.6rem] transition-transform duration-200 ease-entra hover:-translate-y-[2px]"><img className="h-12 w-auto" src="/img/lojas/google-play.png" alt="Disponível no Google Play" height="48" /></LinkLoja>
          </div>
        </div>
        <FormNovidades />
        <nav aria-label="Rodapé">
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
            {links.map(([href, rotulo]) => <li key={href}><a className="inline-block py-[.6rem] text-nevoa no-underline hover:text-branco" href={href}>{rotulo}</a></li>)}
          </ul>
        </nav>
      </div>
      {/* Fiel à versão estática: lá a regra que daria espaço ao botão "voltar ao topo" (padding-right) está quebrada e não vale */}
      <div className="mt-12 flex flex-wrap justify-between gap-4 border-t border-[rgba(255,255,255,.08)] pt-6 text-[.8rem] text-cinza"><span>© 2026 NUY. Todos os direitos reservados.</span><span>Versão de teste de design</span></div>
    </footer>
  );
}
