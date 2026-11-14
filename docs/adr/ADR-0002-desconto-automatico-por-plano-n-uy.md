# ADR-0002: Desconto de assinante automático pelo plano da conta N.UY

| Campo | Valor |
|---|---|
| Status | Aceito como objetivo; **suspenso no MVP** por [ADR-0003](ADR-0003-login-proprio-e-desconto-suspenso-no-mvp.md) (2026-11-14) |
| Data | 2026-11-14 |
| Decisores | Desenvolvedor, pela N.UY |
| Projeto / spec | [docs/specs/loja.md](../specs/loja.md) · RN-LOJ-04 a 08, CA-LOJ-07 a 12, CA-LOJ-19 |

## Contexto
O site promete desconto na loja por plano (Gratuito 0%, Silver 5%, Gold 10%, Premium 15%, provisórios). As assinaturas vivem no app N.UY, do qual não temos nenhuma informação técnica nesta máquina (login, backend, API). Sem código de cupom, o desconto precisa saber quem é o comprador e qual o plano dele.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| A. Automático pelo plano da conta N.UY, verificado na confirmação do pedido | Sem fricção para o assinante; difícil de abusar | Depende de integração com contas/planos do app |
| B. Cupom por plano | Sem integração | Cupom vaza e é usado por não assinantes |
| C. Conferência manual pela equipe | Sem integração | Lento, sujeito a erro, inviável com volume |

## Decisão
Opção A. O comprador se identifica com a conta N.UY; a loja consulta a fonte oficial da assinatura **no momento da confirmação do pedido**, aplica o percentual do plano vigente e grava no pedido o plano e o percentual usados. Sem verificação, sem desconto.

## Consequências
**Positivas:** benefício real e automático, alinhado à promessa do site.
**Negativas / custos aceitos:** a loja passa a depender da disponibilidade do serviço de contas do app; pode exigir trabalho no backend do app.
**Riscos e mitigação:** inexistência de API (RISCO-01, P-01/D-02); divergência de percentuais entre loja, app e textos do site (RISCO-05, P-05); regra de "plano vigente" indefinida (P-03, C-01).
**Impacto em outros agentes:** `dev-auth` (identificação do comprador com a conta do app), `dev-integrations` (consulta ao app e comportamento em falha), `dev-security` (cálculo no servidor, autenticidade da consulta), `lgpd-specialist` (dados compartilhados entre app e loja).

## Quando revisitar
Se P-01 mostrar que não há como consultar o plano com segurança, ou se a N.UY passar a vender os planos fora do app.

## Referências
Decisão D3 repassada pelo desenvolvedor em 2026-11-14; `site/conteudo/planos.json`.
