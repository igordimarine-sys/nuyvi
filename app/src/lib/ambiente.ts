// Condições do aparelho, lidas uma vez ao abrir a página (como na versão estática)
export const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const celular = matchMedia('(max-width: 767px)').matches;
// celular e tablet: menos animação presa à rolagem
export const leve = matchMedia('(max-width: 1023px), (pointer: coarse)').matches;
// aparelhos fracos (poucos núcleos, pouca memória ou economia de dados) ficam sem as fibras
const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
export const fraco = (nav.hardwareConcurrency || 8) <= 2 || (nav.deviceMemory || 8) <= 2 || !!nav.connection?.saveData;

// Idioma de movimento NUY (o mesmo do site original)
export const MOV = { entra: 'power3.out', sai: 'power2.in', troca: 'power3.inOut', micro: .2, base: .4, grande: .8, passo: .06, linha: .12, desloca: 24 };

// Links das lojas e do login (o cliente vai enviar). Enquanto forem '#', ficam como "Em breve".
export const LINKS_APP = { ios: '#', android: '#' } as const;
export const LOGIN_URL = '#';
