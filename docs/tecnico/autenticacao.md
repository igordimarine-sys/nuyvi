# Autenticação e papéis da loja

Biblioteca: **Better Auth 1.7.25** (`better-auth` + adaptador Drizzle), conforme [ADR-0004](../adr/ADR-0004-stack-loja.md). Conta da loja separada da conta do app N.UY ([ADR-0003](../adr/ADR-0003-login-proprio-e-desconto-suspenso-no-mvp.md), RN-LOJ-21). Código: `admin/src/lib/auth.ts`, `admin/src/modules/contas/`, `admin/src/modules/pedidos/token-acompanhamento.ts`, schema em `admin/src/db/schema/auth.ts`.

## Fluxos (e-mail e senha; Google só para clientes, spec v0.8 CA-LOJ-81 a 88)

- **Cadastro:** `/cadastrar`. Senha de 10 a 128 caracteres (hash scrypt, padrão da lib), recusada se constar de vazamento: plugin `haveIBeenPwned` envia só os 5 primeiros caracteres do SHA-1 (k-anonimato) a `api.pwnedpasswords.com`; se esse serviço estiver fora, o cadastro/redefinição falha em vez de aceitar sem checar. Resposta idêntica para e-mail novo e já existente; o dono de um e-mail já cadastrado recebe um aviso. Sem e-mail confirmado não existe sessão.
- **Confirmação:** link por e-mail (token assinado, 1 hora); `/confirmar-email` reenvia. Confirmar o e-mail **não** vincula pedidos de visitante (auditoria A-01: quem cadastra conhece a senha mas pode não ser o dono da caixa postal).
- **Vínculo de pedidos de visitante (CA-LOJ-47, premissa revisada):** ação explícita em `/vincular-pedidos` (`vincular-pedidos.ts`). Logado e com e-mail confirmado, o usuário pede o vínculo; o link vai ao e-mail da conta, assinado (HMAC com o segredo da lib), preso a usuário + sessão + e-mail, válido por 30 minutos e só funciona na mesma sessão que pediu; a confirmação é um POST (Server Action). Sem estado no banco (repetir é idempotente). Falta limite próprio de envio (o link só vai ao e-mail da própria conta). O CA-LOJ-47 da spec ainda diz "aparecem após criar conta e confirmar o e-mail": precisa de atualização pelo arquiteto-specs.
- **Login / sair:** `/login`; mensagem única para credencial errada ou e-mail não confirmado. Sessão de 7 dias, cookie `HttpOnly`, `SameSite=Lax`, `Secure` (e prefixo `__Secure-`) em produção.
- **Entrar com Google (clientes):** provedor `google` do Better Auth (código + PKCE, `prompt=select_account`), botão em `/login` e `/cadastrar` só com `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Retorno em `/api/auth/callback/google`; falha volta para `/login?error=<código>` (a tela traduz `access_denied`, `account_not_linked`, `email_not_verified`, `CONTA_EQUIPE`). Regras: e-mail novo cria cliente confirmado; Google sem `email_verified` não ganha sessão (`requireEmailVerification` no provedor); conta existente **confirmada** recebe o vínculo (a senha continua valendo); conta existente **não confirmada** não é vinculada (`requireLocalEmailVerified`, contra pré-sequestro: quem cadastrou o e-mail alheio conheceria a senha) e a pessoa é orientada a confirmar o e-mail ou usar "Esqueci a senha". **Equipe recusada:** `databaseHooks` barram a criação de conta não-`credential` e a sessão criada em `/callback/*` ou `/sign-in/social` para `operador`/`admin` (vale também para cliente que vinculou o Google e depois foi promovido). Tokens do Google cifrados no banco (`encryptOAuthTokens`; a loja não os usa). Volta: `callbackURL` = `voltaSegura(volta)` e o Better Auth recusa origem de fora (checagem desligada pela lib em teste, então isso não está coberto em `tests/contas/login-google.test.ts`). Login pelo Google não vincula pedidos de visitante.
- **Recuperação:** `/esqueci-senha` (resposta sempre igual) e `/redefinir-senha?token=`. Token de uso único, 30 minutos, guardado com hash no banco; ao redefinir, todas as sessões da conta são revogadas.

## Papéis

`cliente` < `operador` < `admin` (coluna `user.role`, com CHECK). O cadastro e o perfil não aceitam `role` (`input: false`; testado enviando `role: admin` no cadastro: ignorado). O **primeiro admin** (e qualquer promoção) só pelo script: `npm run admin:criar -- email "Nome"` (senha lida do terminal ou do stdin; nunca em argumento, código ou Git). Conta existente **não verificada**: o script recusa (pré-sequestro, A-02). Conta existente verificada: promove, define a senha nova informada (a atual pode ser de quem cadastrou antes) e apaga as sessões dela.

## Onde a checagem acontece

`exigirPapel(minimo)` em `modules/contas/papeis.ts`: lê a sessão no banco a cada chamada (mudança de papel vale na hora) e exige e-mail confirmado. Sem sessão redireciona para `/login`; papel insuficiente dá 404. **Deve ser chamada em toda página, Server Action e Route Handler protegido**, no ponto de acesso aos dados; não há `proxy.ts` e ele não substituiria isso. Com `cacheComponents`, a leitura da sessão fica dentro de `<Suspense>`, então a resposta HTTP de `/admin` é 200 e o redirecionamento/404 chega no fluxo de streaming (nenhum dado do painel é renderizado antes da checagem).

## Rate limit

Do próprio Better Auth, contador no Postgres (tabela `rate_limit`, vale em serverless, custa uma consulta por chamada). Por IP e rota, janela de 60 s: login 5, cadastro 5, pedir recuperação 3, redefinir 5, reenviar confirmação 3, início do Google (`/sign-in/social`) 10, retorno do Google (`/callback/*`) 10. Limites: não há bloqueio por conta (só por IP); chamadas via `auth.api` no servidor não passam pelo limitador (por isso as telas usam o cliente HTTP); o IP vem de `advanced.ipAddress.ipAddressHeaders`: em produção só `x-vercel-forwarded-for` (definido pela Vercel; conferir no preview, dev-infra); fora de produção `x-forwarded-for`, e sem proxy a lib usa 127.0.0.1 (testado: 5 tentativas, a 6ª dá 429). Se o IP de produção não chegar, todos caem no mesmo contador (bloqueio geral): por isso a conferência.

## Link de acompanhamento do visitante

`modules/pedidos/token-acompanhamento.ts`: token de 256 bits (CSPRNG, base64url) só no link do e-mail; o banco guarda o SHA-256 e `token_expira_em`; verificação em tempo constante. **Premissa** (dev-security confirma): validade de 90 dias; novo envio rotaciona e invalida o anterior. Sem rota de UI ainda; a página futura deve mostrar só estado, itens, total e rastreio (CA-LOJ-49), nunca CPF/endereço completos.

## E-mail

`modules/contas/enviar-email.ts` é o ponto único e ainda não envia: em desenvolvimento grava em `admin/.dev-outbox/` (ignorado pelo Git); fora dele registra só o tipo. Provedor, templates e reenvio: dev-notifications. A `emails_saida` atual é por pedido e não serve para e-mail de conta.

## Divergência com a spec

A tabela de estados de erro (seção de telas) lista "E-mail já cadastrado"; foi **não** implementado de propósito, para não revelar quais e-mails têm conta.
