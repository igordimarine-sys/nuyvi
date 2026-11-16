import "server-only";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conteudoVersoes } from "@/db/schema";
import { exigirPapel } from "@/modules/contas/papeis";
import { obterPublicado, situacao } from "./leitura";
import { PAPEL_CONTEUDO } from "./permissao";
import { BLOCOS, comFatia, conteudoSchema, ehBloco, errosDe, fatia, SLUGS, type Bloco } from "./schema";

export type ResultadoPublicacao =
  /** Versão gravada e aceita. Quem chama revalida a página do site (a action, `updateTag`); este módulo não conhece o Next. */
  | { tipo: "publicado"; numero: number }
  | { tipo: "invalido"; erros: { caminho: string; mensagem: string }[] }
  /** Alguém publicou depois que a tela abriu. `atual` é o bloco publicado agora; `versaoBase` é a base para reenviar. */
  | { tipo: "conflito"; versaoBase: number; blocosAlterados: Bloco[]; mesmoBloco: boolean; atual: unknown }
  | { tipo: "sem_conteudo" };

const SEM_ESTADO = Symbol("sem conteúdo publicado");
const entradaSchema = z.object({ bloco: z.custom<Bloco>(ehBloco), versaoBase: z.number().int().min(0) });

/** SQLSTATE do erro do Postgres (o Drizzle o embrulha em `cause`). */
function erroPg(e: unknown): { code?: string } {
  const err = ((e as { cause?: unknown })?.cause ?? e) as { code?: string };
  return { code: err.code };
}

/**
 * Publica UM bloco (RN-LOJ-26, HU-13). Quem chama precisa ser admin (P-15): `exigirPapel` aqui dentro, não só na rota.
 *
 * 1. valida o bloco com as regras de pagina.ts; 2. numa transação: monta a versão nova (última publicada + bloco
 * editado) e grava já como aceita, com checagem de `versaoBase` (ADR-0007: sem disparo externo).
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
        insert into conteudo_versoes (numero, conteudo, blocos_alterados, origem, autor_id, disparo_estado, disparo_em)
        select ${versaoBase}::int + 1, ${JSON.stringify(novo)}::jsonb, array[${bloco}]::text[], 'painel', ${usuario.id}, 'aceito', now()
         where (select coalesce(max(numero), 0) from conteudo_versoes) = ${versaoBase}::int
        returning numero`);
      const linha = r.rows[0];
      if (!linha) throw new ConflitoDeVersao();
      return linha.numero;
    });
  } catch (e) {
    if (e === SEM_ESTADO) return { tipo: "sem_conteudo" };
    const { code } = erroPg(e);
    if (e instanceof ConflitoDeVersao || code === "23505" || code === "23514") return conflito(bloco, versaoBase);
    throw e;
  }

  return { tipo: "publicado", numero };
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
