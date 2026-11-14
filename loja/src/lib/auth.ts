import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { enviarEmailConta } from "@/modules/contas/enviar-email";

const MIN = 60;
const regra = (max: number) => ({ window: MIN, max }); // por IP e rota, janela de 1 minuto

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
