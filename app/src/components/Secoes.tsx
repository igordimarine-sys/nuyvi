import { useRef } from 'react';
import { useCarrossel } from '../hooks/useCarrossel';
import { Linhas, LinkLoja, Pontos, Setas, VideoFundo } from './ui';

/* 6. Bônus do plano anual */
export function Bonus() {
  return (
    <section className="secao" id="bonus" aria-labelledby="bonus-titulo" data-cor="#2a0f1c">
      <div className="grid items-center gap-8 nv:grid-cols-[1.15fr_1fr] nv:gap-[clamp(2rem,6vw,6rem)]">
        <div className="moldura aspect-[4/5] nv:order-2 nv:aspect-[5/6]" data-revela-img>
          <VideoFundo deriva="31s" style={{ objectPosition: '60% 50%' }} src="/video/esportes/natacao.mp4" poster="/img/esportes/natacao-poster.webp" data-zoom aria-hidden="true" />
        </div>
        <div>
          <span className="rotulo">Bônus do plano anual</span>
          <h2 id="bonus-titulo" className="text-t-medio" data-titulo><Linhas linhas={[['Pague por ano,', ''], ['ganhe mais', 'vazado']]} /></h2>
          <p className="texto mt-5">Ao contratar qualquer plano anual, você leva vantagem desde o primeiro treino.</p>
          <ul className="texto losangos mx-0 mt-6 mb-0 grid list-none gap-[.6rem] p-0">
            {['20% de desconto em relação ao mensal', 'Até 15% de desconto em todos os produtos da loja', 'Prioridade na reserva de quadras e arenas (Gold e Premium)'].map(t => (
              <li key={t} className="flex items-baseline gap-[.65rem]">{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* 7. História (presa na tela) */
export function Historia() {
  return (
    <section className="historia" id="historia" aria-labelledby="historia-titulo" data-cor="#07090A">
      <div className="palco">
        <div className="absolute inset-0 -z-2" aria-hidden="true">
          <VideoFundo className="size-full object-cover" deriva="27s" src="/video/esportes/volei.mp4" poster="/img/esportes/volei-poster.webp" data-hist-img />
        </div>
        <div className="px-lado" data-hist-texto>
          <span className="rotulo">Sua cidade, sua rede</span>
          <h2 id="historia-titulo" className="text-historia"><Linhas linhas={[['Treine junto.', ''], ['Evolua conectado.', 'sol']]} /></h2>
          <p className="texto mt-6 max-w-[38rem] text-historia-texto text-nevoa-clara">O app esportivo que reúne parceiros de treino, quadras, eventos, especialistas e inteligência artificial num só lugar. Abra o mapa e veja quem corre no seu bairro, onde tem quadra livre hoje à noite e qual evento começa no fim de semana.</p>
        </div>
      </div>
    </section>
  );
}

const SetaIr = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>;

const CARTOES = [
  { href: '#historia', img: '/img/esportes/volei.webp', w: 935, h: 530, pos: '62% 50%', titulo: 'Comunidade', texto: 'Feed, stories e chat com quem treina com você.' },
  { href: '#videos', img: '/img/esportes/relogio-v2.webp', w: 930, h: 527, pos: '58% 50%', titulo: 'Performance e IA', texto: 'Foto do prato, Personal IA e evolução no avatar 3D.' },
  { href: '#premium', img: '/img/esportes/corrida.webp', w: 902, h: 530, pos: '53% 50%', titulo: 'Gamificação', texto: 'Missões, sequência de dias e ranking entre amigos.' },
  { href: '#loja', img: '/img/esportes/variedade.webp', w: 832, h: 542, pos: '52% 50%', titulo: 'Loja', texto: 'Equipamento com desconto de assinante.' },
];

/* 8. Explore (carrossel de cartões) */
export function Explore() {
  const ref = useRef<HTMLElement>(null);
  useCarrossel(ref);
  return (
    <section ref={ref} className="secao" id="explore" aria-labelledby="explore-titulo" data-cor="#07090A">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="rotulo">Explore</span>
          <h2 id="explore-titulo" className="text-t-medio" data-titulo><Linhas linhas={[['Tudo num', ''], ['só app', 'vazado']]} /></h2>
        </div>
        <Setas alvo="explore-trilho" anterior="Cartão anterior" proximo="Próximo cartão" />
      </div>
      <div className="car" role="region" aria-roledescription="carrossel" aria-label="Recursos do app">
        <ul className="car-trilho cartoes" id="explore-trilho" data-car-trilho>
          {CARTOES.map((c, k) => (
            <li key={c.titulo} role="group" aria-roledescription="slide" aria-label={`${k + 1} de ${CARTOES.length}`}>
              <a className="cartao relative isolate block aspect-[3/4] overflow-hidden rounded-cartao bg-grafite no-underline" href={c.href} data-revela-card>
                <img className="absolute inset-0 -z-2 size-full object-cover" src={c.img} alt="" loading="lazy" width={c.w} height={c.h} style={{ objectPosition: c.pos }} />
                <span className="absolute inset-x-5 bottom-5 lg:inset-x-4 lg:bottom-4">
                  <h3 className="text-cartao lg:text-cartao-mesa">{c.titulo}</h3>
                  <p className="mt-2 text-[.92rem] text-nevoa">{c.texto}</p>
                  <span className="ir mt-4 inline-flex items-center gap-[.4rem] text-[.85rem] font-bold tracking-[.06em] uppercase">Ver mais <SetaIr /></span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <Pontos total={CARTOES.length} />
    </section>
  );
}

const PRODUTOS = [
  { img: '/img/esportes/venda.webp', w: 905, h: 542, alt: 'Vendedor mostra um tênis de corrida a uma cliente na loja', titulo: 'Calçados', texto: 'Tênis de corrida, treino e quadra, com ajuda para escolher o seu.' },
  { img: '/img/esportes/variedade.webp', w: 832, h: 542, alt: 'Prateleiras com camisetas, tênis, garrafas e bolas', titulo: 'Roupas e acessórios', texto: 'Camisetas, garrafas, bolas e mais. Assinante paga até 15% menos.' },
];

/* 9. Loja */
export function Loja() {
  return (
    <section className="secao" id="loja" aria-labelledby="loja-titulo" data-cor="#140a0e">
      <span className="rotulo">Loja NUY</span>
      <h2 id="loja-titulo" className="text-t-medio" data-titulo><Linhas linhas={[['Equipado', ''], ['sem sair do app', 'vazado']]} /></h2>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {PRODUTOS.map(p => (
          <a key={p.titulo} className="produto grid grid-rows-[auto_1fr] overflow-hidden rounded-cartao border border-[rgba(255,255,255,.08)] bg-[linear-gradient(160deg,#1b1114,#111517_60%)] no-underline" href="#baixar" data-revela-card>
            <span className="foto grid aspect-[5/4] place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(255,122,46,.22),transparent_65%)]"><img className="size-full object-cover" src={p.img} alt={p.alt} loading="lazy" width={p.w} height={p.h} /></span>
            <span className="flex flex-col gap-2 p-6">
              <h3 className="text-produto">{p.titulo}</h3>
              <p className="text-nevoa">{p.texto}</p>
              <span className="mt-auto pt-4 text-[.85rem] font-bold tracking-[.06em] text-laranja uppercase">Comprar no app</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* Baixe o app (antes das novidades) */
export function Baixar() {
  return (
    <section className="faixa" id="baixar" aria-labelledby="baixar-titulo" data-cor="#07090A">
      <div className="absolute inset-0 -z-2" aria-hidden="true">
        <VideoFundo className="size-full object-cover" deriva="29s" src="/video/esportes/corrida.mp4" poster="/img/esportes/corrida-poster.webp" data-paralaxe />
      </div>
      <div>
        <span className="rotulo">Já disponível</span>
        <h2 id="baixar-titulo" className="text-t-grande" data-titulo><Linhas linhas={[['Baixe', ''], ['agora', 'sol']]} /></h2>
        <p className="texto mt-5">Grátis para começar. Parceiros, quadras, eventos e a sua evolução num só app.</p>
        <div className="flex flex-wrap gap-3">
          <LinkLoja loja="ios" className="bt bt-claro mt-7">App Store</LinkLoja>
          <LinkLoja loja="android" className="bt bt-linha mt-7">Google Play</LinkLoja>
        </div>
      </div>
    </section>
  );
}

const NOTICIAS = [
  { img: '/img/esportes/centro.webp', w: 947, h: 530, titulo: 'Título da notícia 1' },
  { img: '/img/esportes/orientacao.webp', w: 947, h: 527, titulo: 'Título da notícia 2' },
  { img: '/img/esportes/nutricao.webp', w: 900, h: 542, titulo: 'Título da notícia 3' },
];

/* 10. Novidades (notícias ainda são espaço reservado: o cliente vai enviar as reais) */
export function Novidades() {
  const ref = useRef<HTMLElement>(null);
  useCarrossel(ref);
  return (
    <section ref={ref} className="secao" id="novidades" aria-labelledby="novidades-titulo" data-cor="#07090A">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="rotulo">Novidades</span>
          <h2 id="novidades-titulo" className="text-t-medio" data-titulo><Linhas linhas={[['Últimas', ''], ['notícias', 'vazado']]} /></h2>
        </div>
        <Setas alvo="novidades-trilho" anterior="Notícia anterior" proximo="Próxima notícia" />
      </div>
      <div className="car" role="region" aria-roledescription="carrossel" aria-label="Últimas notícias">
        <ul className="car-trilho noticias" id="novidades-trilho" data-car-trilho tabIndex={0}>
          {NOTICIAS.map((n, k) => (
            <li key={n.titulo} role="group" aria-roledescription="slide" aria-label={`${k + 1} de ${NOTICIAS.length}`}>
              <article className="overflow-hidden rounded-cartao border border-[rgba(255,255,255,.08)] bg-grafite" data-revela-card>
                <div className="aspect-video overflow-hidden"><img className="size-full object-cover" src={n.img} alt="" loading="lazy" width={n.w} height={n.h} /></div>
                <div className="p-5"><time className="text-[.75rem] font-bold tracking-[.14em] text-laranja uppercase">Em breve</time><h3 className="mt-2 text-[1.15rem] leading-[1.1]">{n.titulo}</h3></div>
              </article>
            </li>
          ))}
        </ul>
      </div>
      <Pontos total={NOTICIAS.length} />
    </section>
  );
}
