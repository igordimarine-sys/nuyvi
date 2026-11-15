import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Banco dos testes: SEPARADO do de desenvolvimento (`loja`). Padrão: database `loja_test` no contêiner do
// docker-compose (credenciais do compose local, não são segredo). Em CI, TEST_DATABASE_URL aponta para o service container.
const URL_TESTE = (process.env.TEST_DATABASE_URL ??= "postgres://loja:loja_dev_local@127.0.0.1:5436/loja_test");
if (!/test/i.test(decodeURIComponent(new URL(URL_TESTE).pathname.slice(1)))) {
  throw new Error("TEST_DATABASE_URL precisa apontar para um database cujo nome contenha 'test'.");
}
const caminho = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": caminho("./src"),
      "server-only": caminho("./tests/stubs/server-only.ts"), // `server-only` lança fora do bundler do Next
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Valores fictícios; o env.ts exige estes três. Nunca usar segredos reais aqui.
    env: {
      DATABASE_URL: URL_TESTE,
      BETTER_AUTH_SECRET: "teste-nao-e-segredo-0123456789abcdef0123456789",
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_BLOB_HOST: "abc123.public.blob.vercel-storage.com", // fictício
      TZ: "America/Sao_Paulo",
    },
    // Um único banco compartilhado e isolamento por TRUNCATE: arquivos rodam em série.
    fileParallelism: false,
  },
});
