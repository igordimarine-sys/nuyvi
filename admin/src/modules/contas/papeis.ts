import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PAPEIS, type Papel } from "@/db/schema";
import { auth } from "@/lib/auth";

// Hierarquia: admin pode tudo que operador pode; operador pode tudo que cliente pode.
const NIVEL: Record<Papel, number> = { cliente: 0, operador: 1, admin: 2 };
const papelSchema = z.enum(PAPEIS);

/** O usuário tem o papel mínimo (hierarquia acima)? Só confere; quem barra é `exigirPapel`. */
export const atende = (usuario: { papel: Papel }, minimo: Papel) => NIVEL[usuario.papel] >= NIVEL[minimo];

export type UsuarioAutenticado = { id: string; nome: string; email: string; papel: Papel; sessaoId: string };

/** Usuário da sessão atual (lida no banco a cada chamada, então mudança de papel vale na hora) ou null. */
export async function obterUsuario(): Promise<UsuarioAutenticado | null> {
  const sessao = await auth.api.getSession({ headers: await headers() });
  if (!sessao || !sessao.user.emailVerified) return null;
  const papel = papelSchema.safeParse(sessao.user.role);
  if (!papel.success) return null; // papel desconhecido: trata como sem acesso
  return { id: sessao.user.id, nome: sessao.user.name, email: sessao.user.email, papel: papel.data, sessaoId: sessao.session.id };
}

/**
 * Autorização no servidor: chamar no início de TODA página, Server Action e Route Handler protegido, e antes de
 * acessar dados. Sem sessão (ou e-mail não confirmado): vai para /login. Com papel insuficiente: 404.
 * O proxy/middleware não substitui esta chamada.
 */
export async function exigirPapel(minimo: Papel): Promise<UsuarioAutenticado> {
  const usuario = await obterUsuario();
  if (!usuario) redirect("/login");
  if (!atende(usuario, minimo)) notFound();
  return usuario;
}
