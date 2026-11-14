# NUYVI (teste de design da N.UY)

Variante experimental da landing da N.UY. O projeto oficial continua em `projetos/nuy/`; o briefing completo da marca está em `projetos/nuy/BRIEFING.md`.

- **Ideia:** estrutura de página de lançamento de jogo grande: abertura em tela cheia com vídeo, logo real recortado em fragmentos que se monta na rolagem, grade de vídeos com tela cheia, destaques do Premium e do plano anual, história presa na tela, cartões, loja, novidades e rodapé.
- **Regra:** só a estrutura e o estilo de animação são de referência. Fotos, logo, textos e marca são sempre da N.UY.
- **Página:** `site/index.html` (HTML + CSS próprio, GSAP 3.13 + ScrollTrigger, Lenis só no computador).
- **Idioma de movimento:** o mesmo da N.UY (`MOV`: entrada power3.out, saída power2.in, tempos .2 / .4 / .8 s).
- **Publicado em:** https://nuyvi.vercel.app (Vercel, projeto `nuyvi`; para atualizar: `vercel deploy --prod` dentro de `site/`). Cópia também em https://claude.ai/artifact/NWugEH3pBVC1wa4ca4vvs3
- **Pendente:** fotos reais do cliente em alta resolução (1600 e 2400 px + corte vertical), notícias reais, links das lojas.
- **Versão anterior (antes da abertura em palco parado):** `site/versao-anterior.html`, online em https://nuyvi.vercel.app/versao-anterior.html
- **Versão 2 (abertura em palco, antes do palco entre todas as seções e dos carrosséis de Explore/Novidades):** `site/versao-2.html`, online em https://nuyvi.vercel.app/versao-2.html
- **Código no GitHub:** https://github.com/igordimarine-sys/nuyvi (público, ramo `main`; a pasta do repositório é `projetos/nuyvi/`). O GitHub não publica sozinho: a Vercel continua sendo atualizada com `vercel deploy --prod` dentro de `site/`.
