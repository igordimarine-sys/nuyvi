// Versão `migracao` dos blocos novos do conteúdo (ADR-0007 A1): grava a versão N+1 com os campos que passaram a ser editáveis
// (geral, videos, pagina-loja e os campos acrescentados aos blocos existentes), preenchidos com o texto atual do template
// `src/site/index.html`. Idempotente: se a última versão aceita já tem `textos.geral`, não grava nada; a PK (23505) cobre a corrida.
// Roda ANTES do deploy do código que lê os campos novos. Só conteúdo de vitrine; sem segredo nem dado pessoal.
//   npm run conteudo:blocos-novos
import { pathToFileURL } from "node:url";

const menu = [["Vídeos", "#videos"], ["Planos", "#premium"], ["Explore", "#explore"], ["Loja", "#loja"], ["Novidades", "#novidades"]];
const link = ([texto, destino]) => ({ texto, destino });

/** Valores iniciais = texto atual do template. `textos.*` entram dentro de `textos`; `planos`, `explore` e `novidades` são documentos. */
export const INICIAL = {
  textos: {
    hero: { botaoEntrar: "Entrar na NUY", botaoBaixar: "Baixar o app", rolar: "Role para ver mais", video: "video/atletas-laranja-v2.mp4", videoCelular: "video/atletas-laranja-cel-v2.mp4", poster: "img/vi/atletas-poster.webp" },
    rede: { video: "video/esportes/ciclismo.mp4", poster: "img/esportes/ciclismo-poster.webp" },
    bonus: { video: "video/esportes/natacao.mp4", poster: "img/esportes/natacao-poster.webp" },
    historia: { video: "video/esportes/volei.mp4", poster: "img/esportes/volei-poster.webp" },
    baixar: { botaoIos: "App Store", botaoAndroid: "Google Play", video: "video/esportes/corrida.mp4", poster: "img/esportes/corrida-poster.webp" },
    videos: {
      rotulo: "Vídeos", titulo1: "Veja por", titulo2: "dentro",
      trocaInicio: "Aqui você", trocaMeio: "encontra", trocaPalavras: ["amigos", "eventos", "acessórios", "dicas", "saúde", "diversão"],
      grandeEtiqueta: "Por dentro do app", grandeTitulo: "Veja por dentro", grandeVideo: "video/pordentro.mp4", grandePoster: "img/pordentro-poster.webp",
      v1Etiqueta: "Performance", v1Titulo: "Avatar 3D", v1Video: "video/avatar360.mp4", v1Poster: "img/avatar360-poster.webp",
      v2Etiqueta: "Premium", v2Titulo: "Especialistas por vídeo", v2Video: "video/videochamada.mp4", v2Poster: "img/vi/videochamada.webp",
    },
    geral: {
      seoTitulo: "NUY",
      seoDescricao: "NUYVI: teste de design da landing N.UY, com imagens de borda a borda, logo em zoom na rolagem e seções presas na tela.",
      slogan: "Conexões para viver melhor",
      menu: menu.map(link),
      botaoBaixar: "Baixar", entrarLongo: "Entrar na NUY", entrarCurto: "Entrar", sair: "Sair", painel: "Painel",
      lojaIos: "", lojaAndroid: "", lojaDica: "Em breve",
      rodapeSlogan: "Conexões para viver melhor.",
      rodapeLinks: [...menu.slice(0, 4), ["Política de privacidade", "politica-de-privacidade.html"], ["Termos de uso", "termos-de-uso.html"]].map(link),
      direitos: "© 2026 N.UY. Todos os direitos reservados.",
      versao: "NUYVI · versão de teste de design",
      newsRotulo: "Receba as novidades da N.UY", newsExemplo: "seu@email.com", newsBotao: "Assinar",
      newsSucesso: "Pronto! Você vai receber as novidades da N.UY.", newsInvalido: "Digite um e-mail válido, como nome@email.com.",
    },
    // Texto PROVISÓRIO: a página /loja ainda não existe; o copywriter fecha (tarefa 22).
    paginaLoja: {
      seoTitulo: "Loja N.UY", seoDescricao: "Calçados, roupas e acessórios para quem treina.",
      rotulo: "Loja N.UY", titulo1: "Equipado", titulo2: "para treinar",
      abertura: "Tênis, roupas e acessórios para o seu treino.", vazio: "Em breve", aPartirDe: "a partir de", esgotado: "Esgotado",
    },
  },
  planos: { rotulo: "Planos", titulo1: "Escolha", titulo2: "seu ritmo", rotuloMensal: "Mensal", rotuloAnual: "Anual" },
  explore: { rotulo: "Explore", titulo1: "Tudo num", titulo2: "só app", verMais: "Ver mais" },
  novidades: { rotulo: "Novidades", titulo1: "Últimas", titulo2: "notícias" },
};
/** Blocos que ganharam campos (vai em `blocos_alterados`). */
export const BLOCOS_NOVOS = ["geral", "abertura", "parceiros", "videos", "planos", "bonus", "historia", "explore", "baixar", "novidades", "pagina-loja"];

const preenchidos = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== "")); // "" = ausente (o zod injeta "" nos opcionais)

/** Conteúdo com os campos novos preenchidos; o que a versão já tem vale mais que o valor inicial. */
export function completar(conteudo) {
  const saida = structuredClone(conteudo);
  for (const [doc, valores] of Object.entries(INICIAL)) {
    if (doc === "textos") {
      for (const [bloco, v] of Object.entries(valores)) saida.textos[bloco] = { ...structuredClone(v), ...preenchidos(saida.textos[bloco]) };
    } else saida[doc] = { ...structuredClone(valores), ...preenchidos(saida[doc]) };
  }
  return saida;
}

async function main() {
  const { default: pg } = await import("pg");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definida (use .env.local ou a variável do ambiente).");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query(`select conteudo from conteudo_versoes where disparo_estado = 'aceito' order by numero desc limit 1`);
      if (!rows[0]) {
        await client.query("rollback");
        console.error("Nenhuma versão aceita: rode antes `npm run conteudo:migrar`.");
        process.exitCode = 1;
        return;
      }
      if (rows[0].conteudo?.textos?.geral) {
        await client.query("rollback");
        console.log("A última versão já tem os blocos novos; nada foi gravado.");
        return;
      }
      await client.query(
        `insert into conteudo_versoes (numero, conteudo, blocos_alterados, origem, disparo_estado, disparo_em)
         select coalesce(max(numero), 0) + 1, $1::jsonb, $2::text[], 'migracao', 'aceito', now() from conteudo_versoes`,
        [JSON.stringify(completar(rows[0].conteudo)), BLOCOS_NOVOS],
      );
      await client.query("commit");
      console.log("Versão com os blocos novos gravada.");
    } catch (e) {
      await client.query("rollback").catch(() => {});
      // corrida com outra execução ou com uma publicação: a PK impede a duplicata; vale o que já está lá
      if (e?.code === "23505") console.log("A última versão já tem os blocos novos; nada foi gravado.");
      else throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
