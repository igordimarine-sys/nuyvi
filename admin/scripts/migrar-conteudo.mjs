// Grava a versão 1 do conteúdo do site (ADR-0006) a partir de scripts/conteudo-inicial/*.json: origem 'migracao', disparo 'aceito',
// os 9 blocos, sem autor. Idempotente: se já existir QUALQUER versão, não grava nada. Os caminhos de imagem (img/...)
// continuam valendo, nenhuma imagem é copiada.
//   npm run conteudo:migrar              (usa scripts/conteudo-inicial)
//   npm run conteudo:migrar -- <pasta>   (outra pasta com os 5 JSON)
// O cartão da Loja ganha `destino: "inicio"` (página inicial da loja, CA-LOJ-58). Só conteúdo de vitrine; sem segredo nem dado pessoal.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const BLOCOS = ["abertura", "parceiros", "planos", "bonus", "historia", "explore", "loja", "novidades", "baixar"];
const pasta = process.argv[2] ?? fileURLToPath(new URL("./conteudo-inicial/", import.meta.url));
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida (use .env.local ou a variável do ambiente).");
  process.exit(1);
}

const ler = (nome) => JSON.parse(readFileSync(`${pasta.replace(/\/$/, "")}/${nome}.json`, "utf8"));
const loja = ler("loja");
const conteudo = {
  textos: ler("textos"),
  loja: { ...loja, produtos: loja.produtos.map((p) => ({ ...p, destino: p.destino ?? "inicio" })) },
  explore: ler("explore"),
  novidades: ler("novidades"),
  planos: ler("planos"),
};

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query("select count(*)::int as n from conteudo_versoes");
    if (rows[0].n > 0) {
      await client.query("rollback");
      console.log("Já existe versão do conteúdo; nada foi gravado.");
    } else {
      await client.query(
        `insert into conteudo_versoes (numero, conteudo, blocos_alterados, origem, disparo_estado, disparo_em)
         values (1, $1::jsonb, $2::text[], 'migracao', 'aceito', now())`,
        [JSON.stringify(conteudo), BLOCOS],
      );
      await client.query("commit");
      console.log("Versão 1 do conteúdo gravada (9 blocos).");
    }
  } catch (e) {
    await client.query("rollback").catch(() => {});
    // corrida com outra execução: a PK impede a duplicata, o resultado é o mesmo de "já existe"
    if (e?.code === "23505") console.log("Já existe versão do conteúdo; nada foi gravado.");
    else throw e;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
