import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env, googleConfigurado } from "@/lib/env";
import { enviarEmailConta } from "@/modules/contas/enviar-email";

const MIN = 60;
const regra = (max: number) => ({ window: MIN, max }); // por IP e rota, janela de 1 minuto

// Google é só para clientes: conta de equipe não vincula nem entra por ele (fica na senha e, depois, no MFA).
// Usuário ainda não encontrado = cadastro novo pelo Google (sempre cliente: `role` tem input: false).
const CONTA_EQUIPE = "CONTA_EQUIPE";
async function recusarEquipe(userId: string) {
  const [u] = await db.select({ role: schema.user.role }).from(schema.user).where(eq(schema.user.id, userId));
  if (u && u.role !== "cliente") throw new APIError("FORBIDDEN", { code: CONTA_EQUIPE, message: "Conta da equipe entra só por /admin/login." });
}
// Rotas em que a sessão nasce de login social (retorno do Google ou idToken enviado direto a /sign-in/social).
const loginSocial = (path?: string) => !!path && (path.includes("/callback/") || path.endsWith("/sign-in/social"));

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  user: {
    // Papel só muda por script/banco: input: false impede que cadastro ou atualização de perfil o definam.
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "cliente", input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // sem e-mail confirmado não há sessão
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 30 * MIN,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      enviarEmailConta({ tipo: "redefinir_senha", para: user.email, link: url });
    },
    // Cadastro com e-mail existente devolve a mesma resposta; o dono da conta é avisado por e-mail.
    onExistingUserSignUp: async ({ user }) => {
      enviarEmailConta({ tipo: "tentativa_cadastro_existente", para: user.email });
    },
  },
  emailVerification: {
    expiresIn: 60 * MIN,
    sendVerificationEmail: async ({ user, url }) => {
      enviarEmailConta({ tipo: "confirmar_email", para: user.email, link: url });
    },
    // Sem vínculo automático de pedidos aqui (A-01 da auditoria): e-mail confirmado não prova que quem conhece
    // a senha é o dono da caixa postal. O vínculo é ação explícita (modules/contas/vincular-pedidos.ts).
  },
  socialProviders: googleConfigurado
    ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!, prompt: "select_account",
        requireEmailVerification: true } } // Google sem email_verified: sem sessão (mesma regra do cadastro por senha)
    : {},
  account: {
    encryptOAuthTokens: true, // tokens do Google cifrados com o segredo da lib (a loja não os usa)
    // Vincula o Google a conta existente só se o Google atesta o e-mail E a conta local já confirmou o e-mail:
    // conta não confirmada pode ter sido cadastrada por outra pessoa com senha conhecida (pré-sequestro).
    accountLinking: { enabled: true, requireLocalEmailVerified: true },
  },
  databaseHooks: {
    account: { create: { before: async (a) => { if (a.providerId !== "credential") await recusarEquipe(a.userId); } } },
    session: { create: { before: async (s, ctx) => { if (loginSocial(ctx?.path)) await recusarEquipe(s.userId); } } },
  },
  verification: { storeIdentifier: "hashed" }, // tokens de redefinição guardados com hash
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: true, // inclusive em desenvolvimento
    storage: "database", // contador na tabela rate_limit (memória não é compartilhada em serverless)
    window: 10,
    max: 100,
    customRules: {
      "/sign-in/email": regra(5),
      "/sign-up/email": regra(5),
      "/request-password-reset": regra(3),
      "/reset-password": regra(5),
      "/send-verification-email": regra(3),
      "/sign-in/social": regra(10),
      "/callback/*": regra(10),
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    // IP para rate limit e sessão. Produção (Vercel): só o header que a plataforma define; o cliente não o controla.
    // Local não tem esse header: usa x-forwarded-for (sem proxy, a lib cai em 127.0.0.1 fora de produção).
    ipAddress: { ipAddressHeaders: [process.env.NODE_ENV === "production" ? "x-vercel-forwarded-for" : "x-forwarded-for"] },
  },
  // haveIBeenPwned: rejeita senha vazada no cadastro/redefinição/troca; envia só os 5 primeiros caracteres do SHA-1
  // (k-anonimato) a api.pwnedpasswords.com; se o serviço cair, o cadastro falha (500) em vez de aceitar sem checar.
  plugins: [haveIBeenPwned(), nextCookies()], // nextCookies por último
});
