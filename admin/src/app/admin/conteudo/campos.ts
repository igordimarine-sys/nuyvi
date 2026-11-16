import { DESTINOS_LINK, DESTINOS_LOJA, LINKS_EXPLORE, type Bloco } from "@/modules/conteudo-site/schema";

// Como cada bloco é desenhado no formulário. Só dados (sem funções), para a página (servidor) entregar ao editor (cliente).
// Os campos são os do inventário da spec (5.9) e da seção 6.2 de docs/tecnico/ui-painel-conteudo.md: nenhum a mais.
export type Campo =
  | { tipo: "texto"; chave: string; rotulo: string; ajuda?: string; opcional?: boolean; longo?: boolean }
  | { tipo: "inteiro" | "preco"; chave: string; rotulo: string; ajuda?: string }
  | { tipo: "sim_nao"; chave: string; rotulo: string }
  | { tipo: "selecao"; chave: string; rotulo: string; ajuda?: string; vazio: string; opcoes: readonly { valor: string; rotulo: string }[] }
  | { tipo: "foto"; chave: string; rotulo: string }
  /** Lista de itens com vários campos. `titulo` é a chave do campo que resume o item no cabeçalho. */
  | { tipo: "video"; chave: string; rotulo: string; ajuda?: string; opcional?: boolean }
  /** Conjunto de campos com título (fieldset). Não tem dado próprio: os campos de dentro ficam no mesmo objeto do bloco. */
  | { tipo: "grupo"; chave: string; rotulo: string; campos: Campo[] }
  /** `max`: limite de itens; `semConfirmar`: remover sem diálogo (lista de links, CA-LOJ-65). */
  | { tipo: "lista"; chave: string; rotulo: string; item: string; artigo: "o" | "a"; titulo: string; adicionar: string; campos: Campo[]; max?: number; semConfirmar?: boolean }
  /** Lista de textos curtos (uma linha cada). */
  | { tipo: "textos"; chave: string; rotulo: string; item: string; adicionar: string };

const t = (chave: string, rotulo: string, extra: { ajuda?: string; longo?: boolean; opcional?: boolean } = {}): Campo => ({ tipo: "texto", chave, rotulo, ...extra });
const g = (chave: string, rotulo: string, campos: Campo[]): Campo => ({ tipo: "grupo", chave, rotulo, campos });
const foto = (chave: string, rotulo: string): Campo => ({ tipo: "foto", chave, rotulo });
/** Vídeo de fundo + imagem de espera obrigatória (6.7). */
const fundo = (rotulo = "Vídeo de fundo", chaveVideo = "video", chavePoster = "poster"): Campo =>
  g(`g-${chaveVideo}`, rotulo, [{ tipo: "video", chave: chaveVideo, rotulo }, { tipo: "foto", chave: chavePoster, rotulo: "Imagem de espera" }]);
/** Lista de links do menu e do rodapé: destino só da lista fechada, sem endereço externo (CA-LOJ-65). */
const links = (chave: string, rotulo: string, max: number, ajuda?: string): Campo => ({
  tipo: "lista", chave, rotulo, item: "Link", artigo: "o", titulo: "texto", adicionar: "Adicionar link", max, semConfirmar: true,
  campos: [t("texto", "Texto do link"), { tipo: "selecao", chave: "destino", rotulo: "Leva para", ajuda, vazio: "Escolha para onde o link leva", opcoes: DESTINOS_LINK }],
});
const DICA_TITULO = "O título do site é em duas linhas; a segunda tem destaque visual.";
const chamada = (): Campo[] => [t("rotulo", "Rótulo"), t("titulo1", "Título linha 1", { ajuda: DICA_TITULO }), t("titulo2", "Título linha 2"), t("texto", "Texto", { longo: true })];

