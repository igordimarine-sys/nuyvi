// Planos (preços provisórios, os mesmos do site original)
export const DESCONTO_ANUAL = 0.20;

export type Plano = { id: string; nome: string; mensal: number; texto: string; cta: string; capa: string; destaque?: string };

export const PLANOS: Plano[] = [
  { id: 'gratuito', nome: 'Gratuito', mensal: 0,     texto: 'Para começar a treinar com a comunidade.',        cta: 'Começar grátis', capa: '/img/esportes/ciclismo.webp' },
  { id: 'silver',   nome: 'Silver',   mensal: 19.90, texto: 'Mais conexões e o Personal IA no dia a dia.',     cta: 'Assinar Silver', capa: '/img/esportes/academia.webp' },
  { id: 'gold',     nome: 'Gold',     mensal: 39.90, texto: 'IA completa, avatar 3D e prioridade nas quadras.', cta: 'Assinar Gold', capa: '/img/esportes/natacao.webp', destaque: 'Recomendado' },
  { id: 'premium',  nome: 'Premium',  mensal: 69.90, texto: 'Tudo do Gold, com uma consulta por vídeo por mês.', cta: 'Assinar Premium', capa: '/img/esportes/orientacao.webp' },
];

// [recurso, Gratuito, Silver, Gold, Premium]: true = incluído, false = não, texto = detalhe
export const RECURSOS: Array<[string, ...Array<boolean | string>]> = [
  ['Feed, stories e chat',            true,        true,        true,             true],
  ['Descobrir parceiros',             '5 por dia', 'sem limite', 'sem limite',      'sem limite'],
  ['Eventos e corridas',              true,        true,        true,             true],
  ['Criar seus próprios eventos',     false,       true,        true,             true],
  ['Reserva de quadras',              true,        true,        'com prioridade', 'com prioridade'],
  ['Personal IA',                     false,       'básico',    'completo',       'completo'],
  ['Nutricionista IA',                false,       false,       true,             true],
  ['Avatar 3D e evolução corporal',   false,       false,       true,             true],
  ['Consulta por vídeo',              'contratação avulsa', 'contratação avulsa', 'contratação avulsa', '1 por mês'],
  ['Desconto na loja',                false,       '5%',        '10%',            '15%'],
];

export const brl = (v: number) => v === 0 ? 'R$ 0' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
