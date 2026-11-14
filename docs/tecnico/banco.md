# Banco de dados da loja (PostgreSQL, Drizzle)

Schema: `loja/src/db/schema/` (um arquivo por módulo). Migrations: `loja/drizzle/` (`npm run db:generate`, `npm run db:migrate`). Dinheiro em centavos inteiros; instantes em `timestamptz`; ids `uuid` (`gen_random_uuid()`), exceto `pedidos.numero` (identity, a partir de 1000, número amigável).

## Tabelas

| Módulo | Tabelas |
|---|---|
| catalogo | `categorias`, `produtos`, `produto_fotos` (URL do Blob), `variacoes` (SKU único, preço) |
| estoque | `estoque_saldos` (físico, CHECK >= 0), `estoque_movimentos` (entrada/ajuste/venda/estorno, com sinal), `estoque_reservas` (com `expira_em`) |
| pedidos | `pedidos` (dados do comprador, endereço e valores congelados), `pedido_itens`, `pedido_historico` |
| pagamentos | `pagamentos` (tentativas), `gateway_eventos` (idempotência), `estornos` |
| frete | `frete_faixas` (faixa de CEP como inteiro, valor, prazo, frete grátis acima de X) |
| emails | `emails_saida` (outbox) |

Fase 1b (desconto de assinante): sem tabela de planos; o pedido já tem `plano_codigo`, `plano_percentual_bp` e `desconto_centavos` por item (nulos/0 no MVP).

## Invariantes garantidas pelo banco

- Saldo nunca negativo; SKU único e normalizado (maiúsculas); quantidade e preços coerentes.
- `pedidos.total = subtotal - desconto + frete`; `item.total = preço × qtd - desconto`; CPF com 11 dígitos, CEP com 8, UF com 2.
- Pedido "enviado" em diante exige nota e rastreio (CA-LOJ-31).
- No máximo 1 pagamento `aprovado` por pedido; `(gateway, id_externo)` único; 1 e-mail de cada tipo por pedido.
- Faixas de frete ativas não se sobrepõem (EXCLUDE em SQL manual no fim de `0000_modelo_inicial.sql`).
- Estados de pedido, pagamento, reserva etc. são `text` + CHECK (não `ENUM`). As **transições** permitidas e `desconto do pedido = soma dos itens` ficam no módulo `pedidos` (testar).
- Nada de negócio é apagado: FKs de pedido/pagamento/estoque são RESTRICT; só `produto_fotos` é CASCADE.

## Reserva de estoque (CA-LOJ-24, 25)

Disponível = `fisico` - soma das reservas `ativa` com `expira_em > now()`. Como o disponível é derivado (a expiração é por horário), um `UPDATE ... WHERE saldo >= qtd` não basta; a estratégia é **lock da linha de saldo + checagem + insert**, tudo na mesma transação que cria o pedido:

```sql
BEGIN;  -- READ COMMITTED basta, porque o lock serializa quem disputa a mesma variação
-- 1) trava as variações do carrinho SEMPRE em ordem de id (evita deadlock)
SELECT variacao_id, fisico FROM estoque_saldos
 WHERE variacao_id = ANY($1) ORDER BY variacao_id FOR UPDATE;
-- 2) para cada variação: reservado vigente
SELECT COALESCE(SUM(quantidade), 0) FROM estoque_reservas
 WHERE variacao_id = $1 AND status = 'ativa' AND expira_em > now();
-- 3) se fisico - reservado < qtd: ROLLBACK e "Acabou de esgotar"; senão:
INSERT INTO pedidos ...; INSERT INTO pedido_itens ...;
INSERT INTO estoque_reservas (pedido_id, variacao_id, quantidade, expira_em) VALUES (...);
COMMIT;
```

- **Baixa (pagamento confirmado)**, na transação do webhook: reserva `ativa` -> `baixada`; `UPDATE estoque_saldos SET fisico = fisico - $q WHERE variacao_id = $v AND fisico >= $q` (confere linhas afetadas) e `INSERT` em `estoque_movimentos` (`venda`, quantidade negativa).
- **Expiração/cancelamento**: reserva -> `liberada` (o cron só arruma o estado; o disponível já voltou no vencimento). Estorno de pedido pago: movimento `estorno` positivo.
- **Pagamento chegando depois de `expira_em`**: a reserva pode já ter sido consumida por outro pedido. O CHECK impede saldo negativo, mas a regra do que fazer (estornar? reaproveitar?) é do `dev-integrations`/`pedidos`; ver pendências.
- Reconciliação (teste e job de conferência): `fisico = SUM(estoque_movimentos.quantidade)` por variação.

## Idempotência do webhook (CA-LOJ-18)

Na transação do webhook: `INSERT INTO gateway_eventos (gateway, evento_id, tipo, payload) VALUES (...) ON CONFLICT (gateway, evento_id) DO NOTHING RETURNING id`. Sem linha retornada = duplicata: `COMMIT` sem efeito e responder 200. Com linha: `UPDATE pedidos SET status = 'pago' ... WHERE id = $1 AND status = 'aguardando_pagamento'` (0 linhas = já processado/expirado), pagamento -> `aprovado`, reserva -> baixa, histórico e `emails_saida` (único por pedido+tipo). Rede de segurança: índice único de 1 pagamento aprovado por pedido.

## Dados pessoais (para o lgpd-specialist)

Marcados com `[LGPD][PII]` no código: `pedidos.comprador_email|nome|cpf|telefone`, `pedidos.entrega_*` (CEP, logradouro, número, complemento, bairro, cidade, UF), `gateway_eventos.payload` (pode conter dados do pagador). Também identificam pessoa: `pedidos.usuario_id`, `*.usuario_id`/`ator_usuario_id`/`solicitado_por` (equipe), `pedidos.token_acompanhamento_hash` (só hash do token; o token em claro nunca é gravado). Dados de cartão não existem no banco. Retenção e anonimização (pedido precisa ficar para fins fiscais): a definir.

## Dependências e decisões em aberto

- **Contas:** `usuario_id` (text) referencia o `user.id` do Better Auth, **sem FK** até o dev-auth gerar o schema dele; depois adicionar FK `ON DELETE SET NULL` em `pedidos.usuario_id` (conta apagada não apaga pedido). Papéis `cliente`/`operador`/`admin` são do dev-auth.
- Troca/devolução: no MVP é registrada pelo histórico + movimentos de estoque + estorno; não há tabela própria (`troca_devolucao` da spec fica para quando P-10 definir a política).
- Faturamento: `nota_fiscal_numero|chave` e `rastreio_codigo` ficam no pedido (sem tabelas `envio`/`nota_fiscal_registro` no MVP).
- Frete grátis (`gratis_acima_centavos`): depende de P-06.
- Produção: `CREATE EXTENSION` não é necessário (a EXCLUDE usa `int4range`, nativo). Em tabelas vazias a migration é trivial; rollback do MVP = `DROP` das 15 tabelas (só antes de haver dados).
