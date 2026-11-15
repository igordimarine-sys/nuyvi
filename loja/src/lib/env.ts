import "server-only";
import { z } from "zod";

// Variável opcional: vazia (ex.: `NOME=` no .env) vale como ausente. A mensagem de erro nunca ecoa o valor.
const opcional = <T extends z.ZodType>(t: T) => z.preprocess((v) => (v === "" ? undefined : v), t.optional());

const schema = z.object({
  DATABASE_URL: z
    .string({ error: "DATABASE_URL é obrigatória (veja .env.example)" })
    .min(1, "DATABASE_URL está vazia")
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL deve começar com postgres:// ou postgresql://"),
  // Segredo do Better Auth (assina tokens de confirmação de e-mail). Gerar: openssl rand -base64 32. Um por ambiente.
  BETTER_AUTH_SECRET: z
    .string({ error: "BETTER_AUTH_SECRET é obrigatória (veja .env.example)" })
    .min(32, "BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres"),
  // URL pública da loja (origem dos links de e-mail e das checagens de origem/CSRF).
  BETTER_AUTH_URL: z.url({ error: "BETTER_AUTH_URL deve ser uma URL (ex.: http://localhost:3000)" }),
  // Deploy hook do projeto Vercel do site (ADR-0006). É SEGREDO: quem tem a URL dispara builds. Só em Production.
  // Sem ela (local, Preview) publicar grava a versão e avisa que o site não foi atualizado; em produção sem ela a publicação falha.
  // Local: pode apontar para o `yarn dev:painel` do site (http://127.0.0.1:8765/__publicado); http só para localhost e fora de produção.
  SITE_DEPLOY_HOOK_URL: opcional(z.url({ protocol: /^https?$/, error: "SITE_DEPLOY_HOOK_URL deve ser uma URL https" })),
  // Endereço público do site: só para mostrar a miniatura das fotos que já estão em site/img/ no painel de conteúdo.
  SITE_PUBLIC_URL: opcional(z.url({ error: "SITE_PUBLIC_URL deve ser uma URL (ex.: https://nuyvi.vercel.app)" })),
  // Definida pela Vercel (production | preview | development); distingue Production de Preview, que têm NODE_ENV igual.
  VERCEL_ENV: opcional(z.enum(["production", "preview", "development"])),
}).refine((e) => !e.SITE_DEPLOY_HOOK_URL || e.SITE_DEPLOY_HOOK_URL.startsWith("https://") ||
  ((e.VERCEL_ENV ?? process.env.NODE_ENV) !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(e.SITE_DEPLOY_HOOK_URL)), {
  path: ["SITE_DEPLOY_HOOK_URL"],
  message: "SITE_DEPLOY_HOOK_URL deve ser uma URL https (http só para localhost, fora de produção)",
}).refine((e) => process.env.NODE_ENV !== "production" || /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:|\/|$))/.test(e.BETTER_AUTH_URL), {
  path: ["BETTER_AUTH_URL"],
  message: "BETTER_AUTH_URL deve começar com https:// em produção (http só para localhost)",
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detalhes = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Variáveis de ambiente inválidas:\n${detalhes}`);
}

export const env = parsed.data;

/** Produção de verdade: na Vercel só `VERCEL_ENV=production` (Preview também roda com NODE_ENV=production); fora dela, NODE_ENV. */
export const emProducao = () => (env.VERCEL_ENV ?? process.env.NODE_ENV) === "production";
