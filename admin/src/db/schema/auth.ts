import { bigint, boolean, check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { atualizadoEm, criadoEm, emLista } from "./comum";

// Tabelas do Better Auth (nomes de modelo e campos dele; colunas em snake_case). Ids são text (gerados pela lib).
// Conta de login da loja: separada da conta do app N.UY (RN-LOJ-21).
export const PAPEIS = ["cliente", "operador", "admin"] as const;
export type Papel = (typeof PAPEIS)[number];

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // [LGPD][PII]
    email: text("email").notNull().unique(), // [LGPD][PII] sempre em minúsculas (a lib normaliza)
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").notNull().default("cliente"), // nunca recebido da interface pública (input: false)
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  () => [check("user_role_ck", emLista("role", PAPEIS))],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"), // [LGPD][PII]
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(), // 'credential' = e-mail e senha
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"), // hash scrypt da lib; nunca a senha
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

// Tokens de redefinição e confirmação. Com `verification.storeIdentifier = "hashed"` o identificador (token) fica com hash.
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// Contador do rate limit (storage "database": funciona em serverless, onde memória não é compartilhada).
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
