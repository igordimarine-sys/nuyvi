# ADR-0006: Conteúdo do site no banco da loja, publicado por rebuild do site estático

| Campo | Valor |
|---|---|
| Status | **Aceito** em 2026-11-15 pelo desenvolvedor. **Parcialmente substituído por [ADR-0007](ADR-0007-site-e-painel-num-unico-app-next.md)** (proposto em 2026-11-15): saem o deploy hook, o build do site estático e o `GET /api/conteudo-site` (linhas "Leitura pelo site", "Build do site", "Disparo", "Ligação com o GitHub" e "`site/` depois da migração"); continuam a fonte da verdade em versões no banco, a publicação por bloco, o histórico e as fotos no Blob |
| Data | 2026-11-15 |
| Decisores | Desenvolvedor; proposta do dev-arquitetura |
| Tipo | Técnico |
| Projeto / spec | [docs/specs/loja.md](../specs/loja.md) v0.4 · PEND-CONT · seção 5.9 · HU-12, HU-13 · CA-LOJ-50 a 59 · RN-LOJ-18, 24, 25, 26 · RNF-13, 14, 15 · PREM-12, PREM-13 · RISCO-11, 12 · tarefa 9 da seção 15 · [ADR-0005](ADR-0005-painel-unico-conteudo-do-site-e-loja.md) |
| Substitui | No [ADR-0004](ADR-0004-stack-loja.md), as linhas **"Painel"** (passa a incluir o módulo de conteúdo do site) e **"Ligação com o site"** (o Sveltia sai; o site passa a receber o conteúdo publicado da loja no build). O resto do ADR-0004 continua valendo |
| Desenho detalhado | [docs/tecnico/arquitetura.md](../tecnico/arquitetura.md), seções 1, 2, 6, 7 e 8 |

## Contexto

- O painel é único e fica dentro da loja (ADR-0005). O Sveltia foi descartado (D-04). A edição de conteúdo é o primeiro módulo do painel (fase 1a).
- Hoje o site é estático: `site/index.html` tem 27 trechos `<!--cms:CHAVE-->…<!--/cms:CHAVE-->` (o arquivo tem 22 linhas com marcadores), e `site/build.mjs` (82 linhas, sem dependências) os remonta a partir de 5 arquivos `site/conteudo/*.json` (textos, loja, explore, novidades, planos; ~5 KB no total). O script já valida campos obrigatórios, listas não vazias, faixa do desconto e caminho das imagens, e **para o build com erro** se algo estiver errado.
- Onde isso está: `build.mjs` e `conteudo/` existem nas branches `painel` e `loja`, **não na `main`** (`git show main:site/build.mjs` falha; o `index.html` da `main` não tem marcadores). A branch `loja` ainda carrega `site/admin/` (Sveltia), herdado da `painel`.
- As imagens referenciadas pelo conteúdo são 12 arquivos já versionados em `site/img/esportes/` e `site/img/loja/`. `site/img/conteudo/` (destino dos uploads do Sveltia) está vazia.
- O projeto Vercel `nuyvi` é publicado à mão (`vercel deploy --prod`) e não está ligado ao GitHub. O repositório é **público** (RNF-13).
- Exigências: o site abre com a loja fora (RNF-14); publicação em até 5 min (RNF-15, premissa P-16); nada publicado pela metade (CA-LOJ-55); histórico com quem, quando e qual bloco (CA-LOJ-57, RN-LOJ-26); só conteúdo de vitrine sai do painel (RNF-13).

## Opções consideradas

