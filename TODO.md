# TODO

## Em andamento

## Pendente
- Ligar o projeto `nuyvi` da Vercel ao repositório do GitHub (Root Directory `site`) para cada edição do painel publicar sozinha. Na primeira publicação, conferir se a Vercel roda o `node build.mjs` e serve a pasta `site` (`buildCommand` em `site/vercel.json`, saída padrão do preset "Other").
- Testar o painel em produção: entrar com token, editar um produto, salvar, conferir o commit e o site atualizado.
- Push da branch `painel` e teste do painel com token nela. Ao juntar na `main`, trocar `branch: painel` para `branch: main` em `site/admin/config.yml`.
- Fotos reais do cliente em alta resolução, notícias reais, links das lojas (vindos do BRIEFING).

## Feito
- 2026-11-14: painel `/admin` (Sveltia CMS) com conteúdo em `site/conteudo/*.json` e `site/build.mjs` gerando os trechos editáveis do `index.html`.
