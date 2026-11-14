# ADR-0001: Loja própria e única para site e app, com a N.UY como vendedora

| Campo | Valor |
|---|---|
| Status | Aceito (decisão de negócio) |
| Data | 2026-11-14 |
| Decisores | Desenvolvedor, pela N.UY |
| Projeto / spec | [docs/specs/loja.md](../specs/loja.md) · RN-LOJ-01, RN-LOJ-02, RN-LOJ-18 |

## Contexto
A seção Loja do site é só vitrine ("Comprar no app"). A N.UY quer vender produtos esportivos de verdade (calçados, roupas, acessórios), no site e no app, com desconto para assinantes. O conteúdo da vitrine hoje é editado no painel `/admin` (Sveltia CMS), que grava JSON num repositório público do GitHub.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| A. Plataforma pronta (Nuvemshop, Shopify etc.) | Checkout, frete e painel prontos | Integração do desconto por plano do app mais difícil; mensalidade/taxas da plataforma; experiência fora da identidade da N.UY |
| B. Marketplace (vários vendedores) | Catálogo maior sem estoque próprio | Repasses, cadastro de vendedores, responsabilidade compartilhada; muito maior |
| C. Loja própria, única, N.UY vendedora | Controle total do desconto por plano e da experiência; um catálogo para site e app | Construir e manter checkout, estoque, pedidos e painel |
| D. Lojas separadas para site e app | — | Estoque e pedidos duplicados, risco de vender o que não tem |

## Decisão
Opção C:
1. **Loja única** para site e app: mesmo catálogo, estoque e pedidos (D1).
2. **Sistema próprio**, não plataforma pronta (D2).
3. **A N.UY é a vendedora** (CNPJ próprio, nota fiscal, logística e trocas); não é marketplace (D4).
4. A gestão de produtos, estoque, preços, frete, descontos e pedidos passa ao **sistema da loja**; o painel `/admin` continua só com conteúdo de vitrine (D5).

## Consequências
**Positivas:** desconto por plano integrado ao app; uma fonte de estoque; identidade própria.
**Negativas / custos aceitos:** checkout, estoque, pedidos, painel da equipe, e-mails e operação ficam sob nossa manutenção; o site deixa de ser só estático (precisa de backend e banco, a definir por `dev-arquitetura`).
**Riscos e mitigação:** escopo crescer (fases na spec); nota fiscal e logística não estruturadas (contador, P-06/P-09); segredos e dados pessoais num repositório público (RNF-13).
**Impacto em outros agentes:** `dev-arquitetura` (stack), `dev-database`, `dev-integrations` (gateway), `dev-auth` (painel da equipe), `dev-security`, `lgpd-specialist`, `copywriter` (seção Loja), `orcamentos-propostas` (se houver proposta).

## Quando revisitar
Se o custo de manter o sistema próprio superar o de uma plataforma com integração viável ao app, se a N.UY quiser outros vendedores (marketplace), ou se o volume exigir operação logística terceirizada com sistema próprio.

## Referências
Decisões D1, D2, D4 e D5 repassadas pelo desenvolvedor em 2026-11-14.
