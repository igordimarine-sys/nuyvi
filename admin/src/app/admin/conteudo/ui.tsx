import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { ReactNode, Ref } from "react";

// Primitivos visuais do painel (MUI, sem regra de negócio, sem estado). Estados nunca só por cor: ícone + palavra (spec UI, seção 3).
const SEVERIDADE = { informacao: "info", sucesso: "success", aviso: "warning", erro: "error" } as const;

export function Aviso({ tipo, titulo, children, acoes, refEl }: {
  tipo: keyof typeof SEVERIDADE;
  titulo?: string;
  children?: ReactNode;
  acoes?: ReactNode;
  refEl?: Ref<HTMLDivElement>;
}) {
  // erro e conflito anunciam na hora (alert); sucesso e informação esperam a vez (status)
  const role = tipo === "erro" || tipo === "aviso" ? "alert" : "status";
  return (
    <Alert ref={refEl} severity={SEVERIDADE[tipo]} variant="outlined" role={role} tabIndex={-1} className="aviso">
      {titulo && <AlertTitle sx={{ fontWeight: 700 }}>{titulo}</AlertTitle>}
      {children && <div className="aviso-corpo">{children}</div>}
      {acoes && <div className="aviso-acoes">{acoes}</div>}
    </Alert>
  );
}

const COR = { neutro: "default", sucesso: "success", aviso: "warning", erro: "error" } as const;

export function Etiqueta({ tom = "neutro", children }: { tom?: keyof typeof COR; children: ReactNode }) {
  return <Chip component="span" size="small" variant="outlined" color={COR[tom]} label={children} sx={{ verticalAlign: "middle", fontWeight: 600 }} />;
}

/** Cabeçalho de página (modelo do trafego-system): título + subtítulo à esquerda, ações à direita; `topo` vai acima (migalhas). */
export function CabecalhoPagina({ titulo, subtitulo, acoes, topo }: { titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode; topo?: ReactNode }) {
  return (
    <Box component="header" sx={{ mb: 3 }}>
      {topo}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px 16px" }}>
        <div>
          <Typography variant="h1" sx={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", lineHeight: 1.25 }}>{titulo}</Typography>
          {subtitulo && <Typography component="div" sx={{ fontSize: 13, color: "text.secondary", mt: "4px", maxWidth: 720 }}>{subtitulo}</Typography>}
        </div>
        {acoes && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{acoes}</Box>}
      </Box>
    </Box>
  );
}

/** Título de seção com linha até o fim. */
export function TituloSecao({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: "10px", m: "24px 0 12px", "&::after": { content: '""', flex: 1, height: "1px", bgcolor: "divider" } }}>
      <Typography component="h2" sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "text.secondary", whiteSpace: "nowrap" }}>{children}</Typography>
    </Box>
  );
}

const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** "14/11/2026 16:32", sempre no fuso de Brasília. */
export function formatarDataHora(d: Date): string {
  const p = Object.fromEntries(dataHora.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
