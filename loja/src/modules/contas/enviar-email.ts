import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type EmailConta = {
  tipo: "confirmar_email" | "redefinir_senha" | "tentativa_cadastro_existente" | "vincular_pedidos";
  para: string;
  link?: string; // contém o token: nunca vai para log
};

// PONTO ÚNICO de envio de e-mail de conta. Ainda sem provedor (pendência do dev-notifications).
// - Desenvolvimento: grava o e-mail em `.dev-outbox/` (ignorado pelo Git) para o teste manual.
// - Outros ambientes: registra só o tipo (sem destinatário, sem link/token) e NÃO envia.
// Chamar sem `await` (o Better Auth recomenda, para não revelar pela latência se o e-mail existe).
export function enviarEmailConta(email: EmailConta): void {
  void entregar(email).catch(() => console.error(`[email-conta] falha ao registrar e-mail do tipo ${email.tipo}`));
}

async function entregar(email: EmailConta): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    const dir = join(process.cwd(), ".dev-outbox");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${Date.now()}-${email.tipo}.json`), JSON.stringify(email, null, 2));
    return;
  }
  console.warn(`[email-conta] provedor de e-mail não configurado; e-mail ${email.tipo} não enviado`);
}