| | A. Painel grava os JSON no GitHub (API) e o site faz rebuild | **B. Conteúdo no Postgres da loja; deploy hook dispara o build do site, que lê a versão publicada da loja** | C. Site lê o conteúdo da loja em tempo de execução |
|---|---|---|---|
| Como funciona | Ao publicar, o servidor da loja cria um commit com os JSON (e fotos) em `site/` na `main` (Git Data API: blobs, árvore, commit e atualização da ref, num único commit). O projeto `nuyvi` ligado ao GitHub publica a cada push | Publicar grava uma **versão completa** do conteúdo (os 5 documentos) numa transação e chama o deploy hook do projeto `nuyvi`. O `build.mjs` busca a última versão publicada num endpoint público da loja e gera o HTML estático. Fotos novas no Vercel Blob (público) | O navegador (ou uma função na borda) busca o conteúdo na loja a cada visita, com ou sem cache |
| RNF-14 (site com a loja fora) | Atende: site estático, não depende da loja | Atende: o deploy em produção é estático. Com a loja fora, só um **build novo** falha, e a Vercel mantém o deploy anterior | **Não atende** sem cache extra; HTML sem conteúdo prejudica SEO e o tempo de carregamento (RNF-14, "desempenho não piora") |
| RNF-15 (até 5 min) | Atende: tempo de um build estático (*hipótese*: menos de 2 min, medir) | Atende: idem | Imediato |
| CA-LOJ-55 (nada pela metade) | Atende: um commit só; build que falha não substitui o deploy | Atende: uma linha com a versão inteira; o build lê uma versão só; build que falha não substitui o deploy | Depende do cache |
| CA-LOJ-57 (histórico) | Commits do Git **mais** tabela no banco: o nome ou e-mail de quem publicou é dado pessoal e não pode ir para o commit num repositório público (RNF-13) | Tabela de versões no banco: quem, quando, blocos alterados. Voltar a uma versão (P-18, fase 2) vira republicar uma linha antiga | Tabela no banco |
| Fotos | No repositório (commit em base64 pela API); o repositório público cresce | Vercel Blob público, já previsto para as fotos de produto (ADR-0004). As 12 imagens atuais ficam em `site/img/` | Blob |
| Segredo no servidor da loja | Chave privada de um GitHub App (ou token) com **Contents: write**, que vale para o repositório inteiro. Para publicar direto na `main` protegida, o App precisa estar na lista de exceção da proteção, então pode empurrar **qualquer código** para a `main`. Restringir caminhos por *push ruleset* só existe para repositório privado ou interno | URL do deploy hook: quem tiver a URL só consegue **disparar um build** do site (limite de 60 por hora por projeto). Token do Blob (por OIDC, gerado pela Vercel) | Nenhum novo |
| Peças novas | GitHub App ou token + 4 chamadas por publicação + tratamento de conflito de ref + tabela de histórico | Uma tabela, um endpoint de leitura, uma chamada HTTP; `build.mjs` passa a buscar por HTTP | Endpoint + código no navegador ou na borda |
| Custo | Nenhum direto | Blob: centavos por mês nesse volume (usa o crédito do Pro); deploy hook sem custo | Invocações de função por visita |
| Reversibilidade | Alta | Alta: exportar a última versão para `site/conteudo/*.json` volta ao modelo atual em minutos | Média (mexe na página) |

