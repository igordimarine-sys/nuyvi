# TODO

## Em andamento

## Pendente
- Loja: projeto Vercel da loja (Root Directory `loja/`, sem afetar o de `site/`) e Neon com `main` para produção e branch por preview; definir como as migrations rodam em produção (etapa controlada, não no build); roles separadas no Neon `app_rw`/`app_migrate` (dev-devops + dev-infra, quando as contas da N.UY existirem).
- Loja: proteção da branch `main` com o check `loja-ci / check` obrigatório (aguarda confirmação do desenvolvedor). Considerar fixar actions por SHA e ligar o Dependabot.
- Loja: testes de integração contra o Postgres real: reserva concorrente, baixa, expiração, webhook duplicado, reconciliação `fisico = SUM(movimentos)`, transições de pedido, desconto do pedido = soma dos itens (dev-tests).
- Loja: pagamento que chega depois de `expira_em` (reserva pode ter ido para outro pedido), formato do `evento_id` por gateway, cron de expiração e e-mail (dev-integrations).
- Loja: retenção e anonimização de pedidos e de `gateway_eventos.payload` (lgpd-specialist).
- Loja: tabela de troca/devolução depende de P-10; frete grátis de P-06; estorno pelo operador de P-08.
- Loja: conferir o primeiro run do CI no GitHub (`actionlint` não estava instalado; só o YAML foi validado).
- Loja: `npm audit` acusa 8 vulnerabilidades moderadas nas dependências do create-next-app; avaliar (dev-security).
- Ligar o projeto `nuyvi` da Vercel ao repositório do GitHub (Root Directory `site`) para cada edição do painel publicar sozinha. Na primeira publicação, conferir se a Vercel roda o `node build.mjs` e serve a pasta `site` (`buildCommand` em `site/vercel.json`, saída padrão do preset "Other").
- Testar o painel em produção: entrar com token, editar um produto, salvar, conferir o commit e o site atualizado.
- Push da branch `painel` e teste do painel com token nela. Ao juntar na `main`, trocar `branch: painel` para `branch: main` em `site/admin/config.yml`.
- Fotos reais do cliente em alta resolução, notícias reais, links das lojas (vindos do BRIEFING).
- Loja: enviar ao cliente as perguntas ainda abertas da seção 13 de `docs/specs/loja.md` (C-01, P-03, P-05 a P-14) e atualizar a spec para 1.0 com as respostas (arquiteto-specs).
- Loja: verificar a integração com o Base44 para o desconto de assinante (PEND-B44: API/funções de backend do Base44, vínculo de contas por e-mail verificado ou alternativa) na documentação oficial e testando no app; registrar ADR da fase 1b (desenvolvedor + dev-integrations + dev-auth). Confirmar acesso de edição ao app no Base44 (D-02).
- Loja: C-01, o desconto da loja vale no plano mensal ou só no anual? (cartões dos planos × seção Bônus do site).
- Loja: P-14, decidir com o cliente se os textos do site que prometem desconto de assinante mudam enquanto o MVP vende sem desconto (copywriter).
- Loja: NF-e, saber se a N.UY já emite, em qual sistema e quem é o contador (P-09); cliente validar nota e tributos com o contador e termos/troca/arrependimento com advogado.
- Loja: frete e área de entrega (Correios/transportadora/motoboy, onde entrega, frete grátis) (P-06).
- Loja: gateway de pagamento (conta existente, parcelamento) (P-07) e ADR de gateway (dev-integrations).
- Loja: N.UY criar (ou dar acesso a) contas Vercel Pro, Neon e gateway em nome dela; definir o subdomínio da loja.
- Loja (fundação 3): login próprio com Better Auth (indicação); depois do schema dele, FK `pedidos.usuario_id -> user.id ON DELETE SET NULL`; papéis `cliente`/`operador`/`admin`, checagem de papel na camada de módulo e acesso de visitante ao pedido por link (dev-auth, revisão do dev-security).
- Loja (fundação 4): projeto Neon (Launch, `aws-sa-east-1`, PITR para RPO de 1 h), projeto Vercel da loja no Pro com região das funções perto do banco (conferir `gru1`), Vercel Blob para fotos e subdomínio (dev-infra).
- Loja (fundação 5): escolher o gateway entre os candidatos (Mercado Pago, Pagar.me, Asaas; Stripe se tiver Pix para conta BR), desenhar o webhook idempotente, o cron de expiração com conferência no gateway e o envio de e-mail fora da requisição (dev-integrations).
- Loja: login próprio (comprador e equipe), compra como visitante e link de acompanhamento do pedido (dev-auth + dev-security).
- Loja: nada de segredos, dados de clientes ou exportações no Git (repositório público), RNF-13.
- Loja: revisão de privacidade (dados de visitante, vínculo de pedidos à conta, menores, retenção) com lgpd-specialist.
- Loja: se for proposta ao cliente, orçamento do MVP com orcamentos-propostas (D-03).
- Loja: quando a loja tiver URL, trocar o botão "Comprar no app" da seção Loja pelo link da categoria e revisar o título "Equipado sem sair do app" (copywriter); manter preços e estoque fora de `site/conteudo/loja.json`.

## Feito
- 2026-11-14: Loja (fundação 1, ambiente): Postgres 17 em Docker em `127.0.0.1:5436`, scripts `db:*` lendo `.env.local`, CI `.github/workflows/loja-ci.yml`.
- 2026-11-14: Loja (fundação 2): modelo de dados Drizzle, 15 tabelas, migration `loja/drizzle/0000_modelo_inicial.sql` aplicada no local; decisões em `docs/tecnico/banco.md`.
- 2026-11-14: Loja (fundação 1, código): esqueleto em `loja/` (Next.js 16.4.6, TypeScript estrito, Drizzle + `pg`, validação de `DATABASE_URL`, `.env.example`, ponto de extensão `obterPlanoVigente`).
- 2026-11-14: Loja: ADR-0004 aprovado; contas da loja ficam em nome da N.UY.
- 2026-11-14: Loja: stack e arquitetura macro propostas (`docs/adr/ADR-0004-stack-loja.md`, `docs/tecnico/arquitetura.md`): Next.js + TypeScript + Drizzle + Neon Postgres na Vercel Pro, monolito modular em `loja/`.
- 2026-11-14: painel `/admin` (Sveltia CMS) com conteúdo em `site/conteudo/*.json` e `site/build.mjs` gerando os trechos editáveis do `index.html`.
