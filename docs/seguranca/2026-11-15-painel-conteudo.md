# Auditoria de segurança: painel de conteúdo do site (tarefa 14)

- **Data:** 2026-11-15 · **Branch:** `loja` @ `a04dc7f` + mudanças não commitadas (painel de conteúdo) · **Autor:** dev-security (somente leitura; nenhum código alterado)
- **Stack verificada no lockfile:** Next.js 16.4.6 (`cacheComponents`), React 19.3, Better Auth 1.7.25, Drizzle 0.45, Zod 4.6.7 (da aplicação), `@vercel/blob` 2.9.0, `sharp` 0.35.5 (instalado como dependência opcional do Next). Deploy previsto: Vercel. Repositório público.

## 1. Escopo

**Analisado:** `loja/src/app/api/conteudo-site/route.ts` e `foto/route.ts`; `loja/src/modules/conteudo-site/{foto,leitura,publicar,deploy-hook,permissao,schema}.ts`; `loja/src/app/admin/{layout,page}.tsx`, `admin/conteudo/{page,actions,estados,editor}.tsx`, `[bloco]/page.tsx`, `historico/page.tsx`; `loja/src/lib/env.ts`; `loja/src/modules/contas/papeis.ts` (`atende`); `loja/scripts/migrar-conteudo.mjs`; `site/build.mjs`, `site/index.html` (script que consome `#dados-planos`), `site/vercel.json`; `loja/.env.example`, `.gitignore`; `tests/conteudo-site/*` (cobertura); diff do workflow `loja-ci.yml`. Documentos: spec (CA-LOJ-50 a 59, RNF-13/14), ADR-0006, auditoria anterior `2026-11-14-auth-loja.md`.

**Executado:** `npm audit --omit=dev`; varredura por padrões de token do Blob e de URL de deploy hook no working tree e em `git log --all -p` (saída mascarada); conferência da doc local do Next 16.4.6 (`logging`); consulta à doc da Vercel (segurança do Blob) e ao GHSA-mrhx-c7xc-m3w5.

**Fora do escopo / não feito:** testes não foram executados (sem permissão nesta conversa); nenhum teste dinâmico (sem servidor rodando, sem upload real ao Blob); gitleaks e Semgrep não estão instalados; configuração real dos projetos na Vercel (variáveis por ambiente, store do Blob, WAF) não foi vista; editor (`editor.tsx`) lido só nos trechos de foto, URL e fetch. Achados da auditoria de 2026-11-14 não são repetidos, só citados quando afetam o painel. Auditoria por IA **não substitui pentest profissional** antes de a loja tratar pagamentos e dados pessoais reais.

## 2. Superfície de ataque (painel de conteúdo)

| Ponto de entrada | Acesso | Papéis | Dados |
|---|---|---|---|
| `GET /api/conteudo-site` | Público (de propósito) | Qualquer um | Última versão publicada (só vitrine) + header `X-Conteudo-Versao` |
| `POST /api/conteudo-site/foto` | Autenticado, Origin = Host | admin (`situacaoDeAcesso` + `exigirPapel` em `enviarFoto`) | Arquivo de imagem → Vercel Blob público |
| Server Action `publicarBloco` | Autenticado | admin (`situacaoDeAcesso` + `exigirPapel` em `publicar`) | Bloco do conteúdo; dispara o deploy hook |
| Server Action `consultarSituacao` | Autenticado | admin (`situacao` → `exigirPapel`) | Número da versão, pendente sim/não |
| `/admin/conteudo`, `/admin/conteudo/[bloco]`, `/admin/conteudo/historico` | Autenticado | admin (`barrarSeNaoPuder` + `exigirPapel` em `lerPainel`/`historico`) | Conteúdo, nome de quem publicou |
| `/admin` (layout e início) | Autenticado | operador+ (menu de conteúdo só para admin) | Nome do usuário |
| `site/build.mjs` (build na Vercel) | Interno | — | Lê `CONTEUDO_URL`, gera HTML estático |
| `scripts/migrar-conteudo.mjs` | CLI local | Quem tem `DATABASE_URL` | Conteúdo de `site/conteudo/*.json` |

## 3. Modelagem de ameaças (resumo)

