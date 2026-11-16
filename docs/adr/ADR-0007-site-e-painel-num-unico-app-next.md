# ADR-0007: Site, painel e loja num único app Next.js; `/` montado do template do site com cache invalidado ao publicar

| Campo | Valor |
|---|---|
| Status | **Proposto** em 2026-11-15. A direção ("tudo em Next", um projeto Vercel, `/` = site, `/admin` = painel, `/login` = login) é **decisão do dono** e não está em aberto; este ADR registra o **como** |
| Data | 2026-11-15 |
| Decisores | Desenvolvedor (direção); proposta técnica do dev-arquitetura |
| Tipo | Técnico |
| Projeto / spec | [docs/specs/loja.md](../specs/loja.md) v0.5 · seção 5.9 · CA-LOJ-51, 55, 58, 59 · RNF-13, 14, 15 · RISCO-11, 15, 16 · [ADR-0004](ADR-0004-stack-loja.md) · [ADR-0005](ADR-0005-painel-unico-conteudo-do-site-e-loja.md) · [ADR-0006](ADR-0006-conteudo-do-site-no-banco-da-loja-com-rebuild.md) |
| Substitui | No **ADR-0004**: linha "Hospedagem" (um projeto só, Root Directory `admin/`, no lugar de dois projetos) e linha "Ligação com o site" (mesmo domínio e mesmo app, sem subdomínio da loja). No **ADR-0006**: linhas "Leitura pelo site", "Build do site", "Disparo", "Ligação com o GitHub" e "`site/` depois da migração" (o deploy hook, o `CONTEUDO_URL` e o `LOJA_URL` saem). Continuam valendo no ADR-0006: fonte da verdade em versões no Postgres, publicação por bloco com `versaoBase`, histórico, fotos no Blob, migração da versão 1 |
| Desenho detalhado | [docs/tecnico/arquitetura.md](../tecnico/arquitetura.md), seções 1, 2, 6, 7 e 8 |

## Contexto

- Hoje são dois projetos: `site/` estático (`index.html` de 939 linhas com 27 trechos `<!--cms:CHAVE-->`, `build.mjs` de 130 linhas com `montar(html, dados, { lojaUrl, blobHost })`, `dev.mjs` na porta 8765, `img/` 2,4 MB, `video/` 14 MB, 4 scripts em `js/`, CSS embutido em `<style>` e em `css/estilos.css`) e `admin/` (Next.js 16.4.6, `cacheComponents: true` e `partialPrefetching: true` em `admin/next.config.ts`). Publicar no painel grava a versão e chama o deploy hook do site (`modules/conteudo-site/deploy-hook.ts`); o build do site lê `GET /api/conteudo-site`.
- O dono decidiu juntar tudo num app (`admin/`) e num projeto Vercel. Com isso o deploy hook, o `CONTEUDO_URL`, o `LOJA_URL`, o Ignored Build Step e a ligação do `nuyvi` ao GitHub deixam de existir.
- Escala: um desenvolvedor, PME, uma página de vitrine e publicações esporádicas (RNF-01 e P-11 continuam como premissa). Nenhum número desta decisão depende de carga.
- O HTML do site usa caminhos relativos (`img/…`, `js/…`, `css/…`, `video/…`, `politica-de-privacidade.html`, `index.html`) e scripts próprios (GSAP, ScrollTrigger, Lenis, `ghost-fibers.js`) que manipulam o DOM inteiro. Os planos são montados por script a partir de `<script type="application/json" id="dados-planos">`.
- O `index.html` versionado já é uma página completa: cada trecho `cms:` traz o conteúdo do último `build.mjs` rodado. Isso dá, de graça, uma cópia de reserva do conteúdo dentro do repositório.

## Opções consideradas

### 1. Como `/` é renderizado

| | **A. Route Handler `app/route.ts` que devolve o template do site montado por `montar()`, em função com `'use cache'`** | B. Portar a página para componentes React (layout + seções) |
|---|---|---|
| Visual e scripts | Idênticos: o mesmo HTML, byte a byte, com o conteúdo do banco nos trechos `cms:`. O root layout do Next não envolve Route Handlers, então o documento continua sendo o do site | Exige reescrever 939 linhas, o `<style>` e a integração de GSAP/Lenis com hidratação do React; risco alto de regressão visual e de animação |
| Validação e escape | Reaproveita `montar()` e os testes de contrato que já existem | Reescrever validação e escape em JSX |
| Esforço | Pequeno: mover arquivos, um handler de ~20 linhas, mover `montar` | Dias, sem ganho para quem visita |
| Reversibilidade | Alta (é o mesmo template; voltar ao site estático é rodar `montar` num script) | Baixa |

