// ghost-fibers.js é o mesmo arquivo da versão estática (React Bits, MIT, convertido para JS puro).
// Ao ser importado ele se registra em window.GhostFibers.
export {};

declare global {
  interface GhostFibersFx { set(opcoes: Record<string, unknown>): void; destroy(): void; ok?: boolean }
  interface Window { GhostFibers?: (el: HTMLElement, opcoes: Record<string, unknown>) => GhostFibersFx }
}
