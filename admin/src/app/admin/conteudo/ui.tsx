import type { ReactNode, Ref } from "react";

// Primitivos visuais do painel (sem regra de negócio, sem estado). Estados nunca só por cor: ícone + palavra (spec UI, seção 3).
const ICONE = { informacao: "i", sucesso: "✓", aviso: "!", erro: "!" } as const;

export function Aviso({ tipo, titulo, children, acoes, refEl }: {
  tipo: keyof typeof ICONE;
  titulo?: string;
  children?: ReactNode;
  acoes?: ReactNode;
  refEl?: Ref<HTMLDivElement>;
}) {
  // erro e conflito anunciam na hora (alert); sucesso e informação esperam a vez (status)
  const role = tipo === "erro" || tipo === "aviso" ? "alert" : "status";
  return (
    <div ref={refEl} className={`aviso aviso-${tipo}`} role={role} tabIndex={-1}>
      <span className="aviso-icone" aria-hidden="true">{ICONE[tipo]}</span>
      <div className="aviso-corpo">
        {titulo && <p className="aviso-titulo">{titulo}</p>}
        {children && <div>{children}</div>}
        {acoes && <div className="aviso-acoes">{acoes}</div>}
      </div>
    </div>
  );
}

export function Etiqueta({ tom = "neutro", children }: { tom?: "neutro" | "sucesso" | "aviso" | "erro"; children: ReactNode }) {
  return <span className={`etiqueta etiqueta-${tom}`}>{children}</span>;
}

const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** "14/11/2026 16:32", sempre no fuso de Brasília. */
export function formatarDataHora(d: Date): string {
  const p = Object.fromEntries(dataHora.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
