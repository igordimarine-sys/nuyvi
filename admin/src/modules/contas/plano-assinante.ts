// Ponto de extensão do desconto de assinante (ADR-0002, arquitetura.md §5).
// MVP: sem integração com o Base44, então nunca há desconto. Só o checkout chama esta função.
// Para plugar depois, substitua apenas o corpo; em falha de consulta, retorne null.
export type PlanoVigente = {
  codigo: "silver" | "gold" | "premium";
  percentualDesconto: number;
} | null;

export async function obterPlanoVigente(clienteId: string | null): Promise<PlanoVigente> {
  void clienteId;
  return null;
}
