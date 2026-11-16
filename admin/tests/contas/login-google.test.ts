import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { account, session, user } from "@/db/schema";
import { criarUsuario } from "../fabricas";

// Login com Google (CA-LOJ-81 a 87, RN-LOJ-31/32) pelo handler real do Better Auth. Só o endpoint de token do
// Google é simulado (devolve um id_token sem assinatura, como o fluxo de código aceita). Credenciais fictícias.
vi.unmock("@/lib/auth"); // tests/setup.ts troca por sessão falsa; aqui vale o Better Auth real
vi.stubEnv("GOOGLE_CLIENT_ID", "teste.apps.googleusercontent.com");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "nao-e-segredo");

const BASE = "http://localhost:3000/api/auth";
const ORIGEM = { origin: "http://localhost:3000", "content-type": "application/json" };
let auth: typeof import("@/lib/auth").auth;
let ip = 0; // IP novo a cada fluxo: o rate limit (10/min) não interfere

beforeAll(async () => {
  vi.resetModules(); // o env.ts já foi lido pelo setup sem as variáveis do Google (o pool do banco é reaproveitado)
  ({ auth } = await import("@/lib/auth"));
});
afterEach(() => vi.unstubAllGlobals());

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const cookiesDe = (r: Response) => r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

/** Inicia pelo /sign-in/social, "volta" do Google com um id_token para `email` e devolve o redirect final. */
async function entrarComGoogle(email: string, { verificado = true, volta = "/loja" } = {}) {
  const xff = { "x-forwarded-for": `10.0.0.${++ip}` };
  const ini = await auth.handler(new Request(`${BASE}/sign-in/social`, {
    method: "POST", headers: { ...ORIGEM, ...xff },
    body: JSON.stringify({ provider: "google", callbackURL: volta, errorCallbackURL: "/login" }),
  }));
  expect(ini.status).toBe(200);
  const url = new URL((await ini.json()).url);
  expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  expect(url.searchParams.get("redirect_uri")).toBe(`${BASE}/callback/google`);

  const idToken = `${b64({ alg: "none" })}.${b64({
    iss: "https://accounts.google.com", aud: "teste.apps.googleusercontent.com", sub: `sub-${email}`, email,
    email_verified: verificado, name: "Pessoa Google", nonce: url.searchParams.get("nonce") ?? undefined,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600,
  })}.x`;
  const fetchReal = globalThis.fetch;
  vi.stubGlobal("fetch", (alvo: RequestInfo | URL, init?: RequestInit) => String(alvo).startsWith("https://oauth2.googleapis.com/token")
    ? Promise.resolve(Response.json({ access_token: "at", id_token: idToken, token_type: "Bearer", expires_in: 3600 }))
    : fetchReal(alvo, init));

  const ret = await auth.handler(new Request(`${BASE}/callback/google?code=abc&state=${url.searchParams.get("state")}`, {
    headers: { cookie: cookiesDe(ini), ...xff },
  }));
  expect(ret.status).toBe(302);
  return { destino: ret.headers.get("location")!, cookie: cookiesDe(ret) };
}

const sessoesDe = async (userId: string) => db.select().from(session).where(eq(session.userId, userId));

describe("login com Google", () => {
  it("e-mail novo: cria cliente confirmado, com sessão, e volta para a página de origem", async () => {
    const r = await entrarComGoogle("nova@exemplo.com");
    expect(r.destino).toBe("/loja");
    const [u] = await db.select().from(user).where(eq(user.email, "nova@exemplo.com"));
    if (!u) throw new Error("usuário não criado");
    expect(u).toMatchObject({ role: "cliente", emailVerified: true });
    expect(await sessoesDe(u.id)).toHaveLength(1);
    const [a] = await db.select().from(account).where(eq(account.userId, u.id));
    if (!a) throw new Error("conta Google não criada");
    expect(a.providerId).toBe("google");
    expect(a.accessToken).not.toBe("at"); // cifrado
  });

  it("conta confirmada com o mesmo e-mail: vincula na mesma conta", async () => {
    const u = await criarUsuario({ email: "cli@exemplo.com", emailVerified: true });
    expect((await entrarComGoogle("cli@exemplo.com")).destino).toBe("/loja");
    expect((await db.select().from(account).where(eq(account.userId, u.id))).map((a) => a.providerId)).toContain("google");
    expect(await sessoesDe(u.id)).toHaveLength(1);
  });

  it("conta NÃO confirmada (possível pré-sequestro): não vincula nem entra", async () => {
    const u = await criarUsuario({ email: "pend@exemplo.com", emailVerified: false });
    expect((await entrarComGoogle("pend@exemplo.com")).destino).toBe("/login?error=account_not_linked");
    expect(await db.select().from(account).where(eq(account.userId, u.id))).toHaveLength(0);
    expect(await sessoesDe(u.id)).toHaveLength(0);
  });

  it("operador e admin: recusados, sem vínculo e sem sessão", async () => {
    for (const role of ["operador", "admin"] as const) {
      const u = await criarUsuario({ email: `${role}@exemplo.com`, emailVerified: true, role });
      expect((await entrarComGoogle(`${role}@exemplo.com`)).destino, role).toMatch(/^\/login\?error=CONTA_EQUIPE(&|$)/);
      expect(await db.select().from(account).where(eq(account.userId, u.id))).toHaveLength(0);
      expect(await sessoesDe(u.id)).toHaveLength(0);
    }
  });

  it("cliente que vinculou o Google e depois virou equipe: o login pelo Google é recusado", async () => {
    const u = await criarUsuario({ email: "promo@exemplo.com", emailVerified: true });
    await entrarComGoogle("promo@exemplo.com");
    await db.delete(session).where(eq(session.userId, u.id));
    await db.update(user).set({ role: "admin" }).where(eq(user.id, u.id));
    expect((await entrarComGoogle("promo@exemplo.com")).destino).toMatch(/^\/login\?error=CONTA_EQUIPE(&|$)/);
    expect(await sessoesDe(u.id)).toHaveLength(0);
  });

  it("Google sem e-mail verificado: sem sessão", async () => {
    const r = await entrarComGoogle("semverif@exemplo.com", { verificado: false });
    expect(r.destino).toBe("/login?error=email_not_verified");
    const [u] = await db.select().from(user).where(eq(user.email, "semverif@exemplo.com"));
    if (u) expect(await sessoesDe(u.id)).toHaveLength(0);
  });
  // Volta para outro site: o Better Auth recusa pela checagem de origem, que ele mesmo desliga em teste
  // (isTest() em create-context); a tela já manda só caminho saneado por voltaSegura.
});