### 2. Cache e invalidação ao publicar

| | **A. Prerender + `cacheTag` + `updateTag` na Server Action de publicar** | B. `revalidateTag(tag, 'max')` | C. Sem cache (lê o banco a cada visita) |
|---|---|---|---|
| Quem publica vê na hora | Sim: "a próxima requisição espera o dado novo" (read-your-own-writes) | Não: a primeira visita depois de publicar ainda recebe a versão anterior (stale-while-revalidate) | Sim |
| Banco fora | O `/` em cache não toca o banco. Janela de risco: o banco cair **entre** publicar e a visita seguinte (a regeneração bloqueia e falha) | Mais tolerante: a visita sempre recebe o que está em cache e a regeneração roda em segundo plano | **Não atende** RNF-14 |
| Peças | Uma tag, uma chamada | Igual | Nenhuma |

### 3. Banco fora do ar (RNF-14 passa a ser "site no ar com o banco fora")

| | **A. Última versão boa no cache do prerender + conteúdo embutido no template quando não houver versão publicada** | B. A + capturar erro do banco e servir o template como está | C. Cópia do conteúdo em Blob/Edge Config atualizada a cada publicação |
|---|---|---|---|
| Como funciona | `/` é prerenderizado no build e regenerado só por tag. Erro do banco **não é capturado** dentro do caminho em cache, então a regeneração que falha não substitui a versão boa (*hipótese H2, abaixo*). Sem versão publicada (tabela vazia: CI, preview novo), `/` usa o template como está | Igual, mas com `try/catch`: se o banco falhar, serve o template | Segunda fonte da verdade |
| Risco | Se H2 não se confirmar, entrada fria no cache + banco fora = erro 500 | O `catch` transforma a falha numa regeneração **bem-sucedida** com o conteúdo do template, que é mais antigo, e ela **sobrescreve** a última versão boa | Divergência entre as duas cópias; peça nova para operar |
| Peças novas | Nenhuma | Nenhuma | Store novo + sincronização |

Fontes (documentação local do Next 16.4.6 em `admin/node_modules/next/dist/docs/`, lida em 2026-11-15):
- `01-app/01-getting-started/15-route-handlers.md`: com Cache Components, Route Handlers `GET` "follow the same model as normal UI routes", podem ser prerenderizados e usar `'use cache'` num helper (não no corpo do handler); `route.js` não pode coexistir com `page.js` no mesmo segmento (`app/page.js` + `app/route.js` = conflito); Route Handlers não participam de layouts.
- `03-api-reference/04-functions/updateTag.md`: só em Server Actions; expira a tag na hora e a próxima requisição espera o dado novo.
- `03-api-reference/04-functions/revalidateTag.md`: `profile="max"` serve conteúdo antigo enquanto revalida; a forma de um argumento está obsoleta.
- `03-api-reference/04-functions/cacheLife.md`: perfil `max` = `stale` 5 min, `revalidate` 30 dias, `expire` 1 ano.
- `03-api-reference/01-directives/use-cache.md`, "Runtime caching considerations": em serverless, o cache em memória do `'use cache'` em tempo de execução "typically don't persist across requests"; o que vale é o resultado do **prerender** ("Build-time caching works normally"); nenhum cache passa para um deploy novo.
- `02-guides/incremental-static-regeneration.md`: "If an error is thrown while attempting to revalidate data, the last successfully generated data will continue to be served from the cache" (guia **sem** Cache Components).
- `03-api-reference/05-config/01-next-config-js/output.md`: `outputFileTracingIncludes` para incluir arquivos lidos em tempo de execução no bundle da função.
- `03-api-reference/03-file-conventions/public-folder.md`: arquivos de `public/` servidos a partir de `/`.

## Decisão

**1A + 2A + 3A.** É a de menor risco para o visual (o HTML não muda) e reaproveita `montar()` e os testes que já protegem a página.

