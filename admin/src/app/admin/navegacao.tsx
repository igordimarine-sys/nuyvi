"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BotaoSair } from "../formularios";

export type ItemNav = { href: string; rotulo: string; filhos?: { href: string; rotulo: string }[] };

// Barra lateral (≥ 768 px) ou barra superior com "Menu" (celular). Só recebe os itens que o papel pode usar;
// esconder o item é cortesia, a barreira real é no servidor (CA-LOJ-56).
export function Navegacao({ itens, nome }: { itens: ItemNav[]; nome: string }) {
  const atual = usePathname();
  const [aberto, setAberto] = useState(false);
  const ativo = (href: string) => (href === "/admin" ? atual === href : atual === href || atual.startsWith(`${href}/`));
  // aria-current="page" no item da página; o pai só quando o filho (Histórico) não é a página atual
  const corrente = (i: ItemNav, filho: boolean) => atual === i.href || (!filho && i.href !== "/admin" && atual.startsWith(`${i.href}/`) && !itens.some((p) => p.filhos?.some((f) => f.href === atual)));
  const link = (i: ItemNav, filho = false) => (
    <Link href={i.href} aria-current={corrente(i, filho) ? "page" : undefined} onClick={() => setAberto(false)}>{i.rotulo}</Link>
  );
  return (
    <header className="painel-nav">
      <div className="painel-nav-topo">
        <span className="painel-marca">Loja N.UY</span>
        <button type="button" className="botao botao-secundario menu-botao" aria-expanded={aberto} aria-controls="menu-painel" onClick={() => setAberto(!aberto)}>Menu</button>
      </div>
      <nav id="menu-painel" aria-label="Painel" className={aberto ? "aberto" : ""}>
        <ul>
          {itens.map((i) => (
            <li key={i.href}>
              {link(i)}
              {i.filhos && ativo(i.href) && <ul>{i.filhos.map((f) => <li key={f.href}>{link(f, true)}</li>)}</ul>}
            </li>
          ))}
        </ul>
        <div className="painel-usuario">
          <p>{nome}</p>
          <BotaoSair />
        </div>
      </nav>
    </header>
  );
}
