// Copia o site versionado em `../site/` para onde o app lê: os templates (`index.html`, `loja.html`)
// vão para `src/site/` (fora de `public/`, para não serem servidos crus) e o resto vai para `public/`.
// As duas pastas de destino são geradas (estão no .gitignore): edite sempre em `../site/`.
// Roda sozinho antes de `dev`, `build` e `test` (predev, prebuild, pretest).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const raiz = join(import.meta.dirname, "..");
const origem = join(raiz, "..", "site");
const TEMPLATES = new Set(["index.html", "loja.html"]);

if (!existsSync(join(origem, "index.html"))) {
  console.error(`copiar-site: não achei ${join(origem, "index.html")}`);
  process.exit(1);
}

for (const pasta of ["public", "src/site"]) {
  rmSync(join(raiz, pasta), { recursive: true, force: true });
  mkdirSync(join(raiz, pasta), { recursive: true });
}
for (const nome of readdirSync(origem)) {
  const destino = TEMPLATES.has(nome) ? join(raiz, "src/site", nome) : join(raiz, "public", nome);
  cpSync(join(origem, nome), destino, { recursive: true });
}