| Ativo | Ameaça | Entrada | Controle existente | Risco residual |
|---|---|---|---|---|
| Site público (reputação, visitantes) | XSS persistente via conteúdo | Server Action → banco → build | Zod no servidor, `esc()` no build, allowlist de imagem/link/destino, JSON com `<` escapado | Baixo |
| Privacidade da equipe | Localização (GPS) nos metadados de foto pública | Upload | Nenhum | **Médio (M-01)** |
| Builds do site / cota | Disparo abusivo | URL do hook | Hook só no servidor, nunca logado; só admin publica; uma pendente por vez | Baixo |
| Banco/funções da loja | Abuso de custo no endpoint público | `GET /api/conteudo-site` | Nenhum limite | Baixo (B-01) |
| Conteúdo do site | Edição por operador/cliente | Actions, rota de foto, páginas | `exigirPapel("admin")` na camada de dados + testes de módulo | Baixo |

## 4. Achados

### Média

#### M-01. Fotos vão ao Blob público com metadados intactos (EXIF/GPS) e sem decodificação real
- **Onde:** `loja/src/modules/conteudo-site/foto.ts:35-45` (só confere os primeiros bytes e envia o `File` original com `put(...)`).
- **Referência:** OWASP File Upload Cheat Sheet; CWE-359 (exposição de informação privada); ASVS V12.
- **Descrição:** a checagem por assinatura (FF D8 FF / PNG / RIFF…WEBP) está correta como filtro de formato, mas o arquivo é publicado byte a byte. Foto tirada no celular carrega EXIF com coordenadas GPS, data/hora, modelo do aparelho e, às vezes, nome do dono. Além disso, qualquer arquivo que comece com a assinatura passa (ex.: 3 bytes de JPEG seguidos de qualquer coisa), porque a imagem nunca é decodificada.
- **Cenário conceitual:** o admin fotografa um produto em casa e envia. A foto vai para o site; qualquer visitante baixa e lê o EXIF com uma ferramenta comum, obtendo o endereço onde a foto foi tirada. A URL do Blob também é pública antes de publicar (sufixo aleatório, então só quem a conhece).
- **Polyglot / execução:** risco **baixo** neste desenho. O Blob é servido em domínio separado do site e da loja; o `contentType` é fixado pelo servidor como `image/*`; e a Vercel documenta que todo blob é entregue com `content-security-policy: default-src "none"`, `x-content-type-options: nosniff` e `x-frame-options: DENY`. O ganho da correção abaixo é sobretudo de privacidade e integridade (só imagem de verdade).
- **Impacto:** dado pessoal da equipe (localização, possivelmente residência) exposto publicamente e indexável; tema LGPD e de segurança física.
- **Correção recomendada (dev-react; padrão `05-upload-seguro.md`, item "reencodar imagens"):** reencodar com `sharp` (já presente no lockfile via Next; declarar como dependência direta), que por padrão **remove todos os metadados**, aplica a orientação e falha em arquivo que não decodifica:
  ```ts
  import sharp from "sharp";
  // depois de detectarFormato(bytes) e antes do put:
  let saida: Buffer;
  try {
    const img = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" }).rotate(); // rotate(): aplica a orientação do EXIF antes de descartá-lo
    saida = await (formato === "jpeg" ? img.jpeg({ quality: 85, mozjpeg: true }) : formato === "png" ? img.png() : img.webp({ quality: 85 })).toBuffer();
  } catch {
    return { ok: false, motivo: "formato", mensagem: "Formato não aceito. Envie JPEG, PNG ou WebP." };
  }
  const blob = await put(`conteudo/foto.${f.ext}`, saida, { access: "public", addRandomSuffix: true, contentType: f.tipo, abortSignal: AbortSignal.timeout(30_000) });
  ```
  Não chamar `.keepMetadata()`/`.withMetadata()`. Opcional (decisão do dev-performance-seo): `resize({ width: 2400, withoutEnlargement: true })` no mesmo passo. Confirmar na doc do `sharp` 0.35 os nomes `limitInputPixels`/`failOn` antes de aplicar.