Fontes (consultadas em 2026-11-15; conferir antes de configurar):
- [Vercel, Deploy Hooks](https://vercel.com/docs/deploy-hooks): exigem projeto **ligado a um repositório Git**; a URL não usa autenticação ("treat it with the same security as you would any other token or password"); 5 hooks por projeto no Pro; até 60 disparos por hora por projeto; disparos repetidos da mesma versão cancelam os builds anteriores do mesmo hook; não disparam com `github.enabled = false`.
- [Vercel Blob, server upload](https://vercel.com/docs/vercel-blob/server-upload): limite de 4,5 MB no corpo da requisição de uma função; acima disso, client upload. Stores conectados usam OIDC por padrão (`BLOB_STORE_ID`, `VERCEL_OIDC_TOKEN`); `BLOB_READ_WRITE_TOKEN` é opcional.
- [Vercel Blob, preços](https://vercel.com/docs/vercel-blob/usage-and-pricing): no Pro o uso é cobrado do crédito mensal (exemplo oficial: US$ 0,023/GB-mês de armazenamento); URL pública em `*.public.blob.vercel-storage.com`.
- [GitHub, installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app): expira em 1 hora; limitado aos repositórios e permissões do App.
- [GitHub, regras de rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets): "Restrict file paths" é regra de *push ruleset*, que bloqueia pushes em repositório **privado ou interno**; GitHub Apps podem entrar na lista de exceção.

## Decisão

**Opção B.** Com o repositório público, a opção A coloca no servidor que guarda pedidos e dados pessoais uma credencial capaz de reescrever o código do site e da loja (RISCO-12) e ainda exige a tabela de histórico no banco. A opção B usa peças que o projeto já tem (Postgres, Vercel, Blob previsto) e mantém o `build.mjs`.

| Item | Decisão |
|---|---|
| Fonte da verdade do conteúdo | Postgres da loja, tabela de **versões publicadas**: cada linha guarda o conteúdo completo (os 5 documentos no formato atual dos JSON, mais o campo novo `destino` dos cartões da Loja, CA-LOJ-58), quem publicou, quando e quais blocos mudaram em relação à versão anterior. Versões não são editadas nem apagadas. Schema físico: `dev-database` |
| Rascunho | Não existe no MVP (P-17, premissa). A edição fica no formulário até "Publicar"; falhou, a tela mantém o que foi digitado (CA-LOJ-55) |
| Módulo | `loja/src/modules/conteudo-site/`: validação dos 9 blocos (zod, já no projeto), `obterPublicado()`, `publicar(usuario, bloco, dados, versaoBase)`, `historico()`. A permissão é checada **dentro** de `publicar` e `historico` (`exigirPapel` + papel de P-15), não só na rota. A chamada ao deploy hook fica só dentro desse módulo |
| Publicar | 1) valida com as mesmas regras do `build.mjs`; 2) numa transação, confere que `versaoBase` ainda é a última (senão: "o conteúdo mudou, recarregue"), monta a versão nova (última versão + bloco editado) e grava; 3) chama o deploy hook com timeout curto; 4) se o hook falhar, marca a versão como não publicada e mostra "Não foi possível publicar, tente de novo". **Invariante:** o endpoint de leitura só devolve versão cujo disparo não falhou. A sequência exata é do `dev-react` |
| Leitura pelo site | Route Handler público `GET /api/conteudo-site` na loja: devolve **só** a última versão publicada (sem quem publicou nem outro dado da equipe), `Cache-Control: no-store`. Conteúdo já é público no site; um token de leitura é opcional (`dev-security` decide) |
| Build do site | `site/build.mjs` continua sem dependências e passa a buscar o conteúdo em `CONTEUDO_URL` (variável do projeto `nuyvi`, não é segredo) por `fetch` do Node. Falha de rede, resposta diferente de 200 ou conteúdo inválido **param o build** (comportamento atual), e a Vercel mantém o deploy anterior. `imagem()` passa a aceitar `img/…` (imagens versionadas) **ou** URL `https://` do host do Blob configurado, e mais nada. O botão dos cartões da Loja deixa de ser `#baixar` fixo e usa `destino`, validado (URL da loja ou âncora da página) |
| Disparo | Deploy hook do projeto `nuyvi` na branch de produção. URL só na variável `SITE_DEPLOY_HOOK_URL` da loja, ambiente **Production**. Em Preview, a variável não existe: publicar grava na branch do Neon e avisa que o site não foi atualizado |
| Fotos do conteúdo | Vercel Blob **público**, prefixo `conteudo/`, nomes com sufixo aleatório, upload pelo servidor (Server Action) com formato e tamanho de CA-LOJ-54 (limite efetivo abaixo de 4,5 MB). Uma foto enviada só aparece no site quando uma versão que a referencia é publicada. **Nenhuma foto é apagada** no MVP (versões antigas continuam válidas) |
| Ligação com o GitHub | O projeto `nuyvi` passa a ser ligado ao repositório (Root Directory `site`, branch de produção `main`): é pré-requisito do deploy hook. Isso também faz cada push em `site/` publicar o site; o `vercel deploy --prod` manual deixa de ser o caminho normal |
| `site/` depois da migração | Ficam `index.html`, `build.mjs` (alterado), `vercel.json`, CSS, JS e `img/`. **Saem** `site/conteudo/*.json` (a fonte passa a ser o banco; manter os dois cria divergência), `site/admin/` (Sveltia, D-04) e `site/img/conteudo/.gitkeep`. Para rodar o build local, `CONTEUDO_URL` aponta para a loja local ou de produção |
| Migração do conteúdo atual | Script único na loja insere a **versão 1** a partir dos 5 JSON atuais da branch `loja`, sem copiar imagens (os caminhos `img/…` continuam válidos), com autor "migração". Antes do corte: conferir que o HTML gerado a partir do endpoint é idêntico ao gerado a partir dos arquivos |

## Consequências

**Positivas**
- Nenhuma credencial de escrita no GitHub em lugar nenhum; o pior uso da URL vazada do hook é disparar builds.
- Histórico, permissão, MFA e auditoria da equipe valem para o conteúdo sem peça extra; voltar a uma versão (P-18) fica barato quando for pedido.
- O `build.mjs` e a página continuam iguais para quem visita: HTML estático, mesmo desempenho, mesmas validações.

