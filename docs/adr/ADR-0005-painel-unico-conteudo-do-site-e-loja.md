# ADR-0005: Um único painel, com o login da equipe da loja, para editar o conteúdo do site e gerir a loja

| Campo | Valor |
|---|---|
| Status | Aceito (decisão de escopo) |
| Data | 2026-11-15 |
| Decisores | Desenvolvedor, pela N.UY |
| Tipo | Escopo / negócio. O "como" técnico fica com o `dev-arquitetura` (ver "Decisões que este ADR não toma") |
| Projeto / spec | [docs/specs/loja.md](../specs/loja.md) v0.3 · seção 5.8 e 5.9 · HU-12, HU-13 · CA-LOJ-50 a 59 · RN-LOJ-18 (reescrita), RN-LOJ-24 a 26 · RNF-13, RNF-14, RNF-15 · substitui o item 4 do [ADR-0001](ADR-0001-loja-propria-unica-n-uy-vendedora.md) (D5) **no ponto dos dois painéis** |

## Contexto
O ADR-0001 (item 4, decisão D5) separou dois painéis: o `/admin` do site (Sveltia CMS em `site/admin/`, entra com token do GitHub e grava `site/conteudo/*.json` num repositório **público**) para o conteúdo de vitrine, e o painel da loja (dentro de `loja/`, login próprio da equipe com papéis `operador` e `admin`, ADR-0004) para produtos, estoque, frete, descontos e pedidos.

Situação em 2026-11-15: o `/admin` Sveltia está pronto na branch `painel`, mas **nunca foi publicado** (`/admin/` dá 404 em produção). O login da equipe da loja já existe no código (Better Auth, papéis `cliente` < `operador` < `admin`, `docs/tecnico/autenticacao.md`); as telas do painel da loja ainda não foram construídas.

Dois painéis significam duas formas de entrar (token do GitHub e conta da loja), duas listas de quem tem acesso e um token com permissão de escrita no repositório na mão de quem edita textos. O desenvolvedor decidiu unificar.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| A. Manter dois painéis (D5) | `/admin` já pronto; o site não depende da loja nem para ser editado | Dois logins e dois controles de acesso; quem edita precisa de token do GitHub com escrita no repositório; a equipe aprende duas ferramentas |
| B. **Painel único dentro do sistema da loja**, com o login da equipe | Um login, um controle de acesso (papéis), sem token do GitHub para quem edita; MFA e auditoria da equipe valem para tudo | Editar o site passa a depender do sistema da loja no ar; o trabalho do `/admin` Sveltia pode ser descartado ou virar provisório; mais telas no painel da loja |
| C. Tudo no Sveltia (inclusive a loja) | Uma ferramenta só | Inviável: pedidos, estoque e dados pessoais não podem ir para o Git (RNF-13, repositório público) |

## Decisão
**Opção B.**
1. Existe **um único painel administrativo**, dentro do sistema da loja, com o **mesmo login da equipe** (contas e papéis da loja). Nele ficam a gestão da loja (seção 5.8 da spec) e a **edição do conteúdo do site** (seção 5.9): os mesmos blocos que o `/admin` Sveltia edita hoje.
2. Ninguém edita o site por token do GitHub no painel único.
3. Continua valendo a fonte única (RN-LOJ-18): preço, estoque, frete, percentuais e pedidos nunca entram no conteúdo do site, mesmo editados no mesmo painel.
4. Pedidos e dados pessoais continuam fora do Git (RNF-13).
5. Para quem **visita** o site, o site continua independente da loja: abre mesmo com o sistema da loja fora do ar (RNF-14). `[PREMISSA: a confirmar pelo dev-arquitetura ao decidir onde o conteúdo vive]`.

## Decisões que este ADR não toma (encaminhadas)
- **Onde o conteúdo do site vive e como chega ao site** (JSON no Git gravado pelo servidor da loja via API do GitHub, banco com o site lendo, ou outra): `dev-arquitetura`, com ADR técnico. Esse ADR deve dizer como fica a linha "Painel" e "Ligação com o site" do ADR-0004 e atualizar `docs/tecnico/arquitetura.md`.
- ~~**Destino do `/admin` Sveltia**~~ **Respondido em 2026-11-15 (D-04):** o Sveltia é **descartado** e não será publicado; a branch `painel` fica só como referência. Até o painel único existir, o desenvolvedor edita o conteúdo do site como hoje. A edição de conteúdo é o **primeiro módulo do painel** (fase 1a da spec), antes do resto do painel da loja, usando login e papéis existentes e sem depender de gateway, frete ou NF-e.
- **Quem da equipe pode editar o conteúdo** (só admin, operador também, ou um papel novo só de conteúdo): cliente (P-15); o papel em si é do `dev-auth`.

## Consequências
**Positivas:** um login e uma lista de acessos; nenhum token do GitHub com permissão de escrita circulando entre quem edita textos; MFA da equipe (pendente antes do go-live do painel) e registro de quem fez o quê passam a cobrir também o site.
**Negativas / custos aceitos:** editar o site passa a depender do sistema da loja estar no ar (RISCO-11); o painel da loja ganha as telas de conteúdo (entregues primeiro, fase 1a, D-04); o trabalho do `/admin` Sveltia é aceito como perda e, até a fase 1a, toda mudança no site passa pelo desenvolvedor (RISCO-13).
**Riscos e mitigação:**
- Edição do site parada quando a loja cai: o site continua no ar para o visitante (RNF-14); disponibilidade da loja já tem meta (RNF-04).
- Se o conteúdo continuar no Git e o servidor da loja passar a gravar no repositório público: credencial de escopo mínimo só no servidor, e nada além do conteúdo de vitrine vai ao repositório (RNF-13; `dev-security`).
- Pessoa que só edita textos ganhar acesso a pedidos e dados de clientes: P-15 antes de criar contas; papel com o mínimo necessário (`dev-auth`, `lgpd-specialist`).
**Impacto em outros agentes:** `dev-arquitetura` (onde o conteúdo vive, ADR técnico, atualizar `arquitetura.md`), `dev-auth` (papel de quem edita conteúdo, P-15), `dev-react` (telas do painel de conteúdo), `dev-uiux` (telas), `dev-security` (credencial de publicação, upload de imagens), `dev-integrations` (só se a publicação depender de serviço externo, como a API do GitHub), `dev-devops` (publicação do site), `dev-tests`, `docs-handoff` (seção "Painel de conteúdo" do `BRIEFING.md`, manual da equipe).

## Quando revisitar
Se a edição do site precisar funcionar com o sistema da loja fora do ar por muito tempo, se a loja for desligada ou trocada por plataforma pronta (ADR-0001), ou se surgir equipe de conteúdo grande que peça ferramenta editorial própria (rascunho, revisão, agendamento).

## Referências
Decisão do desenvolvedor de 2026-11-15. `site/admin/config.yml` e `site/conteudo/*.json` (branch `painel`); `BRIEFING.md` (seção "Painel de conteúdo"); `docs/tecnico/autenticacao.md`; ADR-0001 e ADR-0004.
