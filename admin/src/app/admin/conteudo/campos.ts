import { DESTINOS_LOJA, LINKS_EXPLORE, type Bloco } from "@/modules/conteudo-site/schema";

// Como cada bloco é desenhado no formulário. Só dados (sem funções), para a página (servidor) entregar ao editor (cliente).
// Os campos são os do inventário da spec (5.9) e da seção 6.2 de docs/tecnico/ui-painel-conteudo.md: nenhum a mais.
export type Campo =
  | { tipo: "texto"; chave: string; rotulo: string; ajuda?: string; opcional?: boolean; longo?: boolean }
  | { tipo: "inteiro" | "preco"; chave: string; rotulo: string; ajuda?: string }
  | { tipo: "sim_nao"; chave: string; rotulo: string }
  | { tipo: "selecao"; chave: string; rotulo: string; ajuda?: string; vazio: string; opcoes: readonly { valor: string; rotulo: string }[] }
  | { tipo: "foto"; chave: string; rotulo: string }
  /** Lista de itens com vários campos. `titulo` é a chave do campo que resume o item no cabeçalho. */
  | { tipo: "lista"; chave: string; rotulo: string; item: string; artigo: "o" | "a"; titulo: string; adicionar: string; campos: Campo[] }
  /** Lista de textos curtos (uma linha cada). */
  | { tipo: "textos"; chave: string; rotulo: string; item: string; adicionar: string };

const t = (chave: string, rotulo: string, extra: { ajuda?: string; longo?: boolean; opcional?: boolean } = {}): Campo => ({ tipo: "texto", chave, rotulo, ...extra });
const DICA_TITULO = "O título do site é em duas linhas; a segunda tem destaque visual.";
const chamada = (): Campo[] => [t("rotulo", "Rótulo"), t("titulo1", "Título linha 1", { ajuda: DICA_TITULO }), t("titulo2", "Título linha 2"), t("texto", "Texto", { longo: true })];

export const CAMPOS: Record<Bloco, Campo[]> = {
  abertura: [t("frase", "Frase"), t("plataformas", "Linha das plataformas")],
  parceiros: [t("titulo1", "Título (parte em destaque)"), t("titulo2", "Título (continuação)"), t("texto", "Texto", { longo: true })],
  planos: [
    { tipo: "inteiro", chave: "desconto_anual", rotulo: "Desconto do plano anual (%)", ajuda: "Aparece como o desconto de quem paga por ano. De 0 a 90." },
    t("nota", "Nota abaixo dos planos"),
    {
      tipo: "lista", chave: "planos", rotulo: "Planos", item: "Plano", artigo: "o", titulo: "nome", adicionar: "Adicionar plano",
      campos: [
        t("nome", "Nome"),
        { tipo: "preco", chave: "mensal", rotulo: "Preço mensal (R$)", ajuda: "Valor mostrado no site. Quem cobra a assinatura é o app." },
        t("texto", "Resumo"),
        t("botao", "Texto do botão"),
        t("selo", "Selo", { opcional: true, ajuda: "Ex.: Recomendado." }),
        { tipo: "foto", chave: "capa", rotulo: "Capa" },
        { tipo: "textos", chave: "itens", rotulo: "O que inclui", item: "Item", adicionar: "Adicionar item" },
      ],
    },
  ],
  bonus: [...chamada(), { tipo: "textos", chave: "itens", rotulo: "Vantagens", item: "Vantagem", adicionar: "Adicionar vantagem" }],
  historia: chamada(),
  explore: [
    {
      tipo: "lista", chave: "cartoes", rotulo: "Cartões", item: "Cartão", artigo: "o", titulo: "titulo", adicionar: "Adicionar cartão",
      campos: [
        t("titulo", "Título"),
        t("texto", "Texto", { longo: true }),
        { tipo: "foto", chave: "imagem", rotulo: "Imagem" },
        t("posicao", "Enquadramento da imagem", { opcional: true, ajuda: "Onde a imagem é cortada. Ex.: 62% 50%. Deixe vazio para o padrão." }),
        { tipo: "sim_nao", chave: "inteira", rotulo: "Mostrar a imagem inteira" },
        { tipo: "selecao", chave: "link", rotulo: "Leva para a seção", vazio: "Escolha uma seção", opcoes: LINKS_EXPLORE },
      ],
    },
  ],
  loja: [
    t("rotulo", "Rótulo da seção"),
    t("titulo1", "Título linha 1", { ajuda: DICA_TITULO }),
    t("titulo2", "Título linha 2 (vazada)"),
    {
      tipo: "lista", chave: "produtos", rotulo: "Cartões", item: "Cartão", artigo: "o", titulo: "nome", adicionar: "Adicionar cartão",
      campos: [
        t("nome", "Nome"),
        t("descricao", "Descrição", { longo: true }),
        { tipo: "foto", chave: "foto", rotulo: "Foto" },
        t("alt", "Descrição da foto (para quem não enxerga)", { opcional: true }),
        t("botao", "Texto do botão"),
        { tipo: "selecao", chave: "destino", rotulo: "Destino do botão", ajuda: "Para onde o botão do cartão leva na loja. O cartão não mostra preço nem estoque.", vazio: "Escolha para onde o botão leva", opcoes: DESTINOS_LOJA },
      ],
    },
  ],
  baixar: chamada(),
  novidades: [
    {
      tipo: "lista", chave: "noticias", rotulo: "Notícias", item: "Notícia", artigo: "a", titulo: "titulo", adicionar: "Adicionar notícia",
      campos: [t("data", "Data", { ajuda: 'Texto livre, ex.: "Em breve".' }), t("titulo", "Título"), { tipo: "foto", chave: "imagem", rotulo: "Imagem" }],
    },
  ],
};
