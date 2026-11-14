# Loja N.UY

Loja própria da N.UY (Next.js App Router, TypeScript, Drizzle, PostgreSQL). Decisões: `../docs/adr/ADR-0004-stack-loja.md`; estrutura: `../docs/tecnico/arquitetura.md`. Estado: esqueleto, sem funcionalidades.

## Rodar localmente

Requer Node 22+ e um PostgreSQL acessível.

```bash
npm ci
cp .env.example .env.local   # preencha DATABASE_URL
npm run dev                  # http://localhost:3000
```

## Scripts

| Script | O que faz |
|---|---|
| `dev` / `build` / `start` | Next.js |
| `lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `db:generate` / `db:migrate` | Drizzle Kit (migrations em `drizzle/`; schema em `src/db/schema`) |

`.env.local` não é lido pelo `drizzle-kit`: para `db:*`, exporte `DATABASE_URL` no shell ou use `node --env-file=.env.local`.
