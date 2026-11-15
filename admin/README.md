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
| `lint` / `typecheck` | ESLint / `next typegen` + `tsc --noEmit` (gera os tipos de rota antes, para funcionar sem `.next/`) |
| `db:generate` / `db:migrate` | Drizzle Kit (migrations em `drizzle/`; schema em `src/db/schema`) |
| `test` / `test:watch` | Vitest (veja "Testes"); `test:watch` reexecuta ao salvar |
| `conteudo:migrar` | Grava a versão 1 do conteúdo do site a partir de `../site/conteudo/*.json` (ou de uma pasta passada como argumento). Idempotente: não grava se já houver qualquer versão |
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
| `SITE_DEPLOY_HOOK_URL` | Opcional. Deploy hook do projeto Vercel do site; **segredo**, só em Production. Sem ela, fora de produção a publicação é gravada como aceita com a nota "sem hook configurado" e o painel avisa que o site não foi atualizado; em produção sem ela a publicação falha. Local: `http://127.0.0.1:8765/__publicado` avisa o `yarn dev:painel` do site (http só para localhost, fora de produção; com ela, publicar com o site parado falha). Nunca é logada |
| `BLOB_READ_WRITE_TOKEN` | Opcional. Token do Vercel Blob para o upload de fotos (na Vercel basta o store conectado). Sem ele o envio de foto responde "armazenamento não configurado" e o resto do painel segue |
| `NEXT_PUBLIC_BLOB_HOST` | Host do store Blob da loja (`<id>.public.blob.vercel-storage.com`; público, não é segredo). Sem ele o upload é recusado e só `img/...` é aceito como imagem. As fotos são reencodadas no servidor (`sharp`: sem EXIF/GPS, rotação aplicada, recusa o que não decodifica) |
| `SITE_PUBLIC_URL` | Opcional. Endereço do site, só para a miniatura das fotos de `site/img/` no painel |

No projeto do site (`site/`, não é desta pasta): `CONTEUDO_URL` (URL de `/api/conteudo-site`; quando definida o build do site busca o conteúdo ali) e `BLOB_PUBLIC_HOST` (o mesmo host do store; sem ele o build só aceita `img/...`) e `LOJA_URL` (endereço da loja, destino dos botões dos cartões da Loja; sem ela o botão continua em `#baixar`). Nenhuma das duas é segredo.

Em desenvolvimento, os e-mails de conta (confirmação, recuperação) não são enviados: ficam em `.dev-outbox/` (ignorado pelo Git).

Os scripts `db:*` carregam `.env.local` via `node --env-file-if-exists` (o `drizzle-kit` não lê esse arquivo sozinho); sem o arquivo, usam o `DATABASE_URL` do shell.

## Painel de conteúdo do site (fase 1a)

Só admin (`/admin/conteudo`, `/admin/conteudo/[bloco]`, `/admin/conteudo/historico`). Módulo: `src/modules/conteudo-site/`; decisão: ADR-0006; especificação visual: `../docs/tecnico/ui-painel-conteudo.md`. `GET /api/conteudo-site` é público e devolve só a última versão publicada (sem cache); o upload de foto é `POST /api/conteudo-site/foto` (JPEG/PNG/WebP até 4,5 MB, tipo conferido pelo conteúdo, Vercel Blob, prefixo `conteudo/`).

Para testar localmente:

```bash
npm run db:migrate
npm run conteudo:migrar                       # versão 1 (9 blocos)
npm run admin:criar -- voce@exemplo.com "Nome"
npm run dev                                   # entre em /entrar e abra /admin/conteudo
curl -i localhost:3000/api/conteudo-site      # conteúdo publicado, cache-control: no-store
```

Sem `SITE_DEPLOY_HOOK_URL` o painel publica no banco e avisa que o site não foi atualizado; sem `BLOB_READ_WRITE_TOKEN` o envio de foto é recusado com mensagem clara. Para ver o site com o conteúdo da loja: `yarn dev:painel` em `../site` (recarrega ao publicar, sem reescrever `site/index.html`), ou `CONTEUDO_URL=http://localhost:3000/api/conteudo-site node ../site/build.mjs` (reescreve `site/index.html`; `git diff` mostra a diferença). `site/build.mjs` sem `CONTEUDO_URL` continua lendo `site/conteudo/*.json`.

## CI

`.github/workflows/admin-ci.yml` roda lint, typecheck, testes (service container Postgres 17, `TEST_DATABASE_URL`) e build quando `admin/**`, `site/build.mjs`, `site/index.html` ou `site/conteudo/**` mudam (o teste de contrato do painel lê esses arquivos). O job define valores fictícios de `DATABASE_URL`, `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL` só para o build validar `env.ts` (não conecta ao banco).

## Deploy (pendente: depende das contas da N.UY)

Ainda não configurado. Quando as contas existirem: projeto Vercel próprio com Root Directory `admin/` (independente do projeto do site estático em `site/`); Neon Postgres em aws-sa-east-1, branch `main` para Production e uma branch por preview (nunca a produção); `DATABASE_URL` e demais segredos como variáveis da Vercel por ambiente (Preview/Production), nunca no Git; migrations como etapa controlada do deploy, não no build.
