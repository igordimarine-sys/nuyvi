"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";
import { cor, raio } from "./tokens";

// Tema do painel: layout e densidade no modelo do painel do trafego-system (sem ripple, sem sombras, cantos de 6/8 px,
// texto de 13-14 px), com as cores do site (tokens.ts).
const tema = createTheme({
  // md = 768 px: o mesmo corte da barra lateral e da barra de publicar no admin.css
  breakpoints: { values: { xs: 0, sm: 600, md: 768, lg: 1100, xl: 1536 } },
  palette: {
    mode: "dark",
    primary: { main: cor.primary, dark: cor.primaryHover, contrastText: cor.bg },
    secondary: { main: cor.ciano, contrastText: cor.bg },
    error: { main: cor.rosa },
    warning: { main: cor.ambar },
    success: { main: cor.verde },
    info: { main: cor.ciano },
    background: { default: cor.bg, paper: cor.card },
    text: { primary: cor.text, secondary: cor.textSec, disabled: cor.textMuted },
    divider: cor.border,
  },
  shape: { borderRadius: raio.sm },
  typography: {
    fontFamily: "var(--fonte-painel), system-ui, sans-serif",
    fontSize: 14,
    button: { fontSize: 13, fontWeight: 600, textTransform: "none", letterSpacing: "normal" },
    body1: { fontSize: 14 },
    body2: { fontSize: 13 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { fontSize: 14 } } },
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: { root: { "&.Mui-focusVisible": { outline: `2px solid ${cor.ciano}`, outlineOffset: 2 } } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 40, padding: "8px 14px", minWidth: 0, borderRadius: raio.sm, whiteSpace: "nowrap", transition: "all .15s" },
        contained: { "&:hover": { backgroundColor: cor.primaryHover } },
        outlined: { borderColor: cor.border, "&:hover": { backgroundColor: cor.borderLight, borderColor: cor.border } },
        sizeSmall: { minHeight: 32, padding: "5px 10px" },
        sizeLarge: { minHeight: 44, fontSize: 14 },
      },
    },
    MuiIconButton: { styleOverrides: { root: { width: 40, height: 40, borderRadius: raio.sm } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: { defaultProps: { variant: "outlined" }, styleOverrides: { root: { borderColor: cor.border, borderRadius: raio.md } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: raio.sm } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: raio.md, fontSize: 13.5 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: cor.bg, borderRadius: raio.sm, "& .MuiOutlinedInput-notchedOutline": { borderColor: cor.border }, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: cor.textMuted } },
        input: { padding: "10px 12px" },
      },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0, fontSize: 12.5 } } },
    MuiTableContainer: { styleOverrides: { root: { background: cor.card, border: `1px solid ${cor.border}`, borderRadius: raio.md } } },
    MuiTableBody: { styleOverrides: { root: { "& tr:last-child td": { borderBottom: "none" } } } },
    MuiTableRow: { styleOverrides: { root: { transition: "background .1s", "tbody &:hover": { background: cor.rowHover } } } },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: "11px 14px", fontSize: 13, color: cor.text, borderBottom: `1px solid ${cor.borderLight}` },
        head: { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: cor.textSec, textTransform: "uppercase", letterSpacing: ".4px", background: cor.surface, borderBottom: `1px solid ${cor.border}` },
      },
    },
    MuiDialog: { styleOverrides: { paper: { border: `1px solid ${cor.border}`, borderRadius: raio.md } } },
    MuiTooltip: {
      defaultProps: { arrow: true, placement: "top" },
      styleOverrides: { tooltip: { background: cor.border, fontSize: 11, padding: "5px 10px" }, arrow: { color: cor.border } },
    },
  },
});

export function Tema({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
