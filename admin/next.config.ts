import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // o template da página `/` é lido com fs em runtime (modules/conteudo-site/pagina-do-site.ts)
  outputFileTracingIncludes: { "/": ["./src/site/index.html"] },
  redirects: async () => [{ source: "/index.html", destination: "/", permanent: true }],
};

export default nextConfig;