- **Teste que prova o fechamento (dev-tests):** gerar no teste um JPEG com EXIF de GPS (`sharp(...).withExif({ IFD3: { GPSLatitude: ... } })`), enviar por `enviarFoto` com o `put` simulado, e verificar que o buffer entregue ao `put` tem `(await sharp(buf).metadata()).exif === undefined`. E: arquivo `FF D8 FF` + lixo → `motivo: "formato"` e `put` não chamado. Ambos falham com o código atual.
- **Fotos já enviadas:** se alguma foto de celular já foi publicada por este fluxo, reenviar depois da correção (as atuais em `site/img/` não passam por aqui).

### Baixa

#### B-01. `GET /api/conteudo-site` sem limite de taxa (custo e carga no banco). Decisão sobre token de leitura: **não exigir**
- **Onde:** `loja/src/app/api/conteudo-site/route.ts:7-15`.
- **Verificado:** devolve só `conteudo` da última versão `aceito`, já passado pelo `conteudoSchema` (Zod remove chaves desconhecidas); nada de autor, data, histórico, versão pendente ou que falhou; `no-store`; erro com texto fixo. **Sem vazamento de dados da equipe.** O header `X-Conteudo-Versao` revela só quantas versões existem: aceitável.
- **Token de leitura (decisão pedida pelo ADR-0006):** não é necessário. O conteúdo já é público no site; um token não protege confidencialidade e adiciona um segredo a gerir no projeto do site. O único risco real é abuso de custo: cada chamada abre uma consulta no Postgres e uma invocação de função.
- **Cenário:** um script chama o endpoint em laço; o banco e as funções da loja (que também servem checkout e painel) gastam cota e respondem mais devagar.
- **Correção (dev-infra):** regra de rate limit na borda (Vercel Firewall/WAF) para o caminho `/api/conteudo-site`, por IP, folgada para o build (ex.: 30 req/min). Não usar cache de CDN aqui: quebraria "build logo após publicar vê a versão nova". Se um dia o endpoint passar a expor algo além da vitrine, reavaliar o token.
- **Teste:** em preview, a 31ª chamada no mesmo minuto recebe 429; o build do site continua passando.

#### B-02. Allowlist de imagem aceita qualquer store do Blob, e fotos enviadas ficam públicas para sempre
- **Onde:** `loja/src/modules/conteudo-site/schema.ts:17` e `site/build.mjs:37` (`/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/`); ADR-0006 ("nenhuma foto é apagada").
- **Descrição:** a validação aceita URL de **qualquer** store público do Vercel Blob, não só o da loja. Uma conta admin comprometida (ou um erro) pode publicar imagem hospedada no store de terceiros, que o terceiro troca depois sem passar pelo painel e que registra o IP dos visitantes. Separadamente, foto enviada e nunca publicada (ou trocada) continua acessível na URL para sempre.
- **Impacto:** pequeno, exige conta admin; o segundo ponto vira tema de LGPD se a foto tiver pessoa identificável (pedido de remoção).
- **Correção (dev-react):** fixar o host do store da loja (o ID do store não é segredo) numa constante nos dois arquivos, ou numa variável lida pelos dois (ex.: `BLOB_PUBLIC_HOST`), e manter o teste de contrato `schema.ts` × `build.mjs`. Para remoção: procedimento manual documentado (apagar o blob pelo painel da Vercel e republicar o bloco) até haver limpeza automática (lgpd-specialist define quando é obrigatório).
- **Teste:** `imagemValida("https://outrostore.public.blob.vercel-storage.com/conteudo/x.jpg") === false` e o build recusa a mesma URL.

#### B-03. Zod vulnerável (GHSA-mrhx-c7xc-m3w5) puxado por `@vercel/blob`, não alcançável
- **Onde:** `@vercel/blob@2.9.0` → `@vercel/oidc@3.8.10` → `@vercel/cli-config@0.3.1` → `zod@4.1.11` (fixo). `npm audit --omit=dev` marca 4 itens "high" por isso.
- **Análise:** o aviso trata de esgotamento de memória ao validar arrays enormes sem limite; corrigido no Zod 4.6.6. Essa cópia do Zod só valida os arquivos locais de configuração da CLI da Vercel (`cli-config/dist/schema.js`), não entrada de usuário. O Zod da aplicação é 4.6.7 (corrigido). **Não rodar `npm audit fix --force`**: ele rebaixa `@vercel/blob` para 2.4.0.
- **Correção (dev-react):** `"overrides": { "@vercel/cli-config": { "zod": "^4.6.6" } }` no `loja/package.json`, `npm install`, e rodar a suíte (upload simulado) antes de commitar; ou aguardar versão nova do `@vercel/oidc`. Essa informação pode estar desatualizada: confira no GitHub Advisory Database.

