import "server-only";
import { desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { conteudoVersoes, user, type DisparoEstado } from "@/db/schema";
import { exigirPapel } from "@/modules/contas/papeis";
import { PAPEL_CONTEUDO } from "./permissao";
import { conteudoSchema, SLUGS, type Bloco, type Conteudo } from "./schema";

const PAGINA = 50;

/** Tag do cache da página pública `/`: quem publica conteúdo revalida esta tag (ADR-0007). */
export const TAG_CONTEUDO_SITE = "conteudo-site";

/**
 * Última versão publicada (disparo aceito). Pública de propósito: é o que o endpoint /api/conteudo-site entrega ao build
 * do site, só conteúdo de vitrine, sem autor nem qualquer dado da equipe. Versão pendente ou que falhou nunca é devolvida.
 * Lança se o conteúdo gravado não passar na validação (melhor falhar o build do site do que publicar HTML estranho).
 */
export async function obterPublicado(): Promise<{ numero: number; conteudo: Conteudo } | null> {
  const [v] = await db
    .select({ numero: conteudoVersoes.numero, conteudo: conteudoVersoes.conteudo })
    .from(conteudoVersoes)
    .where(eq(conteudoVersoes.disparoEstado, "aceito"))
    .orderBy(desc(conteudoVersoes.numero))
    .limit(1);
  return v ? { numero: v.numero, conteudo: conteudoSchema.parse(v.conteudo) } : null;
}

export type UltimaPublicacao = { numero: number; quando: Date; autor: string | null; origem: "painel" | "migracao" };
export type Painel = {
  publicado: { numero: number; conteudo: Conteudo } | null;
  /** Maior número de todas as versões (inclusive as que falharam): é a `versaoBase` que a tela devolve ao publicar. */
  versaoBase: number;
  /** Por bloco: a última versão publicada que o alterou. */
  porBloco: Partial<Record<Bloco, UltimaPublicacao>>;
  /** A publicação mais recente e os blocos que ela mudou. */
  ultima: (UltimaPublicacao & { blocos: Bloco[] }) | null;
};

/** Maior número de versão (a base que a tela devolve ao publicar e o conflito usa). */
export async function situacao(): Promise<{ versaoBase: number }> {
  await exigirPapel(PAPEL_CONTEUDO);
  return lerSituacao();
}

async function lerSituacao(): Promise<{ versaoBase: number }> {
  const r = await db.execute<{ versao_base: number }>(sql`select coalesce(max(numero), 0)::int as versao_base from conteudo_versoes`);
  return { versaoBase: r.rows[0]?.versao_base ?? 0 };
}

/** Dados da lista de blocos e da edição (admin). */
export async function lerPainel(): Promise<Painel> {
  await exigirPapel(PAPEL_CONTEUDO);
  const [publicado, sit, linhas] = await Promise.all([
    obterPublicado(),
    lerSituacao(),
    db.execute<{ bloco: Bloco; numero: number; criado_em: Date; origem: "painel" | "migracao"; autor: string | null }>(sql`
      select distinct on (b.bloco) b.bloco, v.numero, v.criado_em, v.origem, u.name as autor
        from conteudo_versoes v
        cross join lateral unnest(v.blocos_alterados) as b(bloco)
        left join "user" u on u.id = v.autor_id
       where v.disparo_estado = 'aceito'
       order by b.bloco, v.numero desc`),
  ]);
  const porBloco: Painel["porBloco"] = {};
  for (const l of linhas.rows) porBloco[l.bloco] = { numero: l.numero, quando: new Date(l.criado_em), autor: l.autor, origem: l.origem };
  const maisNovo = Math.max(0, ...linhas.rows.map((l) => l.numero));
  const ref = SLUGS.map((s) => porBloco[s]).find((p) => p?.numero === maisNovo);
  const ultima = ref ? { ...ref, blocos: SLUGS.filter((s) => porBloco[s]?.numero === maisNovo) } : null;
  return { publicado, ...sit, porBloco, ultima };
}

export type ItemHistorico = {
  numero: number;
  quando: Date;
  autor: string | null; // null = conta removida (origem "painel") ou migração
  origem: "painel" | "migracao";
  blocos: Bloco[];
  estado: DisparoEstado;
};

/** Histórico (CA-LOJ-57, RN-LOJ-26), do mais novo ao mais antigo, 50 por página. Nunca traz o conteúdo da versão nem o motivo técnico da falha. */
export async function historico(antesDe?: number): Promise<{ itens: ItemHistorico[]; proximo: number | null }> {
  await exigirPapel(PAPEL_CONTEUDO);
  const linhas = await db
    .select({
      numero: conteudoVersoes.numero,
      quando: conteudoVersoes.criadoEm,
      autor: user.name,
      origem: conteudoVersoes.origem,
      blocos: conteudoVersoes.blocosAlterados,
      estado: conteudoVersoes.disparoEstado,
    })
    .from(conteudoVersoes)
    .leftJoin(user, eq(user.id, conteudoVersoes.autorId))
    .where(antesDe === undefined ? undefined : lt(conteudoVersoes.numero, antesDe))
    .orderBy(desc(conteudoVersoes.numero))
    .limit(PAGINA + 1);
  const pagina = linhas.slice(0, PAGINA).map((l) => ({
    ...l,
    origem: l.origem as ItemHistorico["origem"],
    blocos: l.blocos as Bloco[],
    estado: l.estado as DisparoEstado,
  }));
  return { itens: pagina, proximo: linhas.length > PAGINA ? (pagina.at(-1)?.numero ?? null) : null };
}
