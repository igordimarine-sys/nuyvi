import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // o template da página `/` é lido com fs em runtime (modules/conteudo-site/pagina-do-site.ts)
  outputFileTracingIncludes: { "/": ["./src/site/index.html"] },
  // a query string passa para o destino (doc de redirects), então /entrar?volta=/loja vira /login?volta=/loja
  redirects: async () => [
    { source: "/index.html", destination: "/", permanent: true },
    { source: "/entrar", destination: "/login", permanent: true },
  ],
};

export default nextConfig;