#### B-04. Site estático sem headers de segurança (segunda barreira contra XSS vindo do conteúdo)
- **Onde:** `site/vercel.json` (só `buildCommand`).
- **Descrição:** o escape no build está correto (ver I-04), mas o site não tem CSP, `nosniff` nem `frame-ancestors`. Se uma regressão futura no `build.mjs` deixar passar HTML, nada segura a execução.
- **Correção (dev-devops com dev-infra):** `headers` no `site/vercel.json` com `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` e CSP em **Report-Only** primeiro. A página tem script inline (`site/index.html`, por volta da linha 688), então a CSP precisa de hash desse script ou `'unsafe-inline'`; `img-src` deve incluir `'self'` e o host do store do Blob.
- **Teste:** `curl -sI` na URL do site mostra os headers; nenhuma violação na Report-Only em navegação normal.

### Informativo (verificado, sem achado)

- **I-01. Autorização:** toda função do módulo que lê dados da equipe ou escreve chama `exigirPapel(PAPEL_CONTEUDO)` (`foto.ts:32`, `publicar.ts:40`, `leitura.ts:52,58,89`); as Server Actions e a rota pré-checam com `situacaoDeAcesso` só para escolher a mensagem. `atende()` (`papeis.ts:13`) é só comparação de nível; `exigirPapel` continua revalidando o papel no banco a cada chamada e exigindo e-mail confirmado. Páginas `/admin/conteudo*` leem dados só abaixo de `barrarSeNaoPuder` e de funções com `exigirPapel` (regra I-01 da auditoria anterior respeitada). `obterPublicado` é pública de propósito e só devolve vitrine. Testes de módulo cobrem operador e cliente em foto, publicar, painel e histórico.
- **I-02. Entrada das actions:** `bloco` por allowlist (`Object.hasOwn(BLOCOS, …)`), `versaoBase` inteiro ≥ 0, `dados` pelo schema do bloco; o conteúdo novo é refeito com `conteudoSchema.parse` (chaves extras descartadas, sem mass assignment). `autor_id` vem da sessão. SQL só por template com parâmetros do Drizzle. Strings e listas não têm máximo, mas o corpo de Server Action é limitado a 1 MB e só admin chega lá: aceitável.
- **I-03. CSRF no upload:** cookie `SameSite=Lax` já impede o envio cross-site com sessão; a checagem `Origin` = `Host` (`foto/route.ts:8-14`) recusa ausência de Origin e `null`, e roda antes de ler o corpo. Corpo lido só após autenticação; na Vercel o limite de 4,5 MB é da plataforma (fora da Vercel, `request.formData()` bufferiza o corpo inteiro antes de checar o tamanho, mas só para admin). Falta um teste da checagem de Origin na rota (dev-tests, baixo).
- **I-04. Injeção no site estático:** `build.mjs` escapa todo texto (`esc`, inclusive aspas), aceita imagem só de `img/` (sem `..`) ou do Blob (https, sem porta/usuário/query/hash, pasta `conteudo/`, extensão de bitmap, `href === valor`), `link` do Explore por allowlist, `posicao` por regex estrita, `destino` por regex com `LOJA_URL` validada (https), JSON do `<script type="application/json">` com `<` → `<`. O script da página monta os planos com `innerHTML` (`site/index.html:692-699`) a partir de valores **já escapados no build**: seguro hoje, mas é um contrato implícito. O teste de contrato já cobre `<script>` em título e selo; manter um caso para cada campo que entra no `innerHTML` se o script mudar. `CONTEUDO_URL` com `redirect: 'error'`, https e timeout. Sem achado.
- **I-05. Deploy hook:** URL lida só em `deploy-hook.ts`; erros e `disparo_erro` são textos fixos (`hook respondeu <status>`, `tempo esgotado`, `sem resposta`); `redirect: "manual"`, timeout de 8 s, corpo descartado; mensagem de env inválida não ecoa valores (`env.ts`). Sem a variável: falha em produção (`VERCEL_ENV=production`), "aceito com aviso" fora dela. O fixture de teste (`tests/conteudo-site/dados.ts:27`) é falso. Não ligar `logging.fetches.fullUrl` no `next.config.ts` (em dev imprimiria a URL). A confirmar (dev-infra): se o painel de Observability da Vercel registra o caminho completo das chamadas externas; se registrar, o acesso ao painel da Vercel passa a ser acesso ao hook. Garantir também que Preview da loja **não** use o banco de produção (lá a publicação vira "aceito" sem disparar o build).
- **I-06. RNF-13 e segredos:** nenhum token do Blob ou URL de hook real no working tree nem no histórico (`git log --all -p`); `.env*` ignorado nos dois `.gitignore`; `.env.example` só com nomes vazios e avisos de segredo. `migrar-conteudo.mjs` só lê os JSON de vitrine versionados, grava versão sem autor e não imprime `DATABASE_URL`. A remoção do Sveltia (`site/admin/*`) tira do site um painel que dependia de login no GitHub: ganho. **Nada a rotacionar.**

