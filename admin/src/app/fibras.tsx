"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type Fx = { destroy: () => void };
declare global {
  interface Window { GhostFibers?: (el: HTMLElement, opcoes: Record<string, unknown>) => Fx }
}

// Fundo de fibras do site (public/js/ghost-fibers.js, o mesmo da home), com as mesmas cores.
// Fica de fora com movimento reduzido, aparelho fraco ou sem WebGL2: sobra o degradê do CSS.
export function Fibras() {
  const ref = useRef<HTMLDivElement>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const fraco = (nav.hardwareConcurrency || 8) <= 2 || (nav.deviceMemory || 8) <= 2 || nav.connection?.saveData;
    if (!pronto || !el || !window.GhostFibers || !window.WebGL2RenderingContext || fraco || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const celular = matchMedia("(max-width: 767px)").matches;
    const fx = window.GhostFibers(el, {
      glowColor: "#FF7A2E", secondaryColor: "#2EC8E8", lineColor: "#FFB25E", gradient: "along", layers: 3,
      threads: celular ? 36 : 60, density: celular ? 0.7 : 0.8, particles: 0.35, sparkle: 0.4, thickness: 1.5, foldGlow: 1.4,
      speed: 0.35, flow: 0.3, glow: 1.1, brightness: 1.7, vignette: 0.4, grain: 0,
      mouseInteraction: !celular, hoverEffect: "focus", pulseOnClick: false, dpr: celular ? 0.75 : 1, maxFps: 30,
    });
    return () => fx.destroy();
  }, [pronto]);

  return (
    <>
      <Script src="/js/ghost-fibers.js" strategy="lazyOnload" onReady={() => setPronto(true)} />
      <div ref={ref} className="auth-fibras" aria-hidden="true" />
    </>
  );
}
