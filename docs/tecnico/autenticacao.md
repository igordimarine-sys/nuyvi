# Autenticação e papéis da loja

Biblioteca: **Better Auth 1.7.25** (`better-auth` + adaptador Drizzle), conforme [ADR-0004](../adr/ADR-0004-stack-loja.md). Conta da loja separada da conta do app N.UY ([ADR-0003](../adr/ADR-0003-login-proprio-e-desconto-suspenso-no-mvp.md), RN-LOJ-21). Código: `loja/src/lib/auth.ts`, `loja/src/modules/contas/`, `loja/src/modules/pedidos/token-acompanhamento.ts`, schema em `loja/src/db/schema/auth.ts`.

## Fluxos (só e-mail e senha; login social fica para fase seguinte, a spec não pede)

- **Cadastro:** `/cadastrar`. Senha de 10 a 128 caracteres (hash scrypt, padrão da lib). Resposta idêntica para e-mail novo e já existente; o dono de um e-mail já cadastrado recebe um aviso. Sem e-mail confirmado não existe sessão.
- **Confirmação:** link por e-mail (token assinado, 1 hora); `/confirmar-email` reenvia. Ao confirmar, os pedidos de visitante com o mesmo e-mail passam para a conta (CA-LOJ-47, `vincular-pedidos.ts`, só no hook de e-mail confirmado).
- **Login / sair:** `/entrar`; mensagem única para credencial errada ou e-mail não confirmado. Sessão de 7 dias, cookie `HttpOnly`, `SameSite=Lax`, `Secure` (e prefixo `__Secure-`) em produção.
- **Recuperação:** `/esqueci-senha` (resposta sempre igual) e `/redefinir-senha?token=`. Token de uso único, 30 minutos, guardado com hash no banco; ao redefinir, todas as sessões da conta são revogadas.

## Papéis

`cliente` < `operador` < `admin` (coluna `user.role`, com CHECK). O cadastro e o perfil não aceitam `role` (`input: false`; testado enviando `role: admin` no cadastro: ignorado). O **primeiro admin** (e qualquer promoção) só pelo script: `npm run admin:criar -- email "Nome"` (senha lida do terminal ou do stdin; nunca em argumento, código ou Git).

## Onde a checagem acontece

`exigirPapel(minimo)` em `modules/contas/papeis.ts`: lê a sessão no banco a cada chamada (mudança de papel vale na hora) e exige e-mail confirmado. Sem sessão redireciona para `/entrar`; papel insuficiente dá 404. **Deve ser chamada em toda página, Server Action e Route Handler protegido**, no ponto de acesso aos dados; não há `proxy.ts` e ele não substituiria isso. Com `cacheComponents`, a leitura da sessão fica dentro de `<Suspense>`, então a resposta HTTP de `/admin` é 200 e o redirecionamento/404 chega no fluxo de streaming (nenhum dado do painel é renderizado antes da checagem).

## Rate limit

Do próprio Better Auth, contador no Postgres (tabela `rate_limit`, vale em serverless, custa uma consulta por chamada). Por IP e rota, janela de 60 s: login 5, cadastro 5, pedir recuperação 3, redefinir 5, reenviar confirmação 3. Limites: não há bloqueio por conta (só por IP); chamadas via `auth.api` no servidor não passam pelo limitador (por isso as telas usam o cliente HTTP); o IP vem de `X-Forwarded-For`, que na Vercel é definido pela plataforma, mas deve ser conferido em produção (sem IP, todos caem no mesmo contador).

## Link de acompanhamento do visitante

`modules/pedidos/token-acompanhamento.ts`: token de 256 bits (CSPRNG, base64url) só no link do e-mail; o banco guarda o SHA-256 e `token_expira_em`; verificação em tempo constante. **Premissa** (dev-security confirma): validade de 90 dias; novo envio rotaciona e invalida o anterior. Sem rota de UI ainda; a página futura deve mostrar só estado, itens, total e rastreio (CA-LOJ-49), nunca CPF/endereço completos.

## E-mail

`modules/contas/enviar-email.ts` é o ponto único e ainda não envia: em desenvolvimento grava em `loja/.dev-outbox/` (ignorado pelo Git); fora dele registra só o tipo. Provedor, templates e reenvio: dev-notifications. A `emails_saida` atual é por pedido e não serve para e-mail de conta.

## Divergência com a spec

A tabela de estados de erro (seção de telas) lista "E-mail já cadastrado"; foi **não** implementado de propósito, para não revelar quais e-mails têm conta.