## 5. Encaminhamentos

| Agente | O que fazer |
|---|---|
| dev-react | M-01 (reencodar com `sharp`), B-02 (fixar host do store), B-03 (override do Zod). Ao implementar o M-02 da auditoria anterior (headers da loja), incluir `img-src` com o host do Blob e o `SITE_PUBLIC_URL` (miniaturas do editor) e `frame-ancestors 'none'`: o botão Publicar hoje pode ser enquadrado (clickjacking). |
| dev-infra | B-01 (regra de rate limit em `/api/conteudo-site`); confirmar I-05 (Observability e banco do Preview); HSTS do site. |
| dev-devops | B-04 (headers no `site/vercel.json`); `SITE_DEPLOY_HOOK_URL` só no ambiente Production. |
| dev-tests | Testes de M-01 e B-02; teste da checagem de Origin na rota de upload. |
| dev-auth | Bloqueante já registrado: **MFA obrigatório para admin antes do go-live do painel** (M-03 da auditoria anterior; spec, fase 1a e RISCO-14). Uma conta admin comprometida publica no site público. |
| lgpd-specialist | Fotos com pessoas e fotos de celular: orientar a equipe, e definir o procedimento de remoção de blobs (B-02). |

## 6. Ferramentas

- `npm audit --omit=dev`: 8 itens (4 high, 4 moderate). High: Zod aninhado via `@vercel/blob` (B-03, não alcançável). Moderate: `esbuild`/`drizzle-kit` (já analisado e aceito na auditoria anterior, só ferramenta de desenvolvimento).
- Varredura de segredos (padrões de token do Blob e de deploy hook, working tree e histórico): **0** reais; 1 fixture de teste falso (descartado).
- gitleaks e Semgrep: não instalados. Comandos: `gitleaks git --redact -v /home/maiasb/codes/nuyvi` e `semgrep scan --config p/typescript --config p/nextjs loja/src site/build.mjs`.
- Testes: não executados. Recomendados após as correções: `cd loja && npm test -- tests/conteudo-site` (Postgres local de teste no ar).

## 7. Checklist final

- **Corrigido nesta auditoria:** nada (somente leitura).
- **Antes de publicar fotos reais pelo painel:** M-01.
- **Antes do go-live do painel:** MFA da equipe (M-03 anterior), headers da loja (M-02 anterior), B-01, B-04.
- **Quando der:** B-02, B-03.
- **Segredos a rotacionar:** nenhum.
- **Nova auditoria:** quando o destino "categoria/<slug>" da Loja entrar, se surgir papel só de conteúdo (P-15) ou se o upload passar a client upload (acima de 4,5 MB).
- **Limitação:** análise estática feita por IA, sem teste dinâmico; não substitui pentest profissional.

## Fontes

- Vercel, [Vercel Blob security](https://vercel.com/docs/vercel-blob/security) (headers de entrega dos blobs).
- GitHub Advisory Database, [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) (Zod, corrigido na 4.6.6).
- Doc local do Next 16.4.6: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/logging.md`.
