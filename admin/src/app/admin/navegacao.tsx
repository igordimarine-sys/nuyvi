"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ListItemButton from "@mui/material/ListItemButton";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { cor, LARGURA_MENU, raio } from "./tokens";

export type IconeNav = "inicio" | "conteudo" | "historico";
export type ItemNav = { href: string; rotulo: string; icone: IconeNav; filhos?: { href: string; rotulo: string; icone: IconeNav }[] };

// Ícones (Material Symbols, 24 px) só como enfeite: o texto do item é o nome acessível.
const ICONES: Record<IconeNav, ReactNode> = {
  inicio: <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />,
  conteudo: <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />,
  historico: <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.95 8.95 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />,
};
const Icone = ({ nome }: { nome: IconeNav }) => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">{ICONES[nome]}</svg>;

const navSx = {
  display: "flex", alignItems: "center", gap: "10px", p: "9px 12px", minHeight: 40, borderRadius: `${raio.sm}px`, color: cor.textSec,
  fontSize: 13.5, fontWeight: 500, mb: "2px", borderLeft: "3px solid transparent", transition: "all .15s",
  "& svg": { width: 17, height: 17, flexShrink: 0, opacity: 0.75 },
  "&:hover": { background: cor.borderLight, color: cor.text },
  "&.Mui-selected, &.Mui-selected:hover": { background: cor.primaryLight, color: cor.primary, borderLeftColor: cor.primary, fontWeight: 600 },
  "&.Mui-selected svg": { opacity: 1 },
} as const;

const Secao = ({ children }: { children: ReactNode }) => (
  <Typography component="p" sx={{ fontSize: 10.5, fontWeight: 700, color: cor.textMuted, textTransform: "uppercase", letterSpacing: ".8px", p: "10px 12px 6px" }}>{children}</Typography>
);

/** Sair do painel: volta para a entrada da equipe. */
function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  return (
    <Box component="button" type="button" disabled={saindo}
      onClick={async () => { setSaindo(true); await authClient.signOut(); router.push("/admin/login"); router.refresh(); }}
      sx={{ border: 0, background: "none", cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 700, color: cor.primary, p: "8px 4px", minHeight: 40, borderRadius: `${raio.sm}px`, "&:hover": { textDecoration: "underline" }, "&:disabled": { opacity: 0.6, cursor: "progress" } }}>
      {saindo ? "Saindo..." : "Sair"}
    </Box>
  );
}

// Barra lateral fixa (≥ 768 px); no celular, botão de menu no canto e a barra desliza por cima do conteúdo.
// Só recebe os itens que o papel pode usar; esconder o item é cortesia, a barreira real é no servidor (CA-LOJ-56).
export function Navegacao({ itens, nome, email }: { itens: ItemNav[]; nome: string; email: string }) {
  const atual = usePathname();
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);
  const ativo = (href: string) => (href === "/admin" ? atual === href : atual === href || atual.startsWith(`${href}/`));
  // aria-current="page" no item da página; o pai só quando o filho (Histórico) não é a página atual
  const corrente = (i: { href: string }, filho: boolean) => atual === i.href || (!filho && i.href !== "/admin" && atual.startsWith(`${i.href}/`) && !itens.some((p) => p.filhos?.some((f) => f.href === atual)));

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto]);

  const link = (i: { href: string; rotulo: string; icone: IconeNav }, filho = false) => (
    <ListItemButton component={Link} href={i.href} selected={corrente(i, filho)} aria-current={corrente(i, filho) ? "page" : undefined}
      onClick={fechar} sx={filho ? { ...navSx, ml: "14px", fontSize: 13 } : navSx}>
      <Icone nome={i.icone} />
      {i.rotulo}
    </ListItemButton>
  );

  return (
    <>
      <IconButton aria-label="Abrir menu" aria-expanded={aberto} aria-controls="menu-painel" onClick={() => setAberto(true)}
        sx={{ display: { xs: "flex", md: "none" }, position: "fixed", top: 10, left: 12, zIndex: 1200, border: `1px solid ${cor.border}`, background: cor.card, color: cor.textSec, "&:hover": { background: cor.card, color: cor.text } }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
      </IconButton>
      {aberto && <Box onClick={fechar} aria-hidden="true" sx={{ display: { md: "none" }, position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1250 }} />}
      <Box component="aside" id="menu-painel"
        sx={{
          width: LARGURA_MENU, background: cor.card, borderRight: `1px solid ${cor.border}`, display: "flex", flexDirection: "column",
          position: "fixed", left: 0, top: 0, bottom: 0, zIndex: { xs: 1300, md: 1000 }, overflowY: "auto", transition: "transform .2s ease",
          transform: { xs: aberto ? "none" : "translateX(-100%)", md: "none" },
          visibility: { xs: aberto ? "visible" : "hidden", md: "visible" }, // fechada no celular, sai também da ordem de foco
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}>
        <Box component={Link} href="/admin" onClick={fechar} sx={{ p: "18px 16px 16px", borderBottom: `1px solid ${cor.borderLight}`, display: "flex", alignItems: "center", gap: "10px", color: "inherit", textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático do site */}
          <img src="/img/logo-header.webp" alt="" width={68} height={28} style={{ height: 28, width: "auto" }} />
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, color: cor.textSec, borderLeft: `1px solid ${cor.border}`, pl: "10px" }}>
            <span className="so-leitor">N.UY, </span>Painel
          </Typography>
        </Box>
        <Box component="nav" aria-label="Painel" sx={{ flex: 1, p: "10px 8px" }}>
          <Secao>Loja</Secao>
          {itens.map((i) => (
            <div key={i.href}>
              {link(i)}
              {i.filhos && ativo(i.href) && i.filhos.map((f) => <div key={f.href}>{link(f, true)}</div>)}
            </div>
          ))}
          <Secao>Atalhos</Secao>
          <ListItemButton component="a" href="/" target="_blank" rel="noopener" sx={navSx}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" /></svg>
            Ver o site<span className="so-leitor"> (abre em nova aba)</span>
          </ListItemButton>
        </Box>
        <Box sx={{ p: "12px 14px", borderTop: `1px solid ${cor.borderLight}`, display: "flex", alignItems: "center", gap: "10px" }}>
          <Avatar aria-hidden="true" sx={{ width: 32, height: 32, background: cor.porDoSol, color: cor.bg, fontSize: 13, fontWeight: 800 }}>{nome.trim().charAt(0).toUpperCase() || "?"}</Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography noWrap title={nome} sx={{ fontSize: 12.5, fontWeight: 600 }}>{nome}</Typography>
            <Typography noWrap title={email} sx={{ fontSize: 11, color: cor.textMuted }}>{email}</Typography>
          </Box>
          <BotaoSair />
        </Box>
      </Box>
    </>
  );
}

/** <main> do painel. Em /admin/login perde a margem da barra e o padding (tela de conta em tela cheia). */
export function Conteudo({ children }: { children: ReactNode }) {
  const auth = usePathname() === "/admin/login";
  return <main id="principal" className={auth ? "painel-conteudo painel-conteudo-auth" : "painel-conteudo"}>{children}</main>;
}
