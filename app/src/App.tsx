import { useEffect, useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import { iniciarFibras } from './lib/fibras';
import { iniciarMovimento } from './lib/movimento';
import Topo from './components/Topo';
import Abertura from './components/Abertura';
import Videos from './components/Videos';
import Planos from './components/Planos';
import { Baixar, Bonus, Explore, Historia, Loja, Novidades } from './components/Secoes';
import Rodape, { VoltarTopo } from './components/Rodape';

/* Fundo animado de fibras (GhostFibers), fixo atrás de todo o conteúdo */
function Fibras() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vivo = true, fim: (() => void) | undefined;
    iniciarFibras(ref.current!).then(f => { if (vivo) fim = f; else f(); });
    return () => { vivo = false; fim?.(); };
  }, []);
  return <div ref={ref} className="fibras" aria-hidden="true" data-fibras />;
}

/* Cada seção ganha duas camadas: a cena (fica presa na tela na saída) e a cena-in (se move na entrada).
   Na versão estática o JS criava essas camadas; aqui elas já vêm no HTML. */
function Cena({ primeira, children }: { primeira?: boolean; children: ReactNode }) {
  return <div className={primeira ? 'cena primeira' : 'cena'}><div className={primeira ? 'cena-in primeira' : 'cena-in'}>{children}</div></div>;
}

export default function App() {
  // todas as animações de rolagem num só lugar, criadas depois que as seções já mediram seus carrosséis e títulos
  useGSAP(() => iniciarMovimento());
  return (
    <>
      <a className="absolute -top-16 left-4 z-100 rounded-pilula bg-branco px-4 py-[.6rem] font-bold text-preto focus:top-4" href="#conteudo">Pular para o conteúdo</a>
      <Fibras />
      <Topo />
      <main id="conteudo">
        <Cena primeira><Abertura /></Cena>
        <Cena><Videos /></Cena>
        <Cena><Planos /></Cena>
        <Cena><Bonus /></Cena>
        <Cena><Historia /></Cena>
        <Cena><Explore /></Cena>
        <Cena><Loja /></Cena>
        <Cena><Baixar /></Cena>
        <Cena><Novidades /></Cena>
      </main>
      <VoltarTopo />
      <Rodape />
    </>
  );
}
