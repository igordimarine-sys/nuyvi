// Banco dos testes: SEPARADO do de desenvolvimento (`loja`). O vitest.config.mts define TEST_DATABASE_URL
// (padrão: database `loja_test` no contêiner do docker-compose; em CI, o service container).
export const URL_TESTE = process.env.TEST_DATABASE_URL ?? "";

/** Aborta se a URL não for claramente de um banco de teste (nome do database precisa conter "test"). */
export function exigirBancoDeTeste(url: string): URL {
  const u = new URL(url);
  const nome = decodeURIComponent(u.pathname.slice(1));
  if (!/test/i.test(nome)) {
    throw new Error(`Recusado: o banco "${nome}" não parece de teste (o nome precisa conter "test"). Defina TEST_DATABASE_URL.`);
  }
  return u;
}
