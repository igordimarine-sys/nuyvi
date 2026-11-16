// Destino depois de entrar em /login ou /admin/login (RN-LOJ-29, CA-LOJ-75 a 77). Funções puras, sem `server-only`: o formulário (cliente) usa.

/** `volta` só vale se for caminho do próprio site: começa com uma única "/", sem "\", sem caractere de controle e fora das páginas de login. */
const ehLogin = (p: string) => ["/login", "/admin/login"].some((l) => p === l || p.startsWith(`${l}/`));

export function voltaSegura(volta: string | null | undefined): string | null {
  if (!volta || volta[0] !== "/" || volta[1] === "/" || volta[1] === "\\") return null;
  if (/[\\\u0000-\u001f\u007f]/.test(volta)) return null;
  let u: URL;
  try {
    u = new URL(volta, "https://site.invalido");
  } catch {
    return null;
  }
  if (u.origin !== "https://site.invalido" || ehLogin(u.pathname)) return null;
  return volta;
}

const dentroDeAdmin = (v: string) => /^\/admin(?:[/?#]|$)/.test(v);

/** Equipe vai para /admin (ou para a volta, se estiver dentro de /admin); cliente vai para a volta ou para "/". */
export function destinoDepoisDeEntrar(equipe: boolean, volta: string | null | undefined): string {
  const v = voltaSegura(volta);
  if (equipe) return v && dentroDeAdmin(v) ? v : "/admin";
  return v ?? "/";
}
