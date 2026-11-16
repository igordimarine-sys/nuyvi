import { Archivo, Manrope } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Fibras } from "./fibras";
import "./tela-auth.css";

// Casca das telas de conta (/login, /cadastrar, /admin/login...) com a identidade do site:
// fundo preto com as fibras laranja/ciano, Archivo larga em caixa alta nos títulos, Manrope no texto, botões em pílula.
const titulo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--fonte-titulo" });
const texto = Manrope({ subsets: ["latin"], variable: "--fonte-texto" });

/** `dentroDoPainel`: /admin/login já está dentro do <main> do layout do painel, então o palco vira <div>. */
export function TelaAuth({ titulo: h1, apoio, children, rodape, dentroDoPainel = false }: { titulo: string; apoio?: ReactNode; children: ReactNode; rodape?: ReactNode; dentroDoPainel?: boolean }) {
  const Palco = dentroDoPainel ? "div" : "main";
  return (
    <div className={`tela-auth ${titulo.variable} ${texto.variable}`}>
      <Fibras />
      <header className="auth-topo">
        <Link href="/" className="auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático do site, mesmo arquivo do cabeçalho */}
          <img src="/img/logo-header.webp" alt="N.UY, ir para o site" width={160} height={66} />
        </Link>
      </header>
      <Palco className="auth-palco">
        <section className="auth-cartao" aria-labelledby="auth-titulo">
          <h1 id="auth-titulo"><span className="sol">{h1}</span></h1>
          {apoio && <p className="auth-apoio">{apoio}</p>}
          {children}
          {rodape && <nav className="auth-links" aria-label="Outras opções">{rodape}</nav>}
        </section>
      </Palco>
    </div>
  );
}

/** Separador "ou" entre o e-mail/senha e o Google. */
export const OuSeparador = () => <p className="auth-ou" aria-hidden="true"><span>ou</span></p>;
