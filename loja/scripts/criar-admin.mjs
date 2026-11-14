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
  const existente = (await pool.query('select id from "user" where email = $1', [email])).rows[0];
  if (existente) {
    await pool.query(`update "user" set role = 'admin', email_verified = true, updated_at = now() where id = $1`, [existente.id]);
    console.log("Usuário já existia: papel alterado para admin (senha mantida).");
  } else {
    const senha = await lerSenha();
    if (senha.length < 10 || senha.length > 128) throw new Error("A senha deve ter de 10 a 128 caracteres.");
    const id = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into "user" (id, name, email, email_verified, role) values ($1, $2, $3, true, 'admin')`,
        [id, nome, email],
      );
      await client.query(
        `insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`,
        [randomUUID(), id, await hashPassword(senha)],
      );
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
    console.log("Administrador criado.");
  }
} finally {
  await pool.end();
}
