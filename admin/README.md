# N.UY: site, loja e painel

App único da N.UY (Next.js App Router, TypeScript, Drizzle, PostgreSQL). Rotas: `/` site (template `src/site/index.html` + conteúdo publicado), `/loja` vitrine (produtos ativos), `/login`, `/admin` painel (operador e admin; cliente recebe 404). Em `/` e `/loja` o cabeçalho mostra a sessão via `public/js/conta.js` (as páginas ficam em cache e não leem cookie). Decisões: `../docs/adr/ADR-0004-stack-loja.md` e `../docs/adr/ADR-0007-site-e-painel-num-unico-app-next.md`; estrutura: `../docs/tecnico/arquitetura.md`. Estado: esqueleto + login e papéis (veja `../docs/tecnico/autenticacao.md`).

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
| `lint` / `typecheck` | ESLint / `next typegen` + `tsc --noEmit` (gera os tipos de rota antes, para funcionar sem `.next/`) |
| `db:generate` / `db:migrate` | Drizzle Kit (migrations em `drizzle/`; schema em `src/db/schema`) |
| `test` / `test:watch` | Vitest (veja "Testes"); `test:watch` reexecuta ao salvar |
| `conteudo:blocos-novos` | Grava a versão `migracao` com os campos editáveis acrescentados (ADR-0007 A1: blocos `geral`, `videos`, `pagina-loja` e campos novos nos demais), preenchidos com o texto atual do template. Idempotente: não grava se a última versão aceita já tem `textos.geral`. Rodar depois de `conteudo:migrar` e **antes** do deploy do código que lê esses campos (o script não revalida o cache de `/`) |
| `conteudo:migrar` | Grava a versão 1 do conteúdo do site a partir de `scripts/conteudo-inicial/*.json` (ou de uma pasta passada como argumento). Idempotente: não grava se já houver qualquer versão |
| `admin:criar` | Cria ou promove o admin: `npm run admin:criar -- email@dominio.com "Nome"` (senha pedida no terminal, sem eco; ou via stdin) |

## Testes

Vitest, com integração contra o Postgres real (nada de SQLite nem mock do banco). Requer o compose no ar (`docker compose up -d --wait`).

```bash
npm test
```

- O banco é o database `loja_test` no mesmo contêiner (o `loja` de desenvolvimento nunca é tocado). A primeira execução o cria e aplica as migrations de `drizzle/` com o migrator do Drizzle (`tests/global-setup.ts`); as seguintes só aplicam o que for novo.
- Cada teste começa com as tabelas vazias (TRUNCATE em `tests/setup.ts`); os arquivos rodam em série porque dividem o banco.
- Outro servidor (ex.: CI): defina `TEST_DATABASE_URL`. O nome do database precisa conter `test`, senão a suíte aborta (guarda contra rodar em banco real).
- `DATABASE_URL`, `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL` dos testes são fictícios, definidos em `vitest.config.mts` (não lê `.env.local`). `server-only` é trocado por um módulo vazio.
- Dados são sempre fictícios (`tests/fabricas.ts`). A sessão do Better Auth é simulada em `tests/contas/sessao-falsa.ts`; o resto do código roda de verdade.
- Depois de uma migration nova que não se aplique sozinha (ex.: mudança manual), para recriar o banco de teste: `docker compose exec db psql -U loja -d postgres -c 'drop database loja_test'`.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL |
| `BETTER_AUTH_SECRET` | Segredo do Better Auth, mínimo 32 caracteres; um por ambiente, só em `.env.local`/Vercel |
| `BETTER_AUTH_URL` | URL pública da loja (links de e-mail e checagem de origem); local: `http://localhost:3000` |
| `BLOB_READ_WRITE_TOKEN` | Opcional. Token do Vercel Blob para o upload de fotos (na Vercel basta o store conectado). Sem ele o envio de foto responde "armazenamento não configurado" e o resto do painel segue |
| `NEXT_PUBLIC_BLOB_HOST` | Host do store Blob da loja (`<id>.public.blob.vercel-storage.com`; público, não é segredo). Sem ele o upload é recusado e só `img/...` é aceito como imagem. As fotos são reencodadas no servidor (`sharp`: sem EXIF/GPS, rotação aplicada, recusa o que não decodifica) |


Em desenvolvimento, os e-mails de conta (confirmação, recuperação) não são enviados: ficam em `.dev-outbox/` (ignorado pelo Git).

Os scripts `db:*` carregam `.env.local` via `node --env-file-if-exists` (o `drizzle-kit` não lê esse arquivo sozinho); sem o arquivo, usam o `DATABASE_URL` do shell.

## Painel de conteúdo do site (fase 1a)

Só admin (`/admin/conteudo`, `/admin/conteudo/[bloco]`, `/admin/conteudo/historico`). Módulo: `src/modules/conteudo-site/`; decisão: ADR-0006; especificação visual: `../docs/tecnico/ui-painel-conteudo.md`. `GET /api/conteudo-site` é público e devolve só a última versão publicada (sem cache); o upload de foto é `POST /api/conteudo-site/foto` (JPEG/PNG/WebP até 4,5 MB, tipo conferido pelo conteúdo, Vercel Blob, prefixo `conteudo/`).

Para testar localmente:

```bash
npm run db:migrate
npm run conteudo:migrar                       # versão 1 (9 blocos)
npm run conteudo:blocos-novos                 # versão 2: campos novos (geral, videos, pagina-loja)
npm run admin:criar -- voce@exemplo.com "Nome"
npm run dev                                   # / = site da N.UY; entre em /login e abra /admin/conteudo
```

O site é servido pelo app em `/` (`src/app/route.ts` monta `src/site/index.html` com a última versão publicada, em cache com a tag `conteudo-site`; arquivos estáticos em `public/`). Publicar no painel chama `updateTag` na Server Action e `/` muda na requisição seguinte, sem deploy. Sem `BLOB_READ_WRITE_TOKEN` o envio de foto é recusado com mensagem clara.

## CI

`.github/workflows/admin-ci.yml` roda lint, typecheck, testes (service container Postgres 17, `TEST_DATABASE_URL`) e build quando `admin/**` muda. Antes do build o job roda `npm run db:migrate` no database `ci` do service, porque o build prerenderiza `/` lendo `conteudo_versoes` (tabela vazia = conteúdo embutido no template). `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL` são valores fictícios.

## Deploy (pendente: depende das contas da N.UY)

Ainda não configurado. Quando as contas existirem: projeto Vercel próprio com Root Directory `admin/` (site, painel e loja no mesmo projeto, ADR-0007); Neon Postgres em aws-sa-east-1, branch `main` para Production e uma branch por preview (nunca a produção); `DATABASE_URL` e demais segredos como variáveis da Vercel por ambiente (Preview/Production), nunca no Git; migrations como etapa controlada do deploy, não no build.
