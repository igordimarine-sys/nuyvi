# Loja N.UY

Loja própria da N.UY (Next.js App Router, TypeScript, Drizzle, PostgreSQL). Decisões: `../docs/adr/ADR-0004-stack-loja.md`; estrutura: `../docs/tecnico/arquitetura.md`. Estado: esqueleto + login e papéis (veja `../docs/tecnico/autenticacao.md`).

## Rodar localmente

Requer Node 22+ e Docker.

```bash
npm ci
docker compose up -d --wait   # Postgres 17 em 127.0.0.1:5436 (volume loja_pgdata)
cp .env.example .env.local    # DATABASE_URL já aponta para o banco local; preencha BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate            # aplica as migrations (quando existirem em drizzle/)
npm run dev                   # http://localhost:3000
```

As credenciais do compose são só de desenvolvimento (substituíveis por `LOCAL_DB_*`). Para zerar o banco local, derrube o compose com a opção de volumes (apaga os dados locais).

## Scripts

| Script | O que faz |
|---|---|
| `dev` / `build` / `start` | Next.js |
| `lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `db:generate` / `db:migrate` | Drizzle Kit (migrations em `drizzle/`; schema em `src/db/schema`) |
| `admin:criar` | Cria ou promove o admin: `npm run admin:criar -- email@dominio.com "Nome"` (senha pedida no terminal, sem eco; ou via stdin) |

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL |
| `BETTER_AUTH_SECRET` | Segredo do Better Auth, mínimo 32 caracteres; um por ambiente, só em `.env.local`/Vercel |
| `BETTER_AUTH_URL` | URL pública da loja (links de e-mail e checagem de origem); local: `http://localhost:3000` |

Em desenvolvimento, os e-mails de conta (confirmação, recuperação) não são enviados: ficam em `.dev-outbox/` (ignorado pelo Git).

Os scripts `db:*` carregam `.env.local` via `node --env-file-if-exists` (o `drizzle-kit` não lê esse arquivo sozinho); sem o arquivo, usam o `DATABASE_URL` do shell.

## CI

`.github/workflows/loja-ci.yml` roda lint, typecheck e build quando `loja/**` muda.

## Deploy (pendente: depende das contas da N.UY)

Ainda não configurado. Quando as contas existirem: projeto Vercel próprio com Root Directory `loja/` (independente do projeto do site estático em `site/`); Neon Postgres em aws-sa-east-1, branch `main` para Production e uma branch por preview (nunca a produção); `DATABASE_URL` e demais segredos como variáveis da Vercel por ambiente (Preview/Production), nunca no Git; migrations como etapa controlada do deploy, não no build.
