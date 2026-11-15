// Cria (ou promove) o administrador da loja. Único caminho para virar admin: não existe rota pública para isso.
//   npm run admin:criar -- email@dominio.com "Nome"
// A senha é lida do terminal (sem eco) ou do stdin se não houver terminal (ex.: gerenciador de segredos).
// Nunca passe a senha como argumento nem a grave em arquivo versionado.
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const [emailArg, nome = "Administrador"] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Uso: npm run admin:criar -- email@dominio.com "Nome"');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida (use .env.local ou a variável do ambiente).");
  process.exit(1);
}

async function lerSenha() {
  if (!process.stdin.isTTY) {
    let dados = "";
    for await (const parte of process.stdin) dados += parte;
    return dados.replace(/\r?\n$/, "");
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (s.includes("\n")) process.stdout.write("\n"); }; // sem eco
  process.stdout.write("Senha (10 a 128 caracteres): ");
  const senha = await new Promise((res) => rl.question("", res));
  rl.close();
  return senha;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const existente = (await pool.query('select id, email_verified from "user" where email = $1', [email])).rows[0];
  // Conta existente e NÃO verificada pode ter sido cadastrada por outra pessoa (pré-sequestro): recusa, nunca a verifica.
  if (existente && !existente.email_verified) {
    throw new Error("Já existe uma conta com este e-mail e ela não foi verificada. Recusado: peça ao dono para confirmar o e-mail (ou apague a conta no banco) e rode de novo.");
  }
  const senha = await lerSenha();
  if (senha.length < 10 || senha.length > 128) throw new Error("A senha deve ter de 10 a 128 caracteres.");
  const hash = await hashPassword(senha);
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (existente) {
      // Conta verificada: promove, DEFINE nova senha (a atual pode ser de quem a cadastrou antes) e derruba as sessões.
      await client.query(`update "user" set role = 'admin', atualizado_em = now() where id = $1`, [existente.id]);
      const r = await client.query(`update account set password = $2, atualizado_em = now() where user_id = $1 and provider_id = 'credential'`, [existente.id, hash]);
      if (r.rowCount === 0) {
        await client.query(`insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`, [randomUUID(), existente.id, hash]);
      }
      await client.query("delete from session where user_id = $1", [existente.id]);
    } else {
      const id = randomUUID();
      await client.query(`insert into "user" (id, name, email, email_verified, role) values ($1, $2, $3, true, 'admin')`, [id, nome, email]);
      await client.query(`insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`, [randomUUID(), id, hash]);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  console.log(existente ? "Conta verificada promovida a admin; senha redefinida e sessões revogadas." : "Administrador criado.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
