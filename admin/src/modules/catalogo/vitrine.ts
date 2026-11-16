import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Tag do cache da vitrine: quem salvar produto, foto, variação, preço, categoria ou estoque chama `updateTag(TAG_CATALOGO)` (ADR-0007 A3). */
export const TAG_CATALOGO = "catalogo";

export type ProdutoVitrine = {
  id: string;
  nome: string;
  categoria: string;
  fotoUrl: string | null;
  fotoAlt: string | null;
  /** Menor preço entre as variações ativas, em centavos. */
  precoCentavos: number;
  /** Os preços das variações ativas diferem: mostra "a partir de". */
  variaPreco: boolean;
  /** Todas as variações ativas sem saldo disponível (RN-LOJ-30). */
  esgotado: boolean;
};

/**
 * Lê a vitrine direto do banco (sem cache): produtos ativos, de categoria ativa e com pelo menos uma variação ativa. Foto = a de menor
 * `ordem`. Disponível = saldo físico − reservas vigentes (status `ativa` e `expira_em` no futuro; arquitetura §3); variação sem linha
 * de saldo conta como 0. Esgotado = nenhuma variação ativa com disponível > 0. Ordem: categoria (`ordem`), depois nome.
 */
export async function lerVitrine(): Promise<ProdutoVitrine[]> {
  const r = await db.execute<{
    id: string; nome: string; categoria: string; foto_url: string | null; foto_alt: string | null; menor: number; maior: number; disponivel: boolean;
  }>(sql`
    select p.id, p.nome, c.nome as categoria,
           (select f.url from produto_fotos f where f.produto_id = p.id order by f.ordem, f.id limit 1) as foto_url,
           (select f.alt from produto_fotos f where f.produto_id = p.id order by f.ordem, f.id limit 1) as foto_alt,
           min(v.preco_centavos) as menor, max(v.preco_centavos) as maior,
           bool_or(coalesce(s.fisico, 0) - coalesce(r.reservado, 0) > 0) as disponivel
      from produtos p
      join categorias c on c.id = p.categoria_id and c.ativa
      join variacoes v on v.produto_id = p.id and v.ativa
      left join estoque_saldos s on s.variacao_id = v.id
      left join lateral (
        select sum(er.quantidade)::int as reservado from estoque_reservas er
         where er.variacao_id = v.id and er.status = 'ativa' and er.expira_em > now()
      ) r on true
     where p.ativo
     group by p.id, c.id
     order by c.ordem, c.nome, p.nome, p.id`);
  return r.rows.map((l) => ({
    id: l.id,
    nome: l.nome,
    categoria: l.categoria,
    fotoUrl: l.foto_url,
    fotoAlt: l.foto_alt,
    precoCentavos: Number(l.menor),
    variaPreco: Number(l.maior) !== Number(l.menor),
    esgotado: !l.disponivel,
  }));
}

/** A vitrine em cache (`max`): só muda quando alguém revalida a tag. Erro do banco propaga: nada de vitrine vazia por falha. */
export async function vitrine(): Promise<ProdutoVitrine[]> {
  "use cache";
  cacheTag(TAG_CATALOGO);
  cacheLife("max");
  return lerVitrine();
}
