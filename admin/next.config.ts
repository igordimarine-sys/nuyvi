import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // o template da página `/` é lido com fs em runtime (modules/conteudo-site/pagina-do-site.ts)
  outputFileTracingIncludes: {
    "/": ["./src/site/index.html"],
    "/loja": ["./src/site/index.html", "./src/site/loja.html"],
    // lista dos vídeos versionados para o seletor do painel (modules/conteudo-site/videos-do-site.ts)
    "/admin/conteudo/\\[bloco\\]": ["./public/video/**/*"],
  },
  // a query string passa para o destino (doc de redirects), então /entrar?volta=/loja vira /login?volta=/loja
  redirects: async () => [
    { source: "/index.html", destination: "/", permanent: true },
    { source: "/entrar", destination: "/login", permanent: true },
  ],
};

export default nextConfig;
