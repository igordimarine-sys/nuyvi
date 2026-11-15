import "server-only";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conteudoVersoes } from "@/db/schema";
import { exigirPapel } from "@/modules/contas/papeis";
import { dispararSite } from "./deploy-hook";
import { obterPublicado, PENDENTE_EXPIRA_MIN, situacao } from "./leitura";
import { PAPEL_CONTEUDO } from "./permissao";
import { BLOCOS, comFatia, conteudoSchema, ehBloco, errosDe, fatia, SLUGS, type Bloco } from "./schema";

export type ResultadoPublicacao =
  /** O disparo foi aceito (o site ainda leva alguns minutos). `aviso` só quando o ambiente não tem hook: o site NÃO muda. */
  | { tipo: "publicado"; numero: number; aviso?: string }
  | { tipo: "invalido"; erros: { caminho: string; mensagem: string }[] }
  /** Alguém publicou depois que a tela abriu. `atual` é o bloco publicado agora; `versaoBase` é a base para reenviar. */
  | { tipo: "conflito"; versaoBase: number; blocosAlterados: Bloco[]; mesmoBloco: boolean; atual: unknown }
  | { tipo: "em_andamento" }
  /** O hook falhou: a versão ficou marcada como "falhou" (nunca é servida). A tela usa `versaoBase` na nova tentativa. */
  | { tipo: "falha_disparo"; versaoBase: number }
  | { tipo: "sem_conteudo" };

const SEM_ESTADO = Symbol("sem conteúdo publicado");
const entradaSchema = z.object({ bloco: z.custom<Bloco>(ehBloco), versaoBase: z.number().int().min(0) });

/** SQLSTATE e constraint do erro do Postgres (o Drizzle o embrulha em `cause`). */
function erroPg(e: unknown): { code?: string; constraint?: string } {
  const err = ((e as { cause?: unknown })?.cause ?? e) as { code?: string; constraint?: string };
  return { code: err.code, constraint: err.constraint };
}

/**
 * Publica UM bloco (RN-LOJ-26, HU-13). Quem chama precisa ser admin (P-15): `exigirPapel` aqui dentro, não só na rota.
 *
 * 1. valida o bloco com as regras do build.mjs; 2. numa transação: libera pendente presa, monta a versão nova
 * (última publicada + bloco editado) e grava com checagem de `versaoBase`; 3. depois do COMMIT, chama o deploy hook com
 * timeout; 4. marca aceito ou falhou. Versão que não foi aceita nunca é lida por `obterPublicado` (CA-LOJ-55).
 */
export async function publicar(entrada: { bloco: unknown; dados: unknown; versaoBase: unknown }): Promise<ResultadoPublicacao> {
  const usuario = await exigirPapel(PAPEL_CONTEUDO);

  const cabecalho = entradaSchema.safeParse(entrada);
  if (!cabecalho.success) return { tipo: "invalido", erros: [{ caminho: "", mensagem: "Pedido inválido. Recarregue a página." }] };
  const { bloco, versaoBase } = cabecalho.data;
  const dados = BLOCOS[bloco].schema.safeParse(entrada.dados);
  if (!dados.success) return { tipo: "invalido", erros: errosDe(dados.error) };

  let numero: number;
  try {
    numero = await db.transaction(async (tx) => {
      // 0) pendente presa (processo morreu entre o COMMIT e o hook) deixa de bloquear
      await tx.execute(sql`
        update conteudo_versoes set disparo_estado = 'falhou', disparo_em = now(), disparo_erro = 'expirada sem disparo'
         where disparo_estado = 'pendente' and criado_em < now() - make_interval(mins => ${PENDENTE_EXPIRA_MIN})`);
      // 1) base do conteúdo = última aceita (uma tentativa que falhou nunca vaza para a próxima)
      const [base] = await tx
        .select({ conteudo: conteudoVersoes.conteudo })
        .from(conteudoVersoes)
        .where(eq(conteudoVersoes.disparoEstado, "aceito"))
        .orderBy(desc(conteudoVersoes.numero))
        .limit(1);
      if (!base) throw SEM_ESTADO;
      const novo = comFatia(conteudoSchema.parse(base.conteudo), bloco, dados.data);
      // 2) grava só se a base da tela ainda é o maior número; 0 linhas = alguém publicou antes
      const r = await tx.execute<{ numero: number }>(sql`
        insert into conteudo_versoes (numero, conteudo, blocos_alterados, origem, autor_id)
        select ${versaoBase}::int + 1, ${JSON.stringify(novo)}::jsonb, array[${bloco}]::text[], 'painel', ${usuario.id}
         where (select coalesce(max(numero), 0) from conteudo_versoes) = ${versaoBase}::int
        returning numero`);
      const linha = r.rows[0];
      if (!linha) throw new ConflitoDeVersao();
      return linha.numero;
    });
  } catch (e) {
    if (e === SEM_ESTADO) return { tipo: "sem_conteudo" };
    const { code, constraint } = erroPg(e);
    if (code === "23505" && constraint === "conteudo_versoes_uma_pendente_uk") return { tipo: "em_andamento" };
    if (e instanceof ConflitoDeVersao || code === "23505" || code === "23514") return conflito(bloco, versaoBase);
    throw e;
  }

  // 3) fora da transação: a versão já está gravada como pendente
  const disparo = await dispararSite();
  try {
    const [marcada] = await db
      .update(conteudoVersoes)
      .set(
        disparo.estado === "aceito"
          ? { disparoEstado: "aceito", disparoEm: sql`now()`, disparoErro: disparo.nota ?? null }
          : { disparoEstado: "falhou", disparoEm: sql`now()`, disparoErro: disparo.erro },
      )
      .where(and(eq(conteudoVersoes.numero, numero), eq(conteudoVersoes.disparoEstado, "pendente")))
      .returning({ numero: conteudoVersoes.numero });
    if (disparo.estado === "aceito" && marcada) {
      return { tipo: "publicado", numero, ...(disparo.nota ? { aviso: "Este ambiente não tem o disparo do site configurado: a publicação foi gravada, mas o site não foi atualizado." } : {}) };
    }
  } catch {
    // não conseguiu marcar: a versão fica pendente e expira sozinha; para a pessoa é falha (nada foi servido)
  }
  console.error(`[conteudo-site] versão ${numero} não publicada: ${disparo.estado === "falhou" ? disparo.erro : "estado não atualizado"}`);
  return { tipo: "falha_disparo", versaoBase: numero };
}

class ConflitoDeVersao extends Error {}

async function conflito(bloco: Bloco, versaoBase: number): Promise<ResultadoPublicacao> {
  const [desde, atual, sit] = await Promise.all([
    db
      .select({ blocos: conteudoVersoes.blocosAlterados })
      .from(conteudoVersoes)
      .where(and(gt(conteudoVersoes.numero, versaoBase), ne(conteudoVersoes.disparoEstado, "falhou"))),
    obterPublicado(),
    situacao(),
  ]);
  const blocosAlterados = SLUGS.filter((s) => desde.some((d) => d.blocos.includes(s)));
  return { tipo: "conflito", versaoBase: sit.versaoBase, blocosAlterados, mesmoBloco: blocosAlterados.includes(bloco), atual: atual ? fatia(atual.conteudo, bloco) : null };
}
