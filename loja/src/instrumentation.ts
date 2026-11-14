// Valida as variáveis de ambiente quando o servidor sobe (falha clara em vez de erro na 1ª consulta).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