| Item | Decisão |
|---|---|
| Rota `/` | `admin/src/app/route.ts` (sai `app/page.tsx`, o placeholder "Em construção"). `GET` chama um helper `paginaDoSite()` com `'use cache'`, `cacheTag(TAG_CONTEUDO_SITE)` e `cacheLife('max')`, que lê o template, chama `obterPublicado()` e devolve `montar(template, conteudo)`. A resposta é `text/html; charset=utf-8`. O handler não lê cookie, header nem `request` (senão deixa de ser prerenderizado) |
| `montar()` | Sai de `site/build.mjs` para `admin/src/modules/conteudo-site/pagina.ts` (TypeScript, **mesma lógica**). As opções passam a ser `blobHost` (de `NEXT_PUBLIC_BLOB_HOST`, que a loja já tem) e `lojaUrl` (vazia até a pendência PEND-07a; vazia mantém `#baixar`, comportamento de hoje). O módulo continua sem conhecer produto, preço ou pedido (RN-LOJ-18) |
| Template | `admin/src/site/index.html` (**fora** de `public/`: em `public/` ele seria servido cru em `/index.html`). Lido com `fs` e incluído no bundle por `outputFileTracingIncludes` em `next.config.ts`. Continua sendo uma página completa com conteúdo embutido; é a reserva da opção 3A |
| Arquivos estáticos | `site/img/`, `site/video/`, `site/js/`, `site/css/`, `politica-de-privacidade.html`, `termos-de-uso.html` e `versao-*.html` vão para `admin/public/` com os mesmos nomes. Como `/` está na raiz, os caminhos relativos do HTML (`img/…` em `/` resolve para `/img/…`) continuam válidos sem editar o HTML |
| `/index.html` | As páginas legais linkam `index.html`. Redirect permanente `/index.html` → `/` em `next.config.ts` (não editar o HTML) |
| Publicar | O módulo grava a versão já como aceita (sem disparo externo). A Server Action de `app/admin/conteudo/actions.ts` chama `updateTag(TAG_CONTEUDO_SITE)` quando `publicar` devolve `publicado`. `updateTag` fica na action, não no módulo: `publicar` continua testável no Vitest sem contexto de Server Action. A constante da tag é exportada pelo módulo. Sequência exata e o que fazer com os estados `pendente`/`falhou` (hoje só existem por causa do hook): `dev-react`, com `dev-database` |
| O que sai | `modules/conteudo-site/deploy-hook.ts`, `SITE_DEPLOY_HOOK_URL`, `CONTEUDO_URL`, `LOJA_URL`, `BLOB_PUBLIC_HOST`, `SITE_PUBLIC_URL` (as miniaturas de `img/…` no painel passam a ser do mesmo domínio), `site/build.mjs`, `site/dev.mjs`, `site/package.json`, `site/vercel.json`, `site/conteudo/` e o `GET /api/conteudo-site` (sem consumidor depois do corte; menos superfície pública). Os JSON de `site/conteudo/` vão para `admin/scripts/conteudo-inicial/` (entrada do `conteudo:migrar` e dados dos testes) |
| Banco fora | Erro do banco **não** é capturado dentro de `paginaDoSite()` nem no handler. `obterPublicado()` devolver `null` (tabela vazia) usa o template como está. Não há segunda cópia do conteúdo |
| Build | `next build` passa a ler o banco ao prerenderizar `/`. Banco fora no build = build falha e a Vercel mantém o deploy anterior (mesma semântica do CA-LOJ-59 de hoje). As migrations rodam **antes** do deploy (já é o plano: etapa controlada, não no build). No CI, o build aponta para o Postgres do service, depois do `db:migrate` (tabela vazia → template) |
| Rotas | `/` site · `/admin` painel · `/login` (renomeia `/entrar`, com redirect permanente `/entrar` → `/login` para e-mails e favoritos antigos) · `/api/auth/*` · `/api/conteudo-site/foto`. Páginas de cliente (`/cadastrar`, `/confirmar-email`, `/esqueci-senha`, `/redefinir-senha`, `/vincular-pedidos`) **ficam onde estão** até a PEND-07b |
| Colisões | Regra: nenhuma rota do app com nome de pasta de `public/` (`img`, `video`, `js`, `css`) nem arquivo em `public/` com nome de rota (`admin`, `api`, `login`, `_next`, `loja`). Hoje não há colisão (conferido: `site/admin/` não existe mais; rotas do app listadas acima). O comportamento do Next quando um arquivo de `public/` e uma rota do App Router têm o mesmo caminho é *hipótese não verificada*; a regra evita depender dele |
| Headers | Os headers de segurança do site (B-04, antes em `site/vercel.json`) e os da loja (M-02) passam a ser `headers()` do `next.config.ts`, **por caminho**: a página do site tem `<style>` e scripts embutidos, então a CSP da loja não pode ser aplicada a `/` sem ajuste (`dev-react` + `dev-security`) |
| Projeto Vercel | Um projeto, Root Directory `admin/`, no time Pro da N.UY. O projeto `nuyvi` **não é mexido** até o corte; no corte, o domínio do site passa para o projeto único. O `nuyvi` fica parado por um período de rollback (voltar = apontar o domínio de novo) e depois é removido. Se o projeto único será o `nuyvi` reconfigurado ou um projeto novo: `dev-infra`/`dev-devops` (as contas da N.UY ainda não existem) |
| Local | `npm run dev` em `admin/` serve tudo em `localhost:3000`. O `dev.mjs` (porta 8765) e a recarga automática ao publicar saem; publicar e recarregar a aba mostra o conteúdo novo |

