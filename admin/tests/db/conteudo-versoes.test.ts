import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { conteudoVersoes, user } from "@/db/schema";
import { criarUsuario, violacao } from "../fabricas";

const CHECK = "23514";
const UNIQUE = "23505";
const DOCS = { textos: {}, loja: {}, explore: {}, novidades: {}, planos: {} };

const nova = (numero: number, extra: Partial<typeof conteudoVersoes.$inferInsert> = {}) => ({
  numero,
  conteudo: DOCS,
  blocosAlterados: ["historia"],
  ...extra,
});
const aceitar = (numero: number) =>
  db.update(conteudoVersoes).set({ disparoEstado: "aceito", disparoEm: new Date() }).where(eq(conteudoVersoes.numero, numero));

// Garantias do banco (drizzle/0002): versões imutáveis, sequência sem buracos, uma publicação em curso.
describe("conteudo_versoes (ADR-0006)", () => {
  it("a mesma versão base só publica uma vez e a sequência não tem buracos", async () => {
    await db.insert(conteudoVersoes).values(nova(1, { disparoEstado: "aceito", disparoEm: new Date() }));
    await db.insert(conteudoVersoes).values(nova(2, { disparoEstado: "aceito", disparoEm: new Date() }));
    // base já avançada: o trigger recusa (23514); só na corrida real entre transações a PK responde (23505)
    expect((await violacao(() => db.insert(conteudoVersoes).values(nova(2))))?.code).toBe(CHECK);
    const [a, b] = await Promise.all([
      violacao(() => db.transaction((tx) => tx.insert(conteudoVersoes).values(nova(3, { disparoEstado: "aceito", disparoEm: new Date() })))),
      violacao(() => db.transaction((tx) => tx.insert(conteudoVersoes).values(nova(3, { disparoEstado: "aceito", disparoEm: new Date() })))),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect([a, b].find(Boolean)?.code).toMatch(new RegExp(`^(${UNIQUE}|${CHECK})$`));
    expect((await violacao(() => db.insert(conteudoVersoes).values(nova(9))))?.code).toBe(CHECK);
  });

  it("só uma publicação pendente por vez", async () => {
    await db.insert(conteudoVersoes).values(nova(1));
    const erro = await violacao(() => db.insert(conteudoVersoes).values(nova(2)));
    expect(erro).toEqual({ code: UNIQUE, constraint: "conteudo_versoes_uma_pendente_uk" });
  });

  it("conteúdo, blocos e estado são validados", async () => {
    expect((await violacao(() => db.insert(conteudoVersoes).values(nova(1, { conteudo: { textos: {} } }))))?.constraint).toBe("conteudo_versoes_conteudo_ck");
    expect((await violacao(() => db.insert(conteudoVersoes).values(nova(1, { blocosAlterados: ["rodape"] }))))?.constraint).toBe("conteudo_versoes_blocos_ck");
    expect((await violacao(() => db.insert(conteudoVersoes).values(nova(1, { disparoEstado: "aceito" }))))?.constraint).toBe("conteudo_versoes_disparo_coerente_ck");
  });

  it("só o disparo muda, uma vez; versão não é editada nem apagada", async () => {
    await db.insert(conteudoVersoes).values(nova(1));
    expect((await violacao(() => db.update(conteudoVersoes).set({ conteudo: { ...DOCS, textos: { a: 1 } } })))?.code).toBe(CHECK);
    await aceitar(1);
    expect((await violacao(() => db.update(conteudoVersoes).set({ disparoEstado: "falhou", disparoEm: new Date() })))?.code).toBe(CHECK);
    expect((await violacao(() => db.delete(conteudoVersoes)))?.code).toBe(CHECK);
    const [v] = await db.select().from(conteudoVersoes);
    expect(v?.disparoEstado).toBe("aceito");
  });

  it("apagar a conta do autor preserva a versão (autor_id vira NULL)", async () => {
    const u = await criarUsuario();
    await db.insert(conteudoVersoes).values(nova(1, { autorId: u.id }));
    await db.delete(user).where(eq(user.id, u.id));
    const [v] = await db.select().from(conteudoVersoes);
    expect(v?.autorId).toBeNull();
  });

  it("leitura pública: maior número com disparo aceito", async () => {
    await db.insert(conteudoVersoes).values(nova(1, { disparoEstado: "aceito", disparoEm: new Date() }));
    await db.insert(conteudoVersoes).values(nova(2));
    await db.update(conteudoVersoes).set({ disparoEstado: "falhou", disparoEm: new Date(), disparoErro: "timeout" }).where(eq(conteudoVersoes.numero, 2));
    const r = await db.execute(sql`select numero from conteudo_versoes where disparo_estado = 'aceito' order by numero desc limit 1`);
    expect(r.rows[0]).toEqual({ numero: 1 });
  });
});
