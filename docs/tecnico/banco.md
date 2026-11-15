# Banco de dados da loja (PostgreSQL, Drizzle)

Schema: `admin/src/db/schema/` (um arquivo por módulo). Migrations: `admin/drizzle/` (`npm run db:generate`, `npm run db:migrate`). Dinheiro em centavos inteiros; instantes em `timestamptz`; ids `uuid` (`gen_random_uuid()`), exceto `pedidos.numero` (identity, a partir de 1000, número amigável).

## Tabelas

| Módulo | Tabelas |
|---|---|
| catalogo | `categorias`, `produtos`, `produto_fotos` (URL do Blob), `variacoes` (SKU único, preço) |
| estoque | `estoque_saldos` (físico, CHECK >= 0), `estoque_movimentos` (entrada/ajuste/venda/estorno, com sinal), `estoque_reservas` (com `expira_em`) |
| pedidos | `pedidos` (dados do comprador, endereço e valores congelados), `pedido_itens`, `pedido_historico` |
| pagamentos | `pagamentos` (tentativas), `gateway_eventos` (idempotência), `estornos` |
| frete | `frete_faixas` (faixa de CEP como inteiro, valor, prazo, frete grátis acima de X) |
| emails | `emails_saida` (outbox) |
| conteudo | `conteudo_versoes` (conteúdo do site, ADR-0006; seção abaixo) |

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

## Conteúdo do site (`conteudo_versoes`, ADR-0006, CA-LOJ-50 a 59)

Schema `schema/conteudo.ts`; migration `drizzle/0002_conteudo_versoes.sql` (DDL gerado + SQL manual de triggers no fim). Uma linha = uma versão **completa** do conteúdo.

| Coluna | Decisão |
|---|---|
| `numero` (PK, int) | Sequencial sem buracos, preenchido pela aplicação (`versaoBase + 1`). É o controle de concorrência: a PK + o trigger impedem duas versões com o mesmo número ou um salto |
| `conteudo` (jsonb) | Os 5 documentos (`textos`, `loja`, `explore`, `novidades`, `planos`) no formato de `site/conteudo/*.json`, mais `destino` nos cartões da Loja. CHECK: objeto com as 5 chaves. O formato interno é validado pelo zod (e pelo `build.mjs`), não pelo banco |
| `blocos_alterados` (text[]) | 1 a 9 itens, de `abertura, parceiros, planos, bonus, historia, explore, loja, novidades, baixar` (CHECK). Versão 1 da migração: os 9 |
| `origem` | `painel` ou `migracao`. Distingue "autor removido" de "versão 1 sem autor" |
| `autor_id` | FK `user.id` **ON DELETE SET NULL** (decisão abaixo) |
| `disparo_estado` / `disparo_em` / `disparo_erro` | `pendente` (nasce assim), `aceito` ou `falhou`. `disparo_em` nulo só em `pendente` (CHECK). `disparo_erro`: motivo curto, nunca a URL do hook |
| `criado_em` | Instante da gravação (publicação pedida) |

**Garantias no banco**
- **Imutável:** trigger `conteudo_versoes_guarda` recusa `DELETE` e qualquer `UPDATE` que mude `numero`, `conteudo`, `blocos_alterados`, `origem`, `criado_em`. O disparo só vai de `pendente` para `aceito` ou `falhou`, **uma vez**; o autor só pode virar NULL. Violação = SQLSTATE 23514. `TRUNCATE` não tem trigger (o setup dos testes trunca tudo): em produção a role da aplicação **não recebe `TRUNCATE`** nem DDL (`app_rw` só `SELECT/INSERT/UPDATE`; o `UPDATE` poderia ser restrito às colunas `disparo_*` com `GRANT UPDATE (disparo_estado, disparo_em, disparo_erro)`, recomendado quando as roles existirem).
- **Concorrência (`versaoBase`):** o trigger exige `numero = max(numero) + 1` (23514 se a base já avançou); na corrida real de duas transações, a PK responde `23505` (`conteudo_versoes_pkey`). Os dois códigos significam "o conteúdo mudou, recarregue".
- **Uma publicação em curso por vez:** índice único parcial `conteudo_versoes_uma_pendente_uk` (`WHERE disparo_estado = 'pendente'`). Evita base ambígua (versão N pendente que ainda pode falhar sob a N+1). `23505` com essa constraint = "publicação em andamento, tente em instantes". Uma versão `pendente` presa (processo morreu entre o COMMIT e o hook) bloqueia o resto: o módulo a marca `falhou` quando passar de ~2 min (query 1).
- **Leitura pública = maior `numero` com `disparo_estado = 'aceito'`** (índice parcial `conteudo_versoes_aceitas_idx`). Versão `pendente` ou `falhou` nunca é servida.

**Regras para o módulo** (dev-react)
- `versaoBase` é o **maior `numero` de todas** (inclusive `falhou`), não o da última aceita. O **conteúdo-base** da versão nova é o da última `aceito` + o bloco editado. Assim uma tentativa que falhou nunca vaza para o site, e a nova tentativa do mesmo usuário usa como base o número da versão `falhou` (o módulo devolve esse número à tela junto do erro; a edição digitada fica na tela, CA-LOJ-55).
- Versão `falhou` fica no histórico (útil para auditoria); a UI do histórico pode filtrar só `aceito`.

**Autor e LGPD.** `SET NULL` em vez de `RESTRICT`: `RESTRICT` impediria apagar a conta de um ex-funcionário (direito de eliminação) por causa de um registro de conteúdo. A versão em si não é dado pessoal; o que identifica é o vínculo, que some com a conta. Consequência: o histórico passa a mostrar "conta removida" nessas linhas. Não se copia nome/e-mail para a tabela (seria dado pessoal fora do alcance do apagamento). Se o cliente precisar manter o nome do autor após a saída, é decisão do lgpd-specialist (base legal e prazo). Para a equipe, preferir **desativar** a conta a apagar.

