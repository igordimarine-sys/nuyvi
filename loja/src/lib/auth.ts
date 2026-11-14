import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { enviarEmailConta } from "@/modules/contas/enviar-email";
import { vincularPedidosDeVisitante } from "@/modules/contas/vincular-pedidos";

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
    // CA-LOJ-47: só depois do e-mail confirmado os pedidos de visitante com esse e-mail entram na conta.
    afterEmailVerification: async (user) => {
      await vincularPedidosDeVisitante(user.id, user.email);
    },
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
  },
  plugins: [nextCookies()], // por último
});