**Hipóteses não verificadas, a confirmar no passo 7 do plano (antes do corte):**
- **H1:** na Vercel, `updateTag` numa Server Action invalida o `/` prerenderizado por um Route Handler cujo helper usa `cacheTag`. A doc local garante o modelo; a integração com o cache da Vercel não foi verificada.
- **H2:** com Cache Components, uma regeneração que lança erro mantém a última versão boa (a doc só afirma isso no guia de ISR sem Cache Components).
- **H3:** na Vercel, a entrada do prerender de `/` é durável durante a vida do deploy (não some por inatividade). Não confirmado na documentação da Vercel consultada.
- **H4:** ler o template com `fs` + `outputFileTracingIncludes` funciona no build com Turbopack e na regeneração em função. Alternativa, se não funcionar: importar o HTML como texto (módulo tipo `raw`/`text` do Turbopack, `03-api-reference/05-config/01-next-config-js/turbopack.md`), decisão do `dev-react`.

## Consequências

**Positivas**
- Publicar atualiza o site em segundos (RNF-15 com folga); "publicado, mas não apareceu" (RISCO-16) deixa de existir, junto com o e-mail de falha de deploy como único aviso.
- Somem a URL secreta do hook, o Ignored Build Step, a ligação do `nuyvi` ao GitHub, o endpoint público de leitura e três variáveis de ambiente. Uma conta, um deploy, um domínio, cookies no mesmo domínio.
- A validação do painel e a do site passam a ser o mesmo código (`montar` no módulo), em vez de um teste de contrato entre dois projetos.

**Negativas e custos aceitos**
- **Destino comum:** site, painel e loja sobem juntos. Uma mudança de código da loja gera um deploy que também republica o site (com validação de build; build quebrado não substitui o deploy anterior). Um erro de runtime em código compartilhado (ex.: `next.config.ts`, headers) pode afetar `/`.
- **Todo build lê o banco** (RISCO-15 continua, agora para qualquer mudança do app). Com o banco fora, nada é publicado nem implantado; o que está no ar continua.
- **Janela de risco da opção 2A:** se o banco cair entre publicar e a visita seguinte, essa visita falha (a regeneração bloqueia). É curta e exige o banco cair logo depois de ter respondido à publicação.
- **Rollback instantâneo da Vercel** volta ao `/` gerado por aquele deploy, que pode ter conteúdo mais antigo que o publicado; publicar de novo resolve.
- O template embutido envelhece em relação ao banco. Só é usado com a tabela vazia; não é mantido em dia de propósito.
- Perde-se a recarga automática do `dev.mjs`, feita no commit `0715a76`.
- 16 MB de mídia passam a fazer parte do deploy do app (não entram nas funções; *hipótese não verificada* sobre impacto no tempo de upload).

**Riscos e mitigação**
- HTML diferente do atual depois da mudança: teste que compara `GET /` (ou `paginaDoSite()`) com a saída do `build.mjs` atual para os mesmos dados, antes de remover o `site/` (`dev-tests`).
- Conteúdo com HTML ou script injetado: `montar` já escapa tudo; os testes vêm junto.
- H2/H3 falharem: o passo 7 mede; o gatilho está em "Quando revisitar".