**Queries de referência** (parâmetros `$n`; tudo parametrizado, nunca interpolar). Publicar roda numa transação; o hook é chamado **depois** do COMMIT.

```sql
-- 0) dentro da transação: libera pendente presa (> 2 min)
UPDATE conteudo_versoes
   SET disparo_estado = 'falhou', disparo_em = now(), disparo_erro = 'expirada sem disparo'
 WHERE disparo_estado = 'pendente' AND criado_em < now() - interval '2 minutes';

-- 1) base de conteúdo = última aceita (null = nada publicado; só antes da versão 1)
SELECT numero, conteudo FROM conteudo_versoes
 WHERE disparo_estado = 'aceito' ORDER BY numero DESC LIMIT 1;

-- 2) publicar com checagem de versão base ($1 = versaoBase = maior numero visto pela tela;
--    $2 = conteudo novo completo (jsonb, montado no módulo: base + bloco editado);
--    $3 = text[] com os blocos; $4 = user.id). 0 linhas retornadas = conflito de versão.
INSERT INTO conteudo_versoes (numero, conteudo, blocos_alterados, origem, autor_id)
SELECT $1::int + 1, $2::jsonb, $3::text[], 'painel', $4
 WHERE (SELECT COALESCE(max(numero), 0) FROM conteudo_versoes) = $1::int
RETURNING numero;
-- Erros: 23505 (pkey = corrida; uma_pendente_uk = publicação em andamento) e 23514 = conflito/recarregar.

-- 3) depois do COMMIT e da chamada ao hook (timeout curto); só atualiza se ainda pendente
UPDATE conteudo_versoes SET disparo_estado = 'aceito', disparo_em = now()
 WHERE numero = $1 AND disparo_estado = 'pendente' RETURNING numero;
UPDATE conteudo_versoes SET disparo_estado = 'falhou', disparo_em = now(), disparo_erro = $2   -- $2 curto, sem URL
 WHERE numero = $1 AND disparo_estado = 'pendente' RETURNING numero;

-- 4) leitura pública (endpoint do site) e base da tela do painel
SELECT numero, conteudo FROM conteudo_versoes
 WHERE disparo_estado = 'aceito' ORDER BY numero DESC LIMIT 1;
SELECT COALESCE(max(numero), 0) AS versao_base FROM conteudo_versoes;           -- painel: versaoBase

-- 5) histórico (CA-LOJ-57), keyset por numero ($1 = último numero da página anterior, ou 2147483647)
SELECT v.numero, v.criado_em, v.blocos_alterados, v.origem, v.disparo_estado, v.disparo_erro,
       u.name AS autor_nome            -- NULL = conta removida (ou origem 'migracao')
  FROM conteudo_versoes v LEFT JOIN "user" u ON u.id = v.autor_id
 WHERE v.numero < $1 ORDER BY v.numero DESC LIMIT 50;                           -- sem a coluna conteudo
```

No Drizzle, usar `db.transaction` + `sql` com `${}` (parâmetros). O endpoint público devolve só `conteudo` (nada de autor). Teste de integração das garantias: `admin/tests/db/conteudo-versoes.test.ts`.

**Migration e rollback.** Tabela nova, sem dados: aplicar antes do app que a usa (sem ordem crítica com o app atual). Rollback: `DROP TABLE conteudo_versoes; DROP FUNCTION conteudo_versoes_guarda();` (só antes da versão 1 em produção; depois disso, o histórico é perdido, então só com confirmação e backup). A versão 1 vem do script de migração do conteúdo (dev-react), com `origem = 'migracao'`, `disparo_estado = 'aceito'`, `disparo_em` preenchido e os 9 blocos.

## Dados pessoais (para o lgpd-specialist)

Marcados com `[LGPD][PII]` no código: `pedidos.comprador_email|nome|cpf|telefone`, `pedidos.entrega_*` (CEP, logradouro, número, complemento, bairro, cidade, UF), `gateway_eventos.payload` (pode conter dados do pagador), `conteudo_versoes.autor_id` (vínculo com a equipe; vira NULL se a conta for apagada). Também identificam pessoa: `pedidos.usuario_id`, `*.usuario_id`/`ator_usuario_id`/`solicitado_por` (equipe), `pedidos.token_acompanhamento_hash` (só hash do token; o token em claro nunca é gravado). Dados de cartão não existem no banco. Retenção e anonimização (pedido precisa ficar para fins fiscais): a definir.

## Dependências e decisões em aberto

- **Contas:** `usuario_id` (text) referencia o `user.id` do Better Auth (tabelas em `schema/auth.ts`, migration `0001_autenticacao`). `pedidos.usuario_id` tem FK `ON DELETE SET NULL` (conta apagada não apaga pedido); `estoque_movimentos.usuario_id` e `pedido_historico.ator_usuario_id` seguem sem FK (pendente). Papéis e fluxos: [autenticacao.md](autenticacao.md).
- Troca/devolução: no MVP é registrada pelo histórico + movimentos de estoque + estorno; não há tabela própria (`troca_devolucao` da spec fica para quando P-10 definir a política).
- Faturamento: `nota_fiscal_numero|chave` e `rastreio_codigo` ficam no pedido (sem tabelas `envio`/`nota_fiscal_registro` no MVP).
- Frete grátis (`gratis_acima_centavos`): depende de P-06.
- Produção: `CREATE EXTENSION` não é necessário (a EXCLUDE usa `int4range`, nativo). Em tabelas vazias a migration é trivial; rollback do MVP = `DROP` das 15 tabelas (só antes de haver dados).
