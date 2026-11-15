// Sessão corrente dos testes de conta. Os mocks que a leem ficam em tests/setup.ts.
export type SessaoFalsa = {
  user: { id: string; name: string; email: string; emailVerified: boolean; role: string };
  session: { id: string };
};

export const estado: { sessao: SessaoFalsa | null } = { sessao: null };
export const sessaoDe = (s: SessaoFalsa | null) => {
  estado.sessao = s;
};

export const sessao = (o: { id?: string; email?: string; role?: string; emailVerified?: boolean; sessaoId?: string } = {}): SessaoFalsa => ({
  user: { id: o.id ?? "u1", name: "Fulana de Teste", email: o.email ?? "fulana@exemplo.test", emailVerified: o.emailVerified ?? true, role: o.role ?? "cliente" },
  session: { id: o.sessaoId ?? "s1" },
});
