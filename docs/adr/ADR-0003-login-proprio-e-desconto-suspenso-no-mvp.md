# ADR-0003: Loja com login próprio; desconto por plano suspenso até confirmar a leitura do plano no Base44

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-11-14 |
| Decisores | Desenvolvedor, pela N.UY |
| Projeto / spec | [docs/specs/loja.md](../specs/loja.md) v0.2 · RN-LOJ-21 a 23, CA-LOJ-44 a 49, PEND-B44 · suspende a aplicação de [ADR-0002](ADR-0002-desconto-automatico-por-plano-n-uy.md) no MVP |

## Contexto
O ADR-0002 decidiu aplicar o desconto de assinante automaticamente, conferindo o plano na conta N.UY. A resposta à P-01 trouxe que o app N.UY é feito em **Base44** e que o desenvolvedor acredita que a plataforma tem limitações para expor endpoints. Não há informação verificada sobre o que o Base44 permite (API, funções de backend, leitura de dados do usuário por sistema externo, avisos de mudança). Fazer o login da loja depender do app travaria o MVP por uma integração não confirmada.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| A. Login próprio da loja e desconto adiado até confirmar a leitura do plano | MVP independente do Base44; vende logo | Duas contas (app e loja); a promessa de desconto do site fica sem cumprir até a fase 1b |
| B. Esperar a integração com o Base44 para lançar | Lança com desconto | Prazo do MVP depende de algo não confirmado e talvez inviável |
| C. Desconto sem verificação (declaração, print, cupom genérico) | Sem integração | Abuso fácil; contraria o ADR-0002 |

## Decisão
Opção A:
1. A loja tem **login próprio**; a conta da loja é separada da conta do app. É permitido comprar como visitante (P-04).
2. O MVP vende **sem desconto de assinante**. O desconto vira a **fase 1b**, que depende de confirmar uma forma segura de ler o plano vigente no Base44 (PEND-B44). Hipóteses a verificar, nenhuma confirmada: API ou funções de backend do Base44, vínculo das contas por e-mail verificado, aviso do app à loja quando o plano muda, alternativa sem integração.
3. Premissa (o desenvolvedor pode trocar): o cálculo do desconto não é construído "desligado" no MVP; entra junto com a fase 1b.
4. No app, a loja abre como página web, sem telas nativas (P-02). O código da loja fica neste repositório público, branch `loja`, numa pasta própria separada de `site/` (D-01).

## Consequências
**Positivas:** o MVP não depende do Base44; integração menor; vender começa antes.
**Negativas / custos aceitos:** duas contas para o assinante; um benefício anunciado no site fica para depois (RISCO-09, P-14); o vínculo de contas na fase 1b pode exigir migração ou confirmação do e-mail.
**Riscos e mitigação:** a PEND-B44 pode concluir que não há leitura segura; nesse caso, voltar ao cliente com alternativas antes de prometer o desconto. Textos do site que prometem desconto são revistos no lançamento (copywriter, P-14).
**Impacto em outros agentes:** `dev-auth` (login próprio, visitante, vínculo futuro), `dev-integrations` (PEND-B44), `dev-security` (link de acompanhamento do visitante, segredos fora do repositório público), `lgpd-specialist` (dados do visitante), `copywriter` (textos de desconto), `dev-arquitetura` (pasta própria e publicação separada). `dev-mobile` fica fora.

## Quando revisitar
Quando a PEND-B44 for respondida (vira um novo ADR da fase 1b), ou se o cliente decidir adiar o lançamento até ter o desconto (P-14).

## Referências
Respostas do desenvolvedor de 2026-11-14 às perguntas P-01, P-02, P-04 e D-01. Capacidades do Base44: a conferir na documentação oficial do Base44 (não consultada aqui).