## Quando revisitar

- **H2 ou H3 falharem** no teste do passo 7 (o `/` dá erro com o banco fora numa entrada fria): avaliar servir o template com `Cache-Control: no-store` **sem** gravar no cache, ou uma cópia do HTML montado no Blob a cada publicação (opção 3C). Decidir com o `dev-react` e o `dev-devops`; não antes da medição.
- **H1 falhar**: `revalidateTag(TAG, 'max')` no lugar de `updateTag` e aceitar a primeira visita com a versão anterior; se também falhar, `revalidatePath('/')`.
- **Banco fora mais de uma vez num mês** atrapalhando deploys: build passa a usar o template quando o banco não responder **só no build**, com aviso no log (decisão com o `dev-devops`).
- **Site ganhar páginas** além da home (ex.: blog): passar a montar cada página do mesmo jeito ou começar a portar seções para React, uma por vez, quando houver motivo (seção nova, interação com a loja).
- **Loja pública crescer** a ponto de deploys frequentes da loja atrapalharem o site, ou de equipes separadas: separar de novo em dois projetos (o ADR-0006 já descreve esse caminho).

## Impacto em outros agentes

- `dev-react`: `app/route.ts` e `paginaDoSite()`; mover `montar` para o módulo; mover arquivos para `public/` e o template; `outputFileTracingIncludes`; redirects `/index.html` e `/entrar`; renomear `/entrar` para `/login` (inclusive `callbackURL` e `redirect` em `papeis.ts`, `estados.tsx`, `formularios.tsx`, `editor.tsx`); `updateTag` na action; remover o hook e o endpoint de leitura; headers por caminho.
- `dev-tests`: congelar os JSON em `admin/scripts/conteudo-inicial/`; trocar os testes que leem `site/index.html`, `site/build.mjs` e `site/conteudo/` (`build-site`, `contrato`, `dados`, `migracao`, `leitura`, `publicar`, `foto`, `rota-foto`); teste de igualdade do HTML; teste de que a action chama `updateTag`; remover testes do hook e do endpoint.
- `dev-devops`: CI (corrigir `working-directory: loja`, que ficou para trás no rename; tirar `site/**` dos `paths`; build contra o Postgres do service depois do `db:migrate`); verificação H1 a H4 em Preview; corte do domínio e rollback.
- `dev-infra`: projeto único no Pro da N.UY, domínio do site apontando para ele no corte, `BETTER_AUTH_URL` = domínio do site, destino do `nuyvi`.
- `dev-database`: opinar se as colunas `disparo_*` e o índice de "uma pendente" ficam (histórico) ou são simplificados numa migration futura; nenhuma mudança de schema é necessária para o corte.
- `dev-security`: CSP por caminho (`/` com scripts embutidos × app), remoção do endpoint público e do hook (fecha B-01 e o item da URL do hook).
- `dev-uiux`: texto de sucesso do painel ("já está no site", sem "em poucos minutos") e estado de falha de disparo que deixa de existir.
- `arquiteto-specs`: pendências abaixo.
- `docs-handoff`: `BRIEFING.md` (URLs das versões antigas continuam iguais; painel e site no mesmo endereço) e manual da equipe.

## Pendências de escopo (arquiteto-specs)

- **PEND-07a:** onde fica a loja pública (proposta técnica: prefixo `/loja`, ex.: `/loja`, `/loja/categoria/<slug>`, porque `/` é o site) e o que o destino `inicio` dos cartões da Loja significa (CA-LOJ-58). Até decidir, o botão continua em `#baixar`.
- **PEND-07b:** se as páginas de cliente mudam de caminho (ex.: `/conta/...` ou `/loja/...`). Tecnicamente podem ficar onde estão.
- Reescrever RNF-14 ("site no ar com o banco fora", com o que é garantido e as hipóteses H2/H3), CA-LOJ-59 (não existe mais "build disparado pela publicação"), RNF-15 (imediato), RISCO-15 e RISCO-16, a integração "Publicação do conteúdo" e as menções a subdomínio da loja.
- Página 404 para quem visita (hoje seria a do app, com o título "Loja N.UY"): decidir se precisa do visual do site.