**Negativas e custos aceitos**
- O conteúdo sai do Git: o histórico passa a estar no Neon (coberto pelo PITR do RNF-09), não nos commits.
- **Qualquer** build do site (inclusive um push de código em `site/`) precisa da loja no ar. Com a loja fora, o build falha e o site continua no deploy anterior; basta refazer depois (RISCO-11 cresce um pouco: atinge também mudanças de código do site).
- O site passa a ter imagens em dois lugares (`site/img/` para as atuais e as de layout, Blob para as enviadas pelo painel).
- Ligar o `nuyvi` ao GitHub num monorrepo: pushes em `loja/` também disparariam build do site, e vice-versa. O `dev-devops` configura o Ignored Build Step de cada projeto **sem bloquear os builds do deploy hook** (*não verificado* se o Ignored Build Step roda nos builds de hook; testar na configuração).
- O painel informa "publicado" quando o hook aceita o pedido, não quando o build termina. Um build que falhe depois (ex.: regra divergente entre o zod e o `build.mjs`) só aparece no e-mail de falha de deploy da Vercel. Mitigação: as mesmas regras nos dois lados e um teste de contrato (`dev-tests`).

**Riscos e mitigação**
- Divergência entre a validação do painel e a do `build.mjs`: teste de contrato que roda o `build.mjs` contra a saída de `obterPublicado()` com dados válidos e inválidos.
- Conteúdo com HTML ou script injetado: o `build.mjs` já escapa todo texto; manter e cobrir com teste. URLs de imagem e de destino só de origens permitidas.
- Upload malicioso (tipo falso, SVG com script): aceitar só formatos de bitmap definidos em CA-LOJ-54, conferir o tipo pelo conteúdo do arquivo e não aceitar SVG pelo painel (`dev-security`).
- Dado pessoal no conteúdo publicado (ex.: foto de pessoa sem autorização): responsabilidade do cliente (spec, seção 11); o painel não publica nada além dos campos do inventário.

## Quando revisitar

- Se um build do site falhar por loja fora do ar mais de uma vez num mês e isso atrapalhar: o `build.mjs` passa a usar, em último caso, uma cópia da última versão gravada no próprio deploy anterior (decidir com o `dev-devops`).
- Se o cliente pedir prévia (P-17) ou desfazer (P-18): rascunho e "republicar versão N" sobre a mesma tabela, sem mudar o mecanismo.
- Se a equipe reclamar de "publicou, mas não apareceu": mostrar no painel o estado do deploy pela API da Vercel (exige um token de leitura da Vercel no servidor; só com a dor).
- Se o site deixar de ser estático (ex.: migrar para Next.js): ler o conteúdo direto do banco com cache e revalidação ao publicar, em vez do deploy hook.
- Se a loja for desligada ou trocada (ADR-0001): exportar a última versão para `site/conteudo/*.json` e voltar ao build por arquivos.

## Impacto em outros agentes

- `dev-database`: tabela de versões do conteúdo (versão sequencial, conteúdo em `jsonb`, blocos alterados, autor com FK para `user.id`, estado do disparo), migration e índice da "última versão publicada".
- `dev-react`: módulo `conteudo-site`, telas do painel (com o `dev-uiux`), endpoint de leitura, upload para o Blob, chamada do hook, script de migração e as mudanças no `site/build.mjs` (`fetch`, hosts de imagem, `destino` dos cartões).
- `dev-auth`: papel de quem edita (P-15) e a checagem dentro do módulo.
- `dev-devops`: ligar `nuyvi` ao GitHub (Root Directory `site`, produção `main`), Ignored Build Step dos dois projetos sem barrar o hook, criar o deploy hook, variáveis `CONTEUDO_URL` (site) e `SITE_DEPLOY_HOOK_URL` (loja, só Production), sequência de corte.
- `dev-infra`: projeto `nuyvi` no time Pro da N.UY, store do Blob público e sua conexão com o projeto da loja (Production e Preview separados por prefixo ou store), domínio da loja para `CONTEUDO_URL`.
- `dev-security`: revisão do upload, do endpoint público (token de leitura ou não), da URL do hook e da validação de URLs.
- `dev-tests`: teste de contrato `build.mjs` × `obterPublicado()`, concorrência de `versaoBase`, falha do hook (versão não servida), permissão (CA-LOJ-56).
- `dev-integrations`: só revisão da semântica de falha e timeout do hook (é uma chamada HTTP; sem fila).
- `arquiteto-specs`: tirar as marcações `[PREMISSA: a confirmar pelo dev-arquitetura]` de RNF-14, CA-LOJ-59 e PREM-12, e fechar PEND-CONT na spec.
- `docs-handoff`: `BRIEFING.md` (seção "Painel de conteúdo") e manual da equipe depois da implementação.
