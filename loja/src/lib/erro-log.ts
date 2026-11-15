/** Descrição segura de um erro para log: só a classe e o código (ex.: "Error 23505"). A mensagem do driver pode trazer SQL e parâmetros (conteúdo, ids). */
export function descreverErro(e: unknown): string {
  const causa = ((e as { cause?: unknown })?.cause ?? e) as { name?: string; code?: string };
  return `${causa?.name ?? "erro desconhecido"}${causa?.code ? ` ${causa.code}` : ""}`;
}
