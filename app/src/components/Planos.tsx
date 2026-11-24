import { useRef, useState } from 'react';
import { useCarrossel } from '../hooks/useCarrossel';
import { DESCONTO_ANUAL, PLANOS, RECURSOS, brl, type Plano } from '../data/planos';
import { Linhas, Pontos, Setas } from './ui';

function CartaoPlano({ p, i, anual }: { p: Plano; i: number; anual: boolean }) {
  const itens = RECURSOS.filter(r => r[i + 1] !== false).map(r => r[i + 1] === true ? r[0] : `${r[0]}: ${r[i + 1]}`);
  const mes = anual ? Math.round(p.mensal * (1 - DESCONTO_ANUAL) * 100) / 100 : p.mensal;
  return (
    <li className={`plano flex snap-start flex-col overflow-hidden rounded-cartao border bg-[linear-gradient(180deg,#1b1216,#111517_55%)] ${p.destaque ? 'border-[rgba(255,122,46,.7)] [box-shadow:0_0_0_1px_rgba(255,122,46,.35),0_30px_60px_-30px_rgba(255,122,46,.45)]' : 'border-[rgba(255,255,255,.09)]'}`}
      role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${PLANOS.length}: ${p.nome}`}>
      <div className="capa relative aspect-video overflow-hidden lg:aspect-[3/1]">
        {p.destaque && <span className="absolute top-[.9rem] left-[.9rem] z-1 rounded-pilula bg-laranja px-[.7rem] py-[.3rem] text-[.72rem] font-extrabold tracking-[.1em] text-preto uppercase">{p.destaque}</span>}
        <img className="size-full object-cover lg:object-[50%_28%]" src={p.capa} alt="" loading="lazy" width="930" height="530" />
      </div>
      <div className="relative -mt-5 flex flex-1 flex-col gap-[.4rem] px-[1.4rem] pb-6 lg:-mt-4 lg:gap-1 lg:px-[1.1rem] lg:pb-[1.1rem]">
        <h3 className="text-plano lg:text-plano-mesa">{p.nome}</h3>
        <p className="text-[.95rem] text-nevoa lg:text-[.84rem] lg:leading-[1.4]">{p.texto}</p>
        <p className="mt-3 font-display text-valor leading-none font-black tabular-nums font-stretch-[125%] lg:mt-[.35rem] lg:text-valor-mesa">
          {brl(mes)}<small className="ml-[.3rem] font-[Manrope,sans-serif] text-[.9rem] font-semibold text-nevoa lg:mt-[.3rem] lg:ml-0 lg:block lg:text-[.78rem]">{p.mensal === 0 ? 'para sempre' : 'por mês'}</small>
        </p>
        <p className="min-h-[1.4rem] text-[.82rem] text-nevoa lg:min-h-[1.2rem] lg:text-[.76rem]">{anual && p.mensal ? <><s>{brl(p.mensal)}</s> · {brl(mes * 12)} cobrados por ano</> : null}</p>
        <ul className="m-0 mt-3 grid list-none gap-2 p-0 text-[.92rem] text-nevoa-clara lg:mt-[.35rem] lg:gap-[.28rem] lg:text-[.8rem] lg:leading-[1.35]">
          {itens.map(t => <li key={t} className="flex items-baseline gap-[.6rem]">{t}</li>)}
        </ul>
        <div className="mt-6 flex lg:mt-[.9rem]"><a className={`bt ${p.destaque ? 'bt-claro' : 'bt-linha'} mt-auto self-start lg:min-h-11 lg:py-[.6rem]`} href="#baixar">{p.cta}</a></div>
      </div>
    </li>
  );
}

/* 5. Planos em carrossel, com a troca Mensal / Anual */
export default function Planos() {
  const ref = useRef<HTMLElement>(null);
  const [anual, setAnual] = useState(false);
  useCarrossel(ref);
  return (
    <section ref={ref} className="secao lg:py-[clamp(2.5rem,6vh,4.5rem)]" id="premium" aria-labelledby="planos-titulo" data-cor="#1a0c12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="rotulo lg:mb-[.6rem]">Planos</span>
          <h2 id="planos-titulo" className="text-t-medio lg:text-t-medio-premium" data-titulo><Linhas linhas={[['Escolha', ''], ['seu ritmo', 'vazado']]} /></h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="periodo inline-flex rounded-pilula border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.06)] p-1" role="group" aria-label="Forma de pagamento">
            <button type="button" aria-pressed={!anual} data-periodo="mensal" onClick={() => setAnual(false)}>Mensal</button>
            <button type="button" aria-pressed={anual} data-periodo="anual" onClick={() => setAnual(true)}>Anual <span className="economia">-20%</span></button>
          </div>
          <Setas alvo="planos-trilho" anterior="Plano anterior" proximo="Próximo plano" />
        </div>
      </div>
      <div className="planos-car lg:mt-6" role="region" aria-roledescription="carrossel" aria-label="Planos da NUY">
        <ul className="planos-trilho" id="planos-trilho" data-car-trilho>
          {PLANOS.map((p, i) => <CartaoPlano key={p.id} p={p} i={i} anual={anual} />)}
        </ul>
      </div>
      <Pontos total={PLANOS.length} />
      <p className="mt-4 text-center text-[.82rem] text-nevoa lg:mt-[.4rem]">Preços provisórios, em reais. Cancele quando quiser.</p>
    </section>
  );
}
