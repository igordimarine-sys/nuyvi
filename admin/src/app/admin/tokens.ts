// Tokens do painel (sem "use client": usados por componentes de servidor e pelo tema).
// Cores do site (tokens do :root de site/index.html); densidade no modelo do painel do trafego-system.
export const cor = {
  bg: "#07090A", // --preto
  card: "#111517", // --grafite
  surface: "#161B1D", // cabeçalho de tabela e de seção
  rowHover: "#151A1C",
  border: "#252C2F",
  borderLight: "#1B2124",
  primary: "#FF7A2E", // --laranja
  primaryLight: "rgba(255,122,46,.12)",
  primaryHover: "#FF9152",
  text: "#F4F7F5", // --branco
  textSec: "#A9B1AD", // --nevoa
  textMuted: "#7F8884",
  ciano: "#2EC8E8",
  rosa: "#E8476A",
  verde: "#8BE04E",
  ambar: "#FFB25E",
  porDoSol: "linear-gradient(135deg, #FFB25E 0%, #FF7A2E 45%, #E8476A 100%)",
} as const;
export const raio = { sm: 6, md: 8 } as const;
export const LARGURA_MENU = 220;