export const CAMPOS: Record<Bloco, Campo[]> = {
  geral: [
    g("g-buscadores", "Buscadores", [
      t("seoTitulo", "Título da página", { ajuda: "Aparece na aba do navegador e no Google. Até 60 caracteres." }),
      t("seoDescricao", "Descrição para buscadores", { longo: true, ajuda: "Resumo que o Google mostra sob o título. De 70 a 160 caracteres." }),
    ]),
    g("g-cabecalho", "Cabeçalho", [
      t("slogan", "Slogan ao lado da logo"),
      links("menu", "Menu principal", 6, "O menu só aparece em telas largas (a partir de 1024 px)."),
      t("botaoBaixar", "Botão \"Baixar\"", { ajuda: "Sempre leva à seção Baixe o app. Some em telas pequenas." }),
      t("entrarLongo", "Botão de entrar, texto completo", { ajuda: "Para quem não está conectado." }),
      t("entrarCurto", "Botão de entrar, texto curto", { ajuda: "Usado em telas estreitas (até 479 px)." }),
      t("sair", "Texto \"Sair\"", { ajuda: "Para quem está conectado." }),
      t("painel", "Texto \"Painel\"", { ajuda: "Só a equipe vê este botão." }),
    ]),
    g("g-lojas", "Lojas de aplicativos", [
      t("lojaIos", "Endereço na App Store", { opcional: true, ajuda: "Cole o endereço da página do app. Vazio: o botão fica desativado. Vale para a seção Baixe o app e para o rodapé." }),
      t("lojaAndroid", "Endereço no Google Play", { opcional: true, ajuda: "Cole o endereço da página do app. Vazio: o botão fica desativado. Vale para a seção Baixe o app e para o rodapé." }),
      t("lojaDica", "Dica do botão desativado", { ajuda: "Aparece ao passar o mouse quando falta o endereço." }),
    ]),
    g("g-rodape", "Rodapé", [
      t("rodapeSlogan", "Slogan do rodapé"),
      links("rodapeLinks", "Links do rodapé", 8),
      t("direitos", "Linha de direitos", { ajuda: "O ano não muda sozinho: atualize em janeiro." }),
      t("versao", "Linha de versão", { opcional: true, ajuda: "Vazio esconde a linha. É a marca da versão de teste." }),
    ]),
    g("g-newsletter", "Newsletter", [
      t("newsRotulo", "Rótulo do campo"),
      t("newsExemplo", "Exemplo dentro do campo"),
      t("newsBotao", "Texto do botão"),
      t("newsSucesso", "Mensagem de sucesso", { ajuda: "Atenção: hoje o formulário ainda não guarda e-mails. Só mostra esta mensagem." }),
      t("newsInvalido", "Mensagem de e-mail inválido"),
    ]),
  ],
  abertura: [
    t("frase", "Frase"),
    t("plataformas", "Linha das plataformas"),
    t("botaoEntrar", "Texto do botão de entrar", { ajuda: "Some para quem está conectado (o cabeçalho já mostra o nome)." }),
    t("botaoBaixar", "Texto do botão de baixar", { ajuda: "Leva à seção Baixe o app." }),
    t("rolar", "Texto \"Role para ver mais\"", { ajuda: "Leva à seção Vídeos." }),
    g("g-video", "Vídeo de fundo", [
      { tipo: "video", chave: "video", rotulo: "Vídeo de fundo (computador)" },
      { tipo: "video", chave: "videoCelular", rotulo: "Vídeo de fundo (celular)", opcional: true, ajuda: "Usado em telas de até 767 px. Vazio: usa o do computador. Vertical funciona melhor." },
      foto("poster", "Imagem de espera"),
    ]),
  ],
  parceiros: [t("titulo1", "Título (parte em destaque)"), t("titulo2", "Título (continuação)"), t("texto", "Texto", { longo: true }), fundo()],
  videos: [
    g("g-titulos", "Títulos", [t("rotulo", "Rótulo"), t("titulo1", "Título linha 1", { ajuda: DICA_TITULO }), t("titulo2", "Título linha 2 (vazada)")]),
    g("g-troca", "Frase que troca", [
      t("trocaInicio", "Início da frase", { ajuda: "A frase é: início, meio e uma palavra que muda sozinha." }),
      t("trocaMeio", "Meio da frase"),
      { tipo: "textos", chave: "trocaPalavras", rotulo: "Palavras que trocam", item: "Palavra", adicionar: "Adicionar palavra" },
    ]),
    g("g-grande", "Vídeo grande (horizontal 16:9)", [t("grandeEtiqueta", "Etiqueta"), t("grandeTitulo", "Título"), { tipo: "video", chave: "grandeVideo", rotulo: "Vídeo" }, foto("grandePoster", "Imagem de espera")]),
    g("g-v1", "Vídeo vertical 1", [t("v1Etiqueta", "Etiqueta"), t("v1Titulo", "Título"), { tipo: "video", chave: "v1Video", rotulo: "Vídeo", ajuda: "Vertical, perto de 9:16." }, foto("v1Poster", "Imagem de espera")]),
    g("g-v2", "Vídeo vertical 2", [t("v2Etiqueta", "Etiqueta"), t("v2Titulo", "Título"), { tipo: "video", chave: "v2Video", rotulo: "Vídeo", ajuda: "Vertical, perto de 9:16." }, foto("v2Poster", "Imagem de espera")]),
  ],
  planos: [
    t("rotulo", "Rótulo"),
    t("titulo1", "Título linha 1", { ajuda: DICA_TITULO }),
    t("titulo2", "Título linha 2 (vazada)"),
    t("rotuloMensal", "Texto do seletor \"Mensal\""),
    t("rotuloAnual", "Texto do seletor \"Anual\"", { ajuda: "Ao lado de \"Anual\" o site mostra sozinho o desconto, ex.: -20%." }),
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
  bonus: [...chamada(), { tipo: "textos", chave: "itens", rotulo: "Vantagens", item: "Vantagem", adicionar: "Adicionar vantagem" }, fundo()],
  historia: [...chamada(), fundo()],
  explore: [
    t("rotulo", "Rótulo"),
    t("titulo1", "Título linha 1", { ajuda: DICA_TITULO }),
    t("titulo2", "Título linha 2 (vazada)"),
    t("verMais", "Texto \"Ver mais\"", { ajuda: "Aparece em todos os cartões." }),
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
  baixar: [
    ...chamada(),
    t("botaoIos", "Texto do botão da App Store", { ajuda: "O endereço de cada botão fica no bloco Geral, em Lojas de aplicativos." }),
    t("botaoAndroid", "Texto do botão do Google Play"),
    fundo(),
  ],
  novidades: [
    t("rotulo", "Rótulo"),
    t("titulo1", "Título linha 1", { ajuda: DICA_TITULO }),
    t("titulo2", "Título linha 2 (vazada)"),
    {
      tipo: "lista", chave: "noticias", rotulo: "Notícias", item: "Notícia", artigo: "a", titulo: "titulo", adicionar: "Adicionar notícia",
      campos: [t("data", "Data", { ajuda: 'Texto livre, ex.: "Em breve".' }), t("titulo", "Título"), { tipo: "foto", chave: "imagem", rotulo: "Imagem" }],
    },
  ],
  "pagina-loja": [
    t("seoTitulo", "Título da página", { ajuda: "Aba do navegador e Google. Até 60 caracteres." }),
    t("seoDescricao", "Descrição para buscadores", { longo: true }),
    t("rotulo", "Rótulo"),
    t("titulo1", "Título linha 1", { ajuda: DICA_TITULO }),
    t("titulo2", "Título linha 2 (vazada)"),
    t("abertura", "Texto de abertura", { longo: true, ajuda: "Aparece sob o título." }),
    t("vazio", "Texto do estado vazio", { ajuda: "Aparece quando não há produto à venda." }),
    t("aPartirDe", "Texto antes do preço", { ajuda: "Só aparece quando as variações têm preços diferentes." }),
    t("esgotado", "Texto de esgotado", { ajuda: "Marca o produto sem estoque." }),
  ],
};
