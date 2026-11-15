# NUYVI (teste de design da N.UY)

Variante experimental da landing da N.UY. O projeto oficial continua em `projetos/nuy/`; o briefing completo da marca está em `projetos/nuy/BRIEFING.md`.

- **Ideia:** estrutura de página de lançamento de jogo grande: abertura em tela cheia com vídeo, logo real recortado em fragmentos que se monta na rolagem, grade de vídeos com tela cheia, destaques do Premium e do plano anual, história presa na tela, cartões, loja, novidades e rodapé.
- **Regra:** só a estrutura e o estilo de animação são de referência. Fotos, logo, textos e marca são sempre da N.UY.
- **Página:** `site/index.html` (HTML + CSS próprio, GSAP 3.13 + ScrollTrigger, Lenis só no computador).
- **Rodar local:** dentro de `site/`, `yarn dev` serve em http://127.0.0.1:8765 com o conteúdo de `conteudo/*.json` e recarrega o navegador ao salvar arquivo do site. `yarn dev:painel` usa o conteúdo publicado no painel da loja local (`localhost:3000`) e recarrega só quando alguém publica: a loja chama `POST /__publicado` (`SITE_DEPLOY_HOOK_URL=http://127.0.0.1:8765/__publicado` em `admin/.env.local`), como o deploy hook na Vercel; sem consulta periódica. Com essa variável, publicar com o site parado falha (como em produção com o hook fora). O `index.html` versionado não é alterado (`site/dev.mjs`, só Node). `yarn build` remonta os trechos editáveis do `index.html` (`node build.mjs`).
- **Idioma de movimento:** o mesmo da N.UY (`MOV`: entrada power3.out, saída power2.in, tempos .2 / .4 / .8 s).
- **Publicado em:** https://nuyvi.vercel.app (Vercel, projeto `nuyvi`; para atualizar: `vercel deploy --prod` dentro de `site/`). Cópia também em https://claude.ai/artifact/NWugEH3pBVC1wa4ca4vvs3
- **Pendente:** fotos reais do cliente em alta resolução (1600 e 2400 px + corte vertical), notícias reais, links das lojas.
- **Versão anterior (antes da abertura em palco parado):** `site/versao-anterior.html`, online em https://nuyvi.vercel.app/versao-anterior.html
- **Versão 2 (abertura em palco, antes do palco entre todas as seções e dos carrosséis de Explore/Novidades):** `site/versao-2.html`, online em https://nuyvi.vercel.app/versao-2.html
- **Código no GitHub:** https://github.com/igordimarine-sys/nuyvi (público, ramo `main`; a pasta do repositório é `projetos/nuyvi/`). O GitHub não publica sozinho: a Vercel continua sendo atualizada com `vercel deploy --prod` dentro de `site/`.

## Conteúdo do site e painel administrativo

- **Hoje:** o conteúdo do site é editado pelo desenvolvedor, direto no HTML. O site no ar sai do `site/index.html` da `main`, publicado com `vercel deploy --prod` dentro de `site/`.
- **Painel único (em construção):** o painel administrativo, com o conteúdo do site e a loja no mesmo lugar e o login da equipe (sem token do GitHub), está sendo feito no sistema da loja (`admin/`). A edição do conteúdo é a fase 1a, o primeiro módulo do painel. Até ela ficar pronta, vale o fluxo de "Hoje".
- **Como vai funcionar:** o conteúdo do site fica guardado em versões no banco da loja; ao publicar, a loja dispara um deploy hook e o site estático é remontado com a última versão publicada. O site no ar continua abrindo mesmo com a loja fora do ar. Decisões em `docs/adr/ADR-0005-painel-unico-conteudo-do-site-e-loja.md` e `docs/adr/ADR-0006-conteudo-do-site-no-banco-da-loja-com-rebuild.md`; comportamento na seção 5.8 de `docs/specs/loja.md`.
- **Painel Sveltia (`/admin`):** descartado (decisão D-04, 2026-11-15); nunca foi publicado. A branch `painel` fica só como referência.

## Loja e painel (`admin/`)

- Aplicação Next.js (TypeScript, Drizzle, PostgreSQL) separada de `site/`; em construção: login e papéis da equipe, modelo de dados, tabela de versões do conteúdo do site e testes de integração prontos; painel e vendas ainda não. Stack em `docs/adr/ADR-0004-stack-loja.md`, estrutura em `docs/tecnico/arquitetura.md`, como rodar em `admin/README.md`.
