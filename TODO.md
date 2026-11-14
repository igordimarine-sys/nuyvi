# TODO

## Em andamento

## Pendente
- Ligar o projeto `nuyvi` da Vercel ao repositório do GitHub (Root Directory `site`) para cada edição do painel publicar sozinha. Na primeira publicação, conferir se a Vercel roda o `node build.mjs` e serve a pasta `site` (`buildCommand` em `site/vercel.json`, saída padrão do preset "Other").
- Testar o painel em produção: entrar com token, editar um produto, salvar, conferir o commit e o site atualizado.
- Push da branch `painel` e teste do painel com token nela. Ao juntar na `main`, trocar `branch: painel` para `branch: main` em `site/admin/config.yml`.
- Fotos reais do cliente em alta resolução, notícias reais, links das lojas (vindos do BRIEFING).
- Loja com vendas reais: enviar ao cliente as perguntas da seção 13 de `docs/specs/loja.md` (prioridade: P-01 login/API do app, P-02 loja web × telas no app, P-04 compra sem conta, P-06 entrega, P-09 nota fiscal, C-01 desconto só no anual?).
- Loja: decidir onde o código será construído (este repositório público ou o projeto oficial `projetos/nuy/`) e se há acesso ao backend do app (D-01, D-02 da spec).
- Loja: atualizar a spec para 0.2/1.0 com as respostas do cliente (arquiteto-specs).
- Loja: escolher stack e arquitetura (backend, banco, hospedagem, painel da equipe) com ADR técnico (dev-arquitetura), depois das respostas P-01, P-02 e D-01.
- Loja: desenhar integração de contas/planos com o app e escolher gateway de pagamento (dev-integrations + dev-auth).
- Loja: cliente validar nota fiscal e tributos com o contador e termos/troca/arrependimento com advogado.
- Loja: revisão de privacidade (dados entre app e loja, menores, retenção) com lgpd-specialist.
- Loja: se for proposta ao cliente, orçamento do MVP com orcamentos-propostas (D-03).
- Loja: quando a loja tiver URL, trocar o botão "Comprar no app" da seção Loja pelo link da categoria e revisar o título "Equipado sem sair do app" (copywriter); manter preços e estoque fora de `site/conteudo/loja.json`.

## Feito
- 2026-11-14: painel `/admin` (Sveltia CMS) com conteúdo em `site/conteudo/*.json` e `site/build.mjs` gerando os trechos editáveis do `index.html`.
