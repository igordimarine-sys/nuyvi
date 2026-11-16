# Painel de conteúdo do site: especificação visual e de comportamento

Tarefa 11 do plano da [spec da loja](../specs/loja.md) (fase 1a), ampliada na v1.1 pela spec v0.6. Requisitos: seção 5.9 (HU-12, HU-13, CA-LOJ-50 a 67), RN-LOJ-24 a 27, tela da 9.2. Decisão técnica: [ADR-0007](../adr/ADR-0007-site-e-painel-num-unico-app-next.md) (publicar atualiza `/` na hora, adendo A1 com os 3 blocos novos) sobre o [ADR-0006](../adr/ADR-0006-conteudo-do-site-no-banco-da-loja-com-rebuild.md) (versões e histórico). Banco: [banco.md](banco.md) ("Conteúdo do site"). Fluxo de publicação: [arquitetura.md](arquitetura.md) seção 6. Cabeçalho com sessão e página `/loja`: [ui-site-sessao-e-loja.md](ui-site-sessao-e-loja.md). Quem implementa: `dev-react` em `admin/` (CSS próprio, sem biblioteca de UI nova).

Ferramenta interna: prioridade é clareza e segurança ao publicar. Sem animação decorativa. Movimento só funcional (seção 9).

Premissas herdadas: P-15 (só admin edita), P-16 (resolvida: o site atualiza **na hora** ao publicar, ADR-0007), P-17 (sem prévia nem rascunho: publicar direto), P-18 (sem botão "desfazer"; corrige-se editando de novo). Se alguma mudar, esta spec muda junto.

---

## 1. Decisão: edição e publicação por bloco

**Cada bloco é editado e publicado sozinho.** Não há "publicar tudo".

Por quê:
- O banco já grava `blocos_alterados` (1 a 12) e o módulo monta a versão nova como "última publicada + o bloco editado". Publicar por bloco é o caminho natural; publicar vários de uma vez exigiria rascunho multi-bloco (P-17 diz que não há rascunho).
- Reduz o dano de um erro: publicar "História" não pode quebrar "Planos".
- Histórico legível (CA-LOJ-57): "quem mudou qual bloco".
- Conflito de versão (seção 7.5) fica pequeno: só importa se alguém mexeu no mesmo bloco.
- Custo: quem quer mudar 3 blocos publica 3 vezes. Aceito: cada publicação é imediata (sem build, sem espera) e a mudança é rara.

Não existe rascunho salvo no servidor. O que foi digitado e não publicado só vive na tela (a saída avisa, seção 7.9).

---

## 2. Mapa de telas e navegação

Rotas sugeridas (nome final é do `dev-react`):

```
/admin                        Início do painel (hoje existe, página simples)
/admin/conteudo               Lista dos 12 blocos  (+ resumo da última publicação)
/admin/conteudo/[bloco]       Edição de um bloco
/admin/conteudo/historico     Histórico de publicações
```

Slugs dos blocos = os do banco: `geral, abertura, parceiros, videos, planos, bonus, historia, explore, loja, baixar, novidades, pagina-loja` (os três novos, ADR-0007 A1: `geral`, `videos`, `pagina-loja`).

**Estrutura do painel (casca):** barra lateral no desktop; no celular, barra superior com botão "Menu" que abre a mesma lista.

Itens de navegação (a loja entra depois, sem desenhá-la agora):

| Item | Fase | Quem vê |
|---|---|---|
| Início | 1a | admin |
| Conteúdo do site (com subitem Histórico) | 1a | admin |
| Produtos, Pedidos, Estoque, Frete, Equipe... | depois (1b em diante) | conforme papel (operador vê pedidos; admin vê tudo) |

Regras de navegação:
- A casca renderiza **só os itens que o papel pode usar**. O operador (se um dia entrar no painel pelos pedidos) **não vê** "Conteúdo do site" no menu. A checagem real é no servidor (CA-LOJ-56); esconder o menu é só cortesia.
- Tentar abrir `/admin/conteudo...` sem permissão (URL direta): tela "Sem permissão" (seção 7.8), dentro da casca, sem revelar nada do conteúdo.
- Usuário sem login vai para `/login` (já existe) e volta ao destino depois.
- Item atual marcado com `aria-current="page"`.
- Rodapé da barra: nome do usuário e botão "Sair" (reaproveita `BotaoSair`).
- Migalhas na edição: `Conteúdo do site > Planos e preços`. O "Conteúdo do site" é link.

---

## 3. Tokens mínimos

CSS variables em `:root` no `globals.css`. Tema claro único (ferramenta de escritório; sem modo escuro no MVP). Valores de contraste foram calculados à mão: o `dev-react` confere com uma ferramenta de contraste antes de aceitar (critério de aceite 10.4).

Cores (relação com a marca: o site usa o degradê verde `#8be04e` → ciano `#2ec8e8`; no painel o verde-marca só aparece como detalhe, porque não tem contraste suficiente para texto ou botão):

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--cor-fundo` | `#f5f6f8` | fundo da página | |
| `--cor-superficie` | `#ffffff` | cartões, campos | |
| `--cor-texto` | `#1a1d21` | texto | 16:1 sobre superfície |
| `--cor-texto-suave` | `#5b6470` | ajuda, rótulos secundários | 6:1 |
| `--cor-borda` | `#d5d9df` | divisores, cartões | decorativo |
| `--cor-borda-campo` | `#8a929c` | borda de input/select/botão secundário | 3,1:1 (mínimo 3:1 para componente) |
| `--cor-primaria` | `#0f5f4a` | botão primário, link, item ativo | 7,6:1 com texto branco |
| `--cor-primaria-hover` | `#0b4a39` | hover do primário | |
| `--cor-marca` | `#8be04e` | só detalhe: filete de 3 px no topo da barra lateral | decorativo |
| `--cor-foco` | `#1b5ec7` | anel de foco | 6:1 sobre branco |
| `--cor-erro` / `--cor-erro-fundo` | `#b3261e` / `#fdecea` | erro de campo e de bloco | 6,6:1 |
| `--cor-sucesso` / `--cor-sucesso-fundo` | `#0b4a38` / `#e7f5ee` | publicado | >9:1 |
| `--cor-aviso` / `--cor-aviso-fundo` | `#5c4300` / `#fff4d6` | pendente, conflito, alteração não publicada | >8:1 |

Nunca comunicar estado só por cor: todo estado tem ícone (texto/símbolo) e palavra (seção 8).

Tipografia: `system-ui, sans-serif` (já é a do projeto; zero custo de fonte).

| Token | Valor |
|---|---|
| `--fonte-base` | 16px / 1.5 (nunca menor que 16px em campo, evita zoom no iOS) |
| `--fonte-pequena` | 14px / 1.4 (ajuda, metadados) |
| `--fonte-titulo-2` | 20px / 1.3, peso 600 (título de seção/cartão) |
| `--fonte-titulo-1` | 24px / 1.25, peso 700 (título da página); 28px a partir de 768px |

Espaçamento (escala de 4): `--esp-1: 4px; --esp-2: 8px; --esp-3: 12px; --esp-4: 16px; --esp-6: 24px; --esp-8: 32px; --esp-12: 48px`.

Outros: `--raio: 8px; --sombra-1: 0 1px 2px rgb(0 0 0 / 0.08)` (só no cartão e na barra fixa de ações); alvo mínimo de toque `--alvo: 44px`; largura máxima do conteúdo `--largura-form: 720px` (linha de leitura curta).

---

## 4. Componentes necessários

Todos com CSS próprio. Primitivos visuais (sem regra de negócio) separados dos específicos do conteúdo.

**Primitivos**

| Componente | Variantes e estados |
|---|---|
| `Botao` | primário (preenchido), secundário (contorno), perigo (contorno vermelho, para remover), link (texto). Estados: normal, hover, foco, ativo, desabilitado, carregando (spinner + texto "Publicando..." mantendo a largura; `aria-busy`) |
| `Campo` | envelopa rótulo + controle + ajuda + erro. Rótulo sempre visível acima (nunca só placeholder). Ajuda opcional abaixo. Erro substitui a ajuda e liga ao controle por `aria-describedby`, controle com `aria-invalid="true"`. Variantes de controle: texto de uma linha, texto de várias linhas (`textarea`, com contador só se houver limite), número, seleção (`select` nativo), sim/não (checkbox nativo com rótulo) |
| `Aviso` | faixa com ícone + título + texto + ações. Tipos: informação, sucesso, aviso, erro. Erros e conflitos usam `role="alert"`; sucesso e pendente usam `role="status"` |
| `Etiqueta` | pílula pequena: "Publicado", "Não chegou ao site", "Em publicação", "Obrigatório", "Opcional" |
| `Cartao` | superfície com borda, para blocos e itens de lista |
| `Modal`/confirmação | diálogo nativo `<dialog>` para confirmar remoção de item e saída com edição não publicada; foco preso, `Esc` fecha |

**Específicos do conteúdo**

| Componente | Função |
|---|---|
| `CartaoBloco` | linha da lista de blocos (seção 5) |
| `ListaEditavel` | lista de itens com adicionar, remover, reordenar (seção 6.3); recebe como filho o formulário de um item |
| `CampoFoto` | envio e troca de foto (seção 6.4) |
| `BarraPublicar` | barra fixa no rodapé da edição: estado, contagem de erros, botão Publicar (seção 6.5) |
| `LinhaHistorico` | uma publicação do histórico (seção 7.7) |
| `CampoVideo` | escolha ou envio de vídeo com imagem de espera obrigatória (seção 6.7) |
| `ListaLinks` | lista de links, texto + destino de lista fechada (seção 6.8) |
| `GrupoCampos` | grupo de campos com título, recolhível (seção 6.9) |

`ListaEditavel`, `ListaLinks`, `CampoFoto`, `CampoVideo`, `GrupoCampos` e `BarraPublicar` não conhecem os 12 blocos: cada bloco é só uma configuração de campos. Evita nove telas escritas à mão.

---

## 5. Lista de blocos (`/admin/conteudo`) — CA-LOJ-50

Objetivo: mostrar os 9 blocos e a situação do site num relance, e levar ao bloco certo.

Topo: título "Conteúdo do site" e, abaixo, o resumo da última publicação: "Última publicação: 14/11/2026 às 16:32, por Ana (Planos e preços)". Link "Ver histórico". (Não há mais aviso de "publicação pendente" acima da lista: seção 7.6.)

Lista dos 12 blocos, **na ordem em que aparecem no site** (conferida em `admin/src/site/index.html` em 2026-11-15): **Geral (buscadores, cabeçalho, lojas de aplicativos, rodapé e newsletter)**, Abertura, Rede de parceiros (abertura), **Vídeos**, Planos e preços, Bônus do plano anual, História, Explore (cartões), Loja (cartões), Baixe o app, Novidades, **Página da loja (`/loja`)**. "Geral" vem primeiro porque o cabeçalho é a primeira coisa do site; "Página da loja" vem por último e leva a etiqueta "Outra página" (ela não está em `/`). Em 12 itens a grade segue 1, 2 e 3 colunas, sem mudança.

Cada `CartaoBloco` mostra:
- Nome do bloco (título).
- Uma linha de resumo do que há dentro, calculada dos dados publicados, sem inventar campo: ex.: "4 planos", "4 cartões", "3 notícias", "2 cartões"; os de texto simples mostram o primeiro texto cortado (a frase da Abertura, o título da História). Os novos: Geral mostra o título da página ("NUY"); Vídeos mostra "3 vídeos"; Página da loja mostra o título da página.
- Quando foi publicado pela última vez e por quem (a partir do histórico, por `blocos_alterados`); versão 1 da migração: "Conteúdo inicial".
- Botão "Editar" (secundário) que é o próprio cartão clicável; o cartão inteiro é um único link para o bloco (um só alvo de foco por cartão).

Layout:
- Celular: um cartão por linha, largura total. **Exceção registrada ao padrão de centralizar no celular:** esta é uma lista de itens de trabalho e a edição é formulário; fica alinhada à esquerda para leitura (a preferência de centralizar vale para páginas públicas, não para ferramenta interna). Cartões empilhados, 12 px entre eles.
- A partir de 768px: grade de 2 colunas; a partir de 1100px: 3 colunas.

Estados da tela:
- Carregando: esqueleto cinza dos 12 cartões (ou "Carregando..." no `Suspense`).
- Erro ao carregar (banco fora): `Aviso` erro "Não foi possível abrir o conteúdo agora. Tente de novo em instantes." + botão "Tentar de novo". O site público não é afetado (RNF-14); dizer isso: "O site continua no ar."
- Sem permissão: seção 7.8.
- Vazio: não existe (a versão 1 e a versão `migracao` dos blocos novos trazem os 12). Se vier sem nenhuma versão publicada, `Aviso` erro "O conteúdo inicial ainda não foi carregado. Avise o responsável técnico."

---

## 6. Edição de um bloco (`/admin/conteudo/[bloco]`)

### 6.1 Estrutura da página

1. Migalhas.
2. Título do bloco (h1) e linha de apoio: "O que você mudar aqui só vai ao site quando clicar em Publicar. Os outros blocos não são alterados."
3. Etiqueta "Alterações não publicadas" (aviso) quando o formulário difere do publicado.
4. Formulário em um cartão, largura máxima `--largura-form`.
5. `BarraPublicar` fixa no rodapé da janela.

Os campos vêm preenchidos com a **versão publicada mais recente** (a última `aceito`, não a `falhou`).

### 6.2 Campos de cada bloco

A tabela abaixo é o que o editor já tem (v1.0). **Os campos novos da spec v0.6 (A1 do ADR-0007) e os 3 blocos novos estão na seção 6.2b**; no formulário, cada bloco junta os campos das duas seções **na ordem em que aparecem na página** (vídeo de fundo por último, em grupo próprio). Rótulos de interface em PT-BR, com o nome do campo no site como dica quando ajudar. **Obrigatório** = tudo, exceto o marcado "opcional" (CA-LOJ-52; o `build.mjs` já recusa texto vazio e lista vazia).

| Bloco | Campos (tipo) | Listas | Fotos |
|---|---|---|---|
| Abertura | "Frase" (1 linha), "Linha das plataformas" (1 linha) | — | — |
| Rede de parceiros | "Título (parte em destaque)" (1 linha), "Título (continuação)" (1 linha), "Texto" (várias linhas) | — | — |
| Planos e preços | "Desconto do plano anual (%)" (número inteiro 0 a 90; ajuda: "Aparece como o desconto de quem paga por ano."), "Nota abaixo dos planos" (1 linha) | **Planos**: "Nome", "Preço mensal (R$)" (número com até 2 casas, 0 ou mais), "Resumo", "Texto do botão", "Selo" (opcional, ex.: Recomendado), **"O que inclui"** (sublista de textos curtos) | "Capa" de cada plano |
| Bônus do plano anual | "Rótulo", "Título linha 1", "Título linha 2", "Texto" | **Vantagens** (lista de textos) | — |
| História | "Rótulo", "Título linha 1", "Título linha 2", "Texto" | — | — |
| Explore | — | **Cartões**: "Título", "Texto", "Enquadramento da imagem" (opcional), "Mostrar a imagem inteira" (sim/não), "Leva para a seção" (escolha: Vídeos, Planos, Bônus anual, História, Explore, Loja, Baixar o app, Novidades) | "Imagem" de cada cartão |
| Loja | "Rótulo da seção", "Título linha 1", "Título linha 2 (vazada)" | **Cartões**: "Nome", "Descrição", "Descrição da foto (para quem não enxerga)" (opcional), "Texto do botão", **"Destino do botão"** (seção 6.6) | "Foto" de cada cartão |
| Novidades | — | **Notícias**: "Data" (texto livre, ex.: "Em breve"), "Título" | "Imagem" de cada notícia |
| Baixe o app | "Rótulo", "Título linha 1", "Título linha 2", "Texto" | — | — |

Notas:
- "Enquadramento da imagem" é o texto livre de posição que existe hoje (`"62% 50%"`). Dica: "Onde a imagem é cortada. Ex.: 62% 50%. Deixe vazio para o padrão." Sem editor visual (seria escopo novo).
- "Descrição da foto" aparece só no bloco Loja, porque só ele a tem hoje. Não criar para os outros.
- Os preços dos planos são exibição do site (RN-LOJ-18 não se aplica); ainda assim, o texto de ajuda do campo diz: "Valor mostrado no site. Quem cobra a assinatura é o app."
- Os ids dos planos/cartões não aparecem para a pessoa.
- Rótulos longos de título linha 1/linha 2: ajuda única "O título do site é em duas linhas; a segunda tem destaque visual." (a conferir com o `index.html`: se a linha 2 não é "vazada" em todos os blocos, a dica só entra onde vale).

### 6.2b Campos novos (A1, CA-LOJ-60 a 67)

Legenda de **tipo**: `T` texto de uma linha · `TL` texto de várias linhas · `L` lista de textos · `LINKS` lista de links (6.8) · `LI` link interno de lista fechada · `LE` link externo `https://` · `IMG` imagem (6.4) · `VID` vídeo (6.7) · `SEL` seleção. **Obrigatório** = tudo, exceto o marcado "opcional". **Valor inicial** = o texto atual do template (`admin/src/site/index.html`), gravado pela versão `migracao` (ADR-0007 A1); nada é inventado, exceto o bloco `pagina-loja`, que não existe hoje e traz texto **provisório** (copywriter, tarefa 22).

Escalas de limite (só para o layout não quebrar; o `dev-react` alinha o schema ao `montar`): **C1** até 40 caracteres (rótulo, título de linha, botão, nome) · **C2** até 100 (frase, nota, mensagem, item de lista) · **C3** até 400 (parágrafo). Valem também para os campos já existentes que hoje não têm máximo (conferir contra `scripts/conteudo-inicial/*.json` antes de fixar: nenhum valor inicial pode passar do limite). Contador "n/limite" só nos campos `TL` e nos de limite próprio (título e descrição do SEO).

**Bloco `geral` (novo)**, em 5 grupos (`fieldset` + `legend`, 6.9), publicado junto:

| Grupo | Rótulo | Tipo | Limites | Valor inicial | Ajuda |
|---|---|---|---|---|---|
| Buscadores | Título da página | T | 1–60 | NUY | "Aparece na aba do navegador e no Google. O mesmo texto vai no compartilhamento do link." |
| Buscadores | Descrição para buscadores | TL | 1–160 | NUYVI: teste de design da landing N.UY, com imagens de borda a borda, logo em zoom na rolagem e seções presas na tela. | "Resumo que o Google mostra sob o título. De 70 a 160 caracteres." |
| Cabeçalho | Slogan ao lado da logo | T | C1 | Conexões para viver melhor | — |
| Cabeçalho | Menu principal | LINKS | 1–6 itens; rótulo até 20 | 5 itens, todos para seções: Vídeos, Planos, Explore, Loja (seção Loja), Novidades | "O menu só aparece em telas largas (a partir de 1024 px)." |
| Cabeçalho | Botão "Baixar" | T | 1–16 | Baixar | "Sempre leva à seção Baixe o app. Some em telas pequenas." |
| Cabeçalho | Botão de entrar, texto completo | T | 1–20 | Entrar na NUY | "Para quem não está conectado. O copywriter revê o texto (tarefa 22)." |
| Cabeçalho | Botão de entrar, texto curto | T | 1–10 | Entrar | "Usado em telas estreitas (até 479 px)." |
| Cabeçalho | Texto "Sair" | T | 1–12 | Sair | "Para quem está conectado." |
| Cabeçalho | Texto "Painel" | T | 1–14 | Painel | "Só a equipe vê este botão." |
| Lojas de aplicativos | Endereço na App Store | LE, opcional | `https://`, até 300 | (vazio) | "Cole o endereço da página do app. Vazio: o botão fica desativado. Vale para a seção Baixe o app e para o rodapé." Erro: "Use um endereço que comece com https://." |
| Lojas de aplicativos | Endereço no Google Play | LE, opcional | igual | (vazio) | igual |
| Lojas de aplicativos | Dica do botão desativado | T | 1–30 | Em breve | "Aparece ao passar o mouse quando falta o endereço." |
| Rodapé | Slogan do rodapé | T | C1 | Conexões para viver melhor. | — |
| Rodapé | Links do rodapé | LINKS | 1–8 itens; rótulo até 30 | Vídeos, Planos, Explore, Loja (seção), Política de privacidade, Termos de uso | — |
| Rodapé | Linha de direitos | T | C2 | © 2026 N.UY. Todos os direitos reservados. | "O ano não muda sozinho: atualize em janeiro." |
| Rodapé | Linha de versão | T, opcional | 0–60 | NUYVI · versão de teste de design | "Vazio esconde a linha. É a marca da versão de teste." |
| Newsletter | Rótulo do campo | T | 1–50 | Receba as novidades da N.UY | — |
| Newsletter | Exemplo dentro do campo | T | 1–30 | seu@email.com | — |
| Newsletter | Texto do botão | T | 1–16 | Assinar | — |
| Newsletter | Mensagem de sucesso | T | C2 | Pronto! Você vai receber as novidades da N.UY. | "Atenção: hoje o formulário ainda não guarda e-mails (PEND-09). Só mostra esta mensagem." |
| Newsletter | Mensagem de e-mail inválido | T | C2 | Digite um e-mail válido, como nome@email.com. | — |

**Blocos existentes, campos acrescentados:**

| Bloco | Rótulo | Tipo | Limites | Valor inicial | Ajuda |
|---|---|---|---|---|---|
| Abertura | Texto do botão de entrar | T | 1–20 | Entrar na NUY | "Some para quem está conectado (o cabeçalho já mostra o nome)." |
| Abertura | Texto do botão de baixar | T | 1–20 | Baixar o app | "Leva à seção Baixe o app." |
| Abertura | Texto "Role para ver mais" | T | 1–30 | Role para ver mais | "Leva à seção Vídeos." |
| Abertura | Vídeo de fundo (computador) | VID | — | video/atletas-laranja-v2.mp4 | — |
| Abertura | Vídeo de fundo (celular) | VID, opcional | — | video/atletas-laranja-cel-v2.mp4 | "Usado em telas de até 767 px. Vazio: usa o do computador. Vertical funciona melhor." |
| Abertura | Imagem de espera | IMG | — | img/vi/atletas-poster.webp | 6.7 |
| Rede de parceiros | Vídeo de fundo + imagem de espera | VID + IMG | — | video/esportes/ciclismo.mp4 · img/esportes/ciclismo-poster.webp | — |
| Planos e preços | Rótulo | T | C1 | Planos | — |
| Planos e preços | Título linha 1 / linha 2 (vazada) | T | C1 | Escolha / seu ritmo | "O título do site é em duas linhas; a segunda tem destaque visual." |
| Planos e preços | Texto do seletor "Mensal" / "Anual" | T | 1–16 | Mensal / Anual | "Ao lado de "Anual" o site mostra sozinho o desconto, ex.: -20%." |
| Bônus do plano anual | Vídeo + imagem de espera | VID + IMG | — | video/esportes/natacao.mp4 · img/esportes/natacao-poster.webp | — |
| História | Vídeo + imagem de espera | VID + IMG | — | video/esportes/volei.mp4 · img/esportes/volei-poster.webp | — |
| Explore | Rótulo | T | C1 | Explore | — |
| Explore | Título linha 1 / linha 2 (vazada) | T | C1 | Tudo num / só app | igual ao de Planos |
| Explore | Texto "Ver mais" | T | 1–16 | Ver mais | "Aparece em todos os cartões." |
| Baixe o app | Texto do botão da App Store / do Google Play | T | 1–20 | App Store / Google Play | "O endereço de cada botão fica em Geral > Lojas de aplicativos." (com link para o bloco) |
| Baixe o app | Vídeo de fundo + imagem de espera | VID + IMG | — | video/esportes/corrida.mp4 · img/esportes/corrida-poster.webp | — |
| Novidades | Rótulo | T | C1 | Novidades | — |
| Novidades | Título linha 1 / linha 2 (vazada) | T | C1 | Últimas / notícias | igual ao de Planos |

**Bloco `videos` (novo)**, seção Vídeos:

| Grupo | Rótulo | Tipo | Limites | Valor inicial | Ajuda |
|---|---|---|---|---|---|
| Títulos | Rótulo | T | C1 | Vídeos | — |
| Títulos | Título linha 1 / linha 2 (vazada) | T | C1 | Veja por / dentro | "O título do site é em duas linhas; a segunda tem destaque visual." |
| Frase que troca | Início da frase / meio da frase | T | 1–20 cada | Aqui você / encontra | "A frase é: início, meio e uma palavra que muda sozinha." |
| Frase que troca | Palavras que trocam | L | 2–8 itens; até 20 cada | amigos, eventos, acessórios, dicas, saúde, diversão | "Aparecem uma de cada vez, na ordem. O texto lido por leitor de tela lista todas." Mínimo 2 `[a confirmar com o dev-react: com 1 palavra o script do site não tem o que alternar; se aceitar 1, o mínimo é 1 como na spec]` |
| Vídeo grande (horizontal 16:9) | Etiqueta / Título | T | 1–30 / C1 | Por dentro do app / Veja por dentro | — |
| Vídeo grande | Vídeo + imagem de espera | VID + IMG | — | video/pordentro.mp4 · img/pordentro-poster.webp | — |
| Vídeo vertical 1 | Etiqueta / Título | T | 1–30 / C1 | Performance / Avatar 3D | — |
| Vídeo vertical 1 | Vídeo + imagem de espera | VID + IMG | — | video/avatar360.mp4 · img/avatar360-poster.webp | "Vertical, perto de 9:16." |
| Vídeo vertical 2 | Etiqueta / Título | T | 1–30 / C1 | Premium / Especialistas por vídeo | — |
| Vídeo vertical 2 | Vídeo + imagem de espera | VID + IMG | — | video/videochamada.mp4 · img/vi/videochamada.webp | "Vertical, perto de 9:16." |

Os 3 cartões são **fixos**: não há adicionar, remover nem reordenar (spec 4.3). Por isso são 3 grupos, não uma `ListaEditavel`.

**Bloco `pagina-loja` (novo)**, textos da página `/loja` (layout em [ui-site-sessao-e-loja.md](ui-site-sessao-e-loja.md)). Tudo provisório, exceto o que a spec já dá; copywriter fecha (tarefa 22):

| Rótulo | Tipo | Limites | Valor inicial | Ajuda |
|---|---|---|---|---|
| Título da página | T | 1–60 | Loja N.UY | "Aba do navegador e Google." |
| Descrição para buscadores | TL | 1–160 | Calçados, roupas e acessórios para quem treina. | — |
| Rótulo | T | C1 | Loja N.UY | — |
| Título linha 1 / linha 2 (vazada) | T | C1 | Equipado / para treinar | duas linhas, a segunda com destaque |
| Texto de abertura | TL | C3 | Tênis, roupas e acessórios para o seu treino. | "Aparece sob o título." |
| Texto do estado vazio | T | C2 | Em breve | "Aparece quando não há produto à venda." (CA-LOJ-79) |
| Texto antes do preço | T | 1–20 | a partir de | "Só aparece quando as variações têm preços diferentes." (CA-LOJ-78) |
| Texto de esgotado | T | 1–16 | Esgotado | "Marca o produto sem estoque." (RN-LOJ-30) |

**Proposta fora da v0.6 (decisão do `arquiteto-specs`):** três textos que hoje moram no script do site, não no HTML, e por isso escapam do CA-LOJ-60 ("cada texto visível"): **"por mês"**, **"para sempre"** (preço zero) e **"cobrados por ano"**. Recomendo 3 campos no bloco Planos (grupo "Legendas do preço", C1, valores iniciais acima), passados ao script pelo JSON `dados-planos`. Sem a decisão, ficam fixos e a spec registra a exceção.

**Divergência a resolver:** a spec 5.9 põe os endereços da App Store e do Google Play no bloco "Baixe o app"; o ADR-0007 A1 põe em `geral`. Segui o **ADR** (os selos do rodapé usam os mesmos endereços) e deixei um aviso com link em "Baixe o app". Se o dono preferir o campo na seção, é trocar o `ref`; o visual não muda.

### 6.2c O que fica fixo (PREM-15 e RN-LOJ-27)

Não aparece no painel, de propósito:
- **Estrutura, classes, cores, animações e ordem das seções**; número e formato dos 3 cartões de vídeo; cor de fundo de cada seção.
- **Marca**: logos do cabeçalho, da abertura e do rodapé (e o texto alternativo "N.UY"), favicons, ícone de app. **Selos da App Store e do Google Play**: a imagem e o texto alternativo ficam fixos (o alt descreve a imagem oficial; mudar o alt sem mudar a imagem os desencontra). O **endereço** dos selos é editável (Geral).
- **Rótulos só para leitor de tela**: "Pular para o conteúdo", "N.UY, voltar ao início", "Pausar animações", "Plano anterior/Próximo plano", "Cartão anterior/Próximo cartão", "Notícia anterior/Próxima notícia", nomes dos carrosséis ("Planos da N.UY", "Recursos do app", "Últimas notícias"), "Forma de pagamento", "Principal", "Rodapé", "i de n", "(abre em nova aba)". Mais os novos da sessão ("Conectado como", "Você saiu.", ver o outro arquivo).
- **Destinos fixos dos botões**: "Baixar" e "Baixar o app" → seção Baixe o app; "Role para ver mais" → Vídeos; botões dos planos → Baixe o app; destino do "Entrar" → `/login`.
- **Montagem do texto**: a palavra "e" que fecha a lista lida pelo leitor de tela na frase que troca; formato de dinheiro ("R$ 19,90"); o selo de desconto ("-20%", calculado do desconto do plano anual).
- **Metadados técnicos**: `robots` (hoje `noindex`), `theme-color`, idioma. `noindex` é decisão de lançamento, não de conteúdo: ao abrir o site para buscadores, é mudança de código (`dev-performance-seo`).
- **Imagens decorativas** sem texto alternativo (planos, Explore, notícias; pergunta 5) e **vídeos de fundo** (decorativos, sem áudio, `aria-hidden`).
- **Páginas legais** (`politica-de-privacidade.html`, `termos-de-uso.html`) e `versao-*.html`. Os *links* para as legais são editáveis (rodapé); o texto delas, não.
- **Produtos, preços, categorias, estoque** da `/loja`: vêm do catálogo (RN-LOJ-18).

### 6.3 Listas (adicionar, remover, reordenar) — CA-LOJ-53

`ListaEditavel`:
- Cada item é um `Cartao` com cabeçalho "Cartão 2 de 4" (ou "Plano 3 de 4", "Notícia 1 de 3") + resumo do título do item + ações, e o corpo com os campos do item. Itens abertos por padrão se a lista tem até 5; recolhíveis (botão "Recolher/Expandir", `aria-expanded`) para listas longas.
- **Reordenar por botões**, não por arrastar: "Mover para cima" e "Mover para baixo" (ícone de seta + `aria-label` "Mover Cartão 2 para cima"). Primeiro item sem "para cima" (desabilitado), último sem "para baixo". Funciona com teclado, leitor de tela e celular. Arrastar pode vir depois, como complemento; não faz parte do mínimo.
  - Depois de mover, o foco fica no botão que foi usado (no item na nova posição) e uma região `aria-live="polite"` anuncia "Cartão movido para a posição 1 de 4".
- **Adicionar**: botão secundário "Adicionar cartão" (ou "plano", "notícia", "vantagem", "item") abaixo da lista. Cria um item vazio no fim, abre, e leva o foco ao primeiro campo dele.
- **Remover**: botão de perigo "Remover" no cabeçalho do item. Pede confirmação em `Modal`: "Remover o cartão 'Comunidade'? Ele sai do site quando você publicar." Botões: "Remover" (perigo) e "Cancelar" (foco inicial no Cancelar). Remover só altera a tela; nada sai do site antes de Publicar (não é desfazer: é fácil de recarregar a página para voltar atrás, mas avisar).
- Para sublistas simples de textos ("O que inclui", "Vantagens"), cada linha é um campo de uma linha com os mesmos botões (subir, descer, remover) compactos, sem modal de confirmação (remover é barato; a edição inteira só é publicada no fim).
- **Mínimo e máximo** (CA-LOJ-53, "dev-uiux define"): **mínimo 1 item** em todas as listas (o `build.mjs` recusa lista vazia: "precisa de pelo menos um item"); o botão "Remover" do último item fica desabilitado com a dica "A lista precisa de pelo menos um item". **Sem máximo**: o site usa carrossel (`aria-label="i de n"` no `build.mjs`), então comporta qualquer quantidade. `[A confirmar com o dev-react: se "O que inclui" aceita lista vazia no build.mjs, relaxar o mínimo dessa sublista.]`
- Lista vazia no início não ocorre (vem do publicado).

### 6.4 Fotos — CA-LOJ-54

`CampoFoto` mostra: miniatura da imagem atual (proporção preservada, máx. 160 px de altura), o nome do arquivo ou "Imagem atual do site", o botão "Trocar foto" e, se houver foto nova ainda não publicada, a etiqueta "Nova, ainda não publicada" e o botão "Voltar à foto anterior".

Regras de aceite:
- **Formatos aceitos: JPEG, PNG e WebP.** **SVG não é aceito** (pode conter script; decisão de segurança da spec/RNF). GIF também não (sem uso hoje). O tipo é conferido pelo conteúdo do arquivo no servidor, não só pela extensão (o `dev-security` revisa).
- **Tamanho máximo: 4,5 MB por foto** (limite do corpo de função da Vercel é a razão técnica; ver ADR-0006). Dica fixa sob o botão: "JPEG, PNG ou WebP, até 4,5 MB." Dizer o limite *antes* do erro.
- Recomendação de dimensão (só ajuda, não bloqueia): "Use imagens com pelo menos 1200 px de largura. Fotos muito pesadas deixam o site lento." O `dev-performance-seo` pode definir um teto de dimensões se quiser; no MVP, sem redimensionamento no painel `[decisão aberta: pergunta 4]`.
- Alvo de toque: botão "Trocar foto" abre o seletor de arquivo do aparelho (no celular, câmera/galeria).

Fluxo e estados:
1. Escolheu o arquivo: validação rápida no navegador (tipo e tamanho) para resposta imediata; o servidor valida de novo (a do navegador é só conforto).
2. Enviando: miniatura esmaecida + "Enviando..." (`role="status"`), botão Publicar desabilitado enquanto houver envio.
3. Enviada: miniatura nova + "Nova, ainda não publicada". Nada muda no site até Publicar. O arquivo já está no armazenamento (Blob), o que significa que uma foto enviada e nunca publicada fica órfã lá `[aceitável no MVP; limpeza é decisão do dev-react]`.
4. Recusada: o erro aparece **no campo da foto**, a foto anterior continua, e nada muda (CA-LOJ-54):
   - formato: "Formato não aceito. Envie JPEG, PNG ou WebP."
   - tamanho: "Arquivo grande demais (7,2 MB). O máximo é 4,5 MB."
   - falha de envio: "Não foi possível enviar a foto. Verifique a internet e tente de novo."
5. Obrigatoriedade: toda foto que existe hoje é obrigatória (o item não pode ficar sem imagem). Não há botão "remover foto", só trocar.
6. Texto alternativo: só existe campo de descrição no bloco Loja (opcional). Nos demais, o site já tem o seu tratamento; **não criar campo novo** (fora do escopo). Sinalizar ao `copywriter`/cliente que os cartões do Explore, planos e notícias ficam sem descrição editável (pergunta 5).

### 6.5 Validação inline e botão Publicar — CA-LOJ-52

Regras de validação (mesmas do servidor e do `build.mjs`; RISCO-16 pede o teste de contrato entre os dois):

| Campo | Regra | Mensagem |
|---|---|---|
| Texto obrigatório | não vazio depois de remover espaços das pontas | "Preencha este campo." |
| Desconto do plano anual | inteiro de 0 a 90 | "Informe um número de 0 a 90." |
| Preço mensal | número 0 ou maior, até 2 casas decimais | "Informe um valor em reais, 0 ou maior. Ex.: 19,90." |
| Destino da seção (Explore) | uma das 8 opções | "Escolha uma seção." |
| Destino do botão (Loja) | uma categoria da loja | "Escolha para onde o botão leva." |
| Lista | pelo menos 1 item | "Adicione pelo menos um item." |
| Foto | seção 6.4 | |

Comportamento:
- **Não validar enquanto a pessoa digita pela primeira vez.** Validar ao sair do campo (`blur`) e, depois que o campo já mostrou erro, revalidar a cada tecla para o erro sumir assim que for corrigido.
- Erro: texto vermelho com ícone "!" abaixo do campo, **ligado ao controle por `aria-describedby`**, borda vermelha (e não só a cor), `aria-invalid="true"`. A mensagem diz o que fazer, em linguagem direta.
- Em item de lista com erro, o cabeçalho do item mostra a etiqueta "Tem erro" e o item **expande** automaticamente, mesmo recolhido.
- **Ao clicar em Publicar com erros:** nada é enviado. Aparece no topo do formulário um `Aviso` erro (`role="alert"`, foco movido para ele): "Não publicado. Corrija 3 campos abaixo." com **lista de links** para cada campo com erro (o link leva o foco ao campo). O site continua com a versão anterior; dizer isso no texto: "O site continua como estava."
- Erros que só o servidor detecta (ex.: conteúdo recusado) aparecem do mesmo jeito, mapeados ao campo pelo caminho devolvido.

`BarraPublicar` (fixa no rodapé da janela, para o botão estar sempre ao alcance, também no celular):
- Esquerda: situação. "Nenhuma alteração" | "Alterações não publicadas" | "Publicando..." | mensagem de resultado.
- Direita: botões "Descartar alterações" (link, só se houver alteração; pede confirmação) e **"Publicar"** (primário, **único primário da tela**).
- **Publicar fica desabilitado** quando: não há alteração, há foto ou vídeo sendo enviado, ou durante a própria publicação. (Não existe mais "publicação pendente de outra pessoa": publicar não depende de build nem de fila; duas pessoas ao mesmo tempo caem no conflito de 7.5.) Botão desabilitado explica o motivo no texto ao lado (não deixar mudo): ex.: "Nenhuma alteração para publicar."
- Rótulo do botão traz o contexto: "Publicar Planos e preços". Clique abre **uma confirmação curta**? **Não**: confirmação em todo clique vira hábito e é ignorada; a salvaguarda é a validação + histórico + aviso de que a mudança vai ao ar. O texto ao lado do botão, na situação "Alterações não publicadas", já avisa: "Ao publicar, a mudança já aparece no site." (A publicação é imediata e sem desfazer: a salvaguarda continua sendo a validação, o histórico e este aviso.) `[Sem desfazer (P-18): se o cliente quiser confirmação extra, registrar como decisão.]`
- Celular: barra em largura total, botão Publicar em largura total acima do texto de situação, alvo ≥ 44 px, "Descartar" como link abaixo.

### 6.6 Campo "Destino do botão" dos cartões da Loja — CA-LOJ-58

- Rótulo: "Destino do botão". Controle: **seleção (`select`)** com as **categorias da loja** (nome visível ao editor; o valor guardado é o identificador da categoria que forma `https://<loja>/categoria/<slug>`, ver arquitetura seção 6). **Nunca campo de URL livre**: evita link quebrado, link para fora e erro de digitação (e é mais seguro: o `build.mjs` só aceita o que a loja define).
- Ajuda: "Para onde o botão do cartão leva na loja. O cartão não mostra preço nem estoque."
- Obrigatório. Primeiro item "Escolha uma categoria" (valor vazio, não vale).
- **Dependência:** as categorias vêm do catálogo da loja, que só nasce na fase 1b. Até lá a lista pode estar vazia. Duas formas (decisão aberta, pergunta 1):
  - (a) Enquanto não houver categorias, a opção única é **"Página inicial da loja"** e o campo continua obrigatório; ou
  - (b) o campo fica oculto até a loja ter categorias, e o cartão publicado mantém o botão atual.
  Recomendação: **(a)** (CA-LOJ-58 exige o campo; evita o painel parecer incompleto). Isso exige que o módulo `conteudo-site` receba a lista de destinos válidos de uma função do catálogo, com a "Página inicial da loja" como valor fixo (`dev-react` decide a interface).
- Aviso de categoria removida depois: se o destino salvo não existir mais na lista, o select mostra "Categoria não existe mais" com erro, e o bloco não publica até escolher outra.
- Texto do botão (campo ao lado) é livre; sem sugestão automática (texto é do copywriter; hoje "Comprar no app").

### 6.7 Campo de vídeo (`CampoVideo`) — CA-LOJ-63

Um `fieldset` com `legend` = nome do vídeo ("Vídeo de fundo (computador)", "Vídeo grande"). Dentro, de cima para baixo:

1. **Prévia**: `<video controls muted playsinline preload="metadata">` com a imagem de espera atual, altura máxima 200 px (160 px no celular), **sem autoplay**, `aria-label="Prévia do vídeo: <nome do arquivo>"`. Abaixo, o nome do arquivo ("atletas-laranja-v2.mp4") ou "Vídeo enviado pelo painel" e o tamanho. Se o navegador não tocar: "Não foi possível mostrar a prévia neste navegador. O vídeo continua valendo."
2. **Escolher um que já existe**: `select` "Vídeos que já estão no site", com os arquivos de `public/video/` pelo nome do arquivo (o atual vem marcado; se o atual foi enviado pelo painel, a primeira opção é "Vídeo enviado pelo painel (atual)"). Escolher aplica na hora, só na tela. A lista de arquivos vem do servidor; como o `dev-react` a monta (lista gerada no build) é dele.
3. **Enviar um novo**: botão secundário "Enviar um vídeo novo" (abre o seletor, `accept="video/mp4,video/webm"`). Dica fixa sob o botão, antes de qualquer erro: "MP4 ou WebM, até 4,5 MB. É vídeo de fundo, sem som; de preferência com até 15 segundos." (MP4 em H.264 é o mais compatível: recomendação, não regra; *não verificado* contra a lista de codecs do navegador, quem confere é o `dev-performance-seo`).
4. **Imagem de espera (pôster), obrigatória**: um `CampoFoto` (6.4) logo abaixo, no mesmo `fieldset`, rótulo "Imagem de espera". Ajuda: "Aparece enquanto o vídeo carrega e para quem pausa as animações. Use um quadro do vídeo." Trocar o vídeo **não** troca o pôster sozinho; enquanto o vídeo mudou e o pôster não, aparece um aviso leve (`role="status"`, não bloqueia): "Você trocou o vídeo. Confira se a imagem de espera combina com ele."
5. Variante de celular (só na Abertura): é **outro `CampoVideo` opcional** logo depois, com a ajuda "Vazio: usa o vídeo do computador". Opcional = botão "Remover o vídeo de celular" (sem modal) e o select ganha a opção "Nenhum (usar o do computador)".

Estados e mensagens (todos no próprio campo; o vídeo anterior continua e nada muda no site, CA-LOJ-63):

| Estado | Comportamento e texto |
|---|---|
| Normal | prévia + nome. Sem etiqueta |
| Escolhido da lista, não publicado | etiqueta "Alterado, ainda não publicado" + "Voltar ao vídeo anterior" |
| Enviando | select e botão desabilitados; `<progress>` com "Enviando... 40%" (ou sem número, "Enviando...", se não houver como medir); botão "Cancelar envio"; `role="status"`; **Publicar desabilitado** com o motivo na barra ("Aguarde o envio do vídeo terminar.") |
| Enviado | prévia nova + "Novo, ainda não publicado" + "Voltar ao vídeo anterior" |
| Formato | "Formato não aceito. Envie MP4 ou WebM." |
| Tamanho | "Arquivo grande demais (7,2 MB). O máximo é 4,5 MB." |
| Conteúdo | "Este arquivo não parece ser um vídeo MP4 ou WebM." (o servidor confere o conteúdo, não a extensão) |
| Falha de envio / rede | "Não foi possível enviar o vídeo. Verifique a internet e tente de novo." (`role="alert"`) |
| Cancelado | volta ao vídeo anterior, sem erro; "Envio cancelado." em `role="status"` |
| Sem pôster | erro no campo da imagem: "Envie a imagem de espera deste vídeo." |

Regras: 4,5 MB é o limite do **arquivo** (mesma razão da foto, ADR-0007 A1; o maior vídeo atual tem 2,6 MB). A checagem no navegador (tipo, tamanho) é conforto; a do servidor vale. Um vídeo enviado e nunca publicado fica órfão no Blob (igual à foto). Vídeo maior que o limite: ver o gatilho do ADR (envio direto ao Blob), não é escopo agora.

Acessibilidade: `fieldset`/`legend`; erros ligados por `aria-describedby`; progresso com `role="progressbar"`, `aria-valuenow` (ou indeterminado) e rótulo "Enviando o vídeo"; botão de cancelar alcançável por teclado; foco volta ao botão "Enviar um vídeo novo" depois de concluir ou cancelar; prévia com controles nativos, sem autoplay (WCAG 2.2.2). Celular: botões em largura total, alvo ≥ 44 px, o seletor abre a galeria. Sem movimento próprio; com `prefers-reduced-motion` a barra de progresso não anima.

Definições que a spec deixou em aberto (CA-LOJ-63): **formatos MP4 e WebM, 4,5 MB**. `dev-performance-seo` confirma se quer teto de duração ou de resolução (hoje só dica).

### 6.8 Lista de links (`ListaLinks`): menu e rodapé — CA-LOJ-65

Variante da `ListaEditavel` (6.3) para uma lista de pares **texto do link + destino**.

- Cada item é uma linha: em ≥ 768 px, "Texto do link" e "Leva para" lado a lado, com subir, descer e remover à direita; no celular, empilhados. Cabeçalho do item: "Link 2 de 5". Subir e descer por botões (6.3). **Remover sem modal** (remover um link é barato e só vale ao publicar), com o mínimo de 1 item como em 6.3 (menu: 1 a 6 itens; rodapé: 1 a 8).
- **Leva para** é um `select` nativo, com grupos (`optgroup`), **lista fechada**, vazio "Escolha para onde o link leva" (não vale):
  - *Seções do site*: Vídeos, Planos, Bônus anual, História, Explore, **Seção Loja (cartões da página inicial)**, Baixe o app, Novidades.
  - *Páginas*: Início do site, **Página da loja (`/loja`)**, Entrar (`/login`), Política de privacidade, Termos de uso.
  Os dois "Loja" têm nomes diferentes de propósito: um rola a página inicial, o outro abre `/loja`.
- **Externo `https://`**: o componente aceita uma opção "Outro endereço (https)" que mostra um campo de endereço (erro: "Use um endereço que comece com https://."), mas fica **desligado** (`permiteExterno = false`) no menu e no rodapé, porque o CA-LOJ-65 diz "nenhum destino fora da lista". Pergunta 10 abaixo.
- Erros: texto vazio "Preencha este campo."; destino vazio "Escolha para onde o link leva.". Item com erro expande e mostra a etiqueta "Tem erro" (6.5).
- Menu e rodapé são listas independentes; o destino "Seção X" funciona em `/` e em `/loja` (como os links se comportam em `/loja`: [ui-site-sessao-e-loja.md](ui-site-sessao-e-loja.md)).

### 6.9 Blocos com grupos (`GrupoCampos`) — bloco Geral e Vídeos

O bloco Geral tem ~20 campos. Para não virar uma parede de campos:
- Os campos ficam em **grupos** (`fieldset` + `legend` com visual de título de seção, 20 px, 6.3 de tokens): Buscadores, Cabeçalho, Lojas de aplicativos, Rodapé, Newsletter. Em Vídeos: Títulos, Frase que troca e os 3 vídeos.
- Blocos com 3 ou mais grupos mostram no topo "Neste bloco:" com links de âncora para cada grupo (o foco vai ao título do grupo).
- Grupos abertos por padrão, com botão "Recolher/Expandir" (`aria-expanded`). Grupo com erro expande sozinho e mostra a etiqueta "Tem erro".
- É **um bloco, uma publicação**: o botão é "Publicar Geral" e vale para todos os grupos (a regra "edição e publicação por bloco" da seção 1 não muda).

---

## 7. Estados do fluxo de publicação (seção 9.2 da spec)

Resumo: **toda resposta é anunciada na `BarraPublicar` e, quando exige ação, em um `Aviso` no topo do formulário.** A edição digitada nunca é apagada por erro.

### 7.1 Salvando / publicando
- Botão vira "Publicando..." com spinner, `aria-busy="true"`, desabilitado; todos os campos ficam somente leitura (evita editar durante o envio).
- Região `role="status"`: "Publicando Planos e preços...".
- Se passar de 10 s: acrescenta "Isso está demorando mais que o normal. Não feche esta página." (gravar a versão e atualizar o site deve responder em segundos).

### 7.2 Publicado (sucesso)
Mostrado quando a versão foi gravada **e** a Server Action já expirou o cache de `/` (e de `/loja`, no bloco `pagina-loja`): a próxima visita recebe o conteúdo novo (ADR-0007). Por isso o texto pode dizer "já está no site" (o "em até alguns minutos" e o RISCO-16 deixaram de existir).

`Aviso` sucesso (`role="status"`), título **"Publicado."**, texto **"A mudança já está no site."** (os dois já estão no código e ficam como estão).
- Ações, todas como link, sem botão primário no aviso: **"Ver no site"** (abre `/`, ou `/loja` no bloco Página da loja, em nova aba; o leitor de tela ouve "(abre em nova aba)"), "Voltar à lista de blocos" e "Continuar editando". "Ver no site" é novo: como a mudança é imediata, conferir vale mais que esperar.
- Formulário continua com os valores publicados; situação volta a "Nenhuma alteração"; guarda o novo `versaoBase`.
- Limite honesto: "já está no site" vale para a **próxima** abertura da página; quem já a tinha aberta só vê a mudança ao recarregar. Não precisa dizer na tela.
- Na lista de blocos e no histórico, a publicação aparece como "Publicado".

### 7.3 Falha ao publicar, edição preservada — CA-LOJ-55
`Aviso` erro (`role="alert"`, foco no aviso): **"Não foi possível publicar, tente de novo."**
Texto: "O site continua como estava; nada foi alterado. O que você digitou está aqui, nada foi perdido."
- Ação: botão "Tentar de novo" (primário) no próprio aviso; o botão Publicar da barra também volta a funcionar.
- Os campos mantêm o digitado, **inclusive fotos e vídeos já enviados**. Nada foi gravado, então o `versaoBase` da tela continua o mesmo.
- Se falhar de novo repetidamente: depois da 2ª falha seguida, acrescenta "Se continuar, avise o responsável técnico." (sem expor motivo técnico).
- Falha não deixa rastro no histórico (7.7): só entram versões que foram ao ar.

### 7.4 Erro de rede (nem chegou ao servidor)
Mesmo visual de 7.3, texto: "Sem conexão. Verifique a internet e tente de novo." A edição fica. Sem risco de duplicar a publicação: o servidor devolve conflito se a primeira passou (7.5).

### 7.5 Conflito de versão
Quando o servidor responde conflito (`23514` ou `23505` na PK; banco.md): outra pessoa publicou depois que a tela foi aberta.

`Aviso` aviso (`role="alert"`): **"Outra pessoa publicou enquanto você editava."**
- **O que foi digitado fica na tela**, intacto.
- Mínimo (sempre disponível): botão "Carregar a versão atual" → recarrega o formulário com o publicado mais recente. **Antes de descartar, confirmar:** "Isso troca o que você digitou pela versão atual. Quer continuar?" (cancelável).
- Caso o conflito não envolva o mesmo bloco (a outra publicação mudou outros blocos; só o `blocos_alterados` das versões novas diz isso): como o módulo monta a versão nova como "última publicada + este bloco", publicar este bloco é seguro. Então o aviso diz: "A outra publicação mudou 'História'. O bloco que você está editando não foi alterado." e oferece **"Publicar o meu bloco"** (primário), que reenvia com a base atualizada e sem perder nada.
- Caso o conflito toque o mesmo bloco: "A outra publicação mudou este bloco." Ações: **"Carregar a versão atual"** (com confirmação acima) e **"Publicar a minha por cima"** (secundário, perigo; com confirmação: "Isso substitui o que a outra pessoa publicou neste bloco. A versão dela continua no histórico.").
- Tom: "recarregue" é o mínimo da regra; a opção de reenviar depende de o módulo devolver à tela os blocos alterados desde a `versaoBase` `[a confirmar com o dev-react: pergunta 3; se não for viável, ficam só "Carregar a versão atual" e a instrução "copie o que digitou antes de recarregar" com a tela mantida]`.
- O foco vai para o aviso. Mensagem do histórico: depois de publicar, a versão aparece normalmente.

### 7.6 Sem fila de publicação
Com o ADR-0007 não existe publicação "em andamento": gravar e atualizar o site é um passo só, e **somem** o aviso "Há uma publicação em andamento", a consulta a cada 5 s, o botão "Tentar de novo" com espera de 5 s e a trava do Publicar por pendência.
- Duas pessoas publicando quase juntas: a segunda recebe o **conflito de 7.5**, não uma espera.
- O Publicar só fica desabilitado pelos motivos de 6.5 (sem alteração, envio de foto ou vídeo, publicando).
- **Caso a confirmar com o `dev-react`** (hipótese H1 do ADR): se a versão foi gravada mas a atualização do site falhou, a tela **não pode** dizer "A mudança já está no site." Texto proposto, `Aviso` aviso (`role="alert"`): título "Publicado, mas o site pode demorar a mostrar." e corpo "Sua mudança foi salva. Se não aparecer em alguns minutos, avise o responsável técnico." Só entra se a action distinguir os dois resultados; senão, qualquer falha cai em 7.3 e a próxima tentativa recai em conflito de 7.5 (a base mudou). Decidir antes do corte (passo 7 do ADR).

### 7.7 Histórico de publicações (`/admin/conteudo/historico`) — CA-LOJ-57
Tabela no desktop, lista de cartões no celular. Colunas: **Data e hora** (fuso de Brasília, formato "14/11/2026 16:32"), **Quem publicou**, **Bloco** (nome em português, um ou mais). **Sem coluna "Situação"**: toda linha é uma publicação que foi ao ar.
- Quem publicou: o nome da conta. Se a conta foi removida: **"Conta removida"** (texto cinza, não é erro). Versões de origem `migracao`: **"Conteúdo inicial"** como autor; a primeira com bloco "Todos os blocos", e a que trouxe os campos novos (A1) com os blocos que ganharam campos (Geral, Vídeos, Página da loja e os demais).
- **Só aparecem versões que foram ao ar** (`aceito`). Linhas antigas `falhou` e `pendente`, que só existiam por causa do deploy hook, ficam **fora da lista** (nunca mudaram o site). Some, com elas, a etiqueta "Não chegou ao site" e a ajuda "O pedido de publicação falhou…" `[a confirmar com o dev-database: se as colunas disparo_* ficam como histórico ou são simplificadas, ADR-0007]`.
- Mais novo primeiro; 50 por página, botão "Ver mais antigas" (paginação por número, banco.md consulta 5).
- Sem conteúdo da versão (a consulta nem traz `conteudo`): o histórico só diz quem, quando e qual bloco. "Ver o que mudou" e restaurar versão **não** estão no escopo (P-18). Dizer isso ao dono no resumo.
- Vazio: "Ainda não há publicações." (na prática nunca, por causa da versão 1.)
- Erro ao carregar: "Não foi possível abrir o histórico. Tente de novo." + botão.

### 7.8 Sem permissão — CA-LOJ-56
Tela dentro da casca, `role` normal (h1): **"Sem permissão"**. Texto: "Seu acesso não permite editar o conteúdo do site. Peça ao responsável da loja." Link "Voltar ao início". Nenhum dado do conteúdo é enviado ao navegador. Quando a tentativa é uma ação de publicar (por qualquer caminho), a resposta é a mesma mensagem e nada é alterado. Operador: o item sequer aparece no menu (seção 2).
Sessão expirada (não é falta de permissão): "Sua sessão expirou. Entre de novo." com link para `/login`; **a edição digitada não se perde só pelo redirecionamento** `[o dev-react decide: guardar no navegador (sessionStorage) por conta e restaurar após o login, ou avisar antes]`; no mínimo, a tela de sessão expirada deve aparecer sem apagar o formulário e permitir reentrar numa nova aba.

### 7.9 Saída com edição não publicada
Se há alteração e a pessoa tenta sair (link do menu, migalha, botão voltar, fechar a aba): aviso nativo `beforeunload` ao fechar/recarregar e `Modal` ao navegar dentro do painel: "Você tem alterações não publicadas neste bloco. Se sair, elas se perdem." Botões: "Continuar editando" (foco inicial) e "Sair sem publicar" (perigo).

### 7.10 Outros estados
- Carregando o bloco: esqueleto do formulário.
- Erro ao carregar o bloco: igual a 5.
- Bloco inexistente (slug inválido): "Bloco não encontrado." + link para a lista.
- Loja fora do ar: o painel também fica fora (mesma aplicação, CA-LOJ-59); o site público não muda.

---

## 8. Microcopy (PT-BR)

Tom: direto, sem culpar, diz o que aconteceu e o que fazer. Sem termos técnicos (hook, build, versão, 23505). Tratamento por "você".

| Situação | Texto |
|---|---|
| Título da área | Conteúdo do site |
| Apoio da edição | O que você mudar aqui só vai ao site quando clicar em Publicar. Os outros blocos não são alterados. |
| Situação, sem mudança | Nenhuma alteração para publicar. |
| Situação, com mudança | Alterações não publicadas. Ao publicar, a mudança já aparece no site. |
| Situação, enviando mídia | Aguarde o envio da foto terminar. / Aguarde o envio do vídeo terminar. |
| Botão | Publicar Planos e preços |
| Publicando | Publicando... |
| Publicado | Publicado. A mudança já está no site. (links: Ver no site · Voltar à lista de blocos · Continuar editando) |
| Falha | Não foi possível publicar, tente de novo. O site continua como estava. O que você digitou está aqui, nada foi perdido. |
| Falha repetida | Se continuar, avise o responsável técnico. |
| Sem internet | Sem conexão. Verifique a internet e tente de novo. |
| Erro de validação (topo) | Não publicado. Corrija N campos abaixo. O site continua como estava. |
| Conflito | Outra pessoa publicou enquanto você editava. |
| Conflito, outro bloco | A outra publicação mudou "[bloco]". O bloco que você está editando não foi alterado. |
| Conflito, mesmo bloco | A outra publicação mudou este bloco. |
| Confirma carregar atual | Isso troca o que você digitou pela versão atual. Quer continuar? |
| Salvo, site pode demorar (só se o dev-react confirmar, 7.6) | Publicado, mas o site pode demorar a mostrar. Sua mudança foi salva. Se não aparecer em alguns minutos, avise o responsável técnico. |
| Vídeo, formato | Formato não aceito. Envie MP4 ou WebM. |
| Vídeo, tamanho | Arquivo grande demais ([x] MB). O máximo é 4,5 MB. |
| Vídeo, conteúdo | Este arquivo não parece ser um vídeo MP4 ou WebM. |
| Vídeo, falha | Não foi possível enviar o vídeo. Verifique a internet e tente de novo. |
| Vídeo, cancelado | Envio cancelado. |
| Vídeo, troca sem pôster novo | Você trocou o vídeo. Confira se a imagem de espera combina com ele. |
| Pôster vazio | Envie a imagem de espera deste vídeo. |
| Link, destino vazio | Escolha para onde o link leva. |
| Endereço da loja de apps | Use um endereço que comece com https://. |
| Sem permissão | Seu acesso não permite editar o conteúdo do site. Peça ao responsável da loja. |
| Sessão expirada | Sua sessão expirou. Entre de novo. |
| Saída | Você tem alterações não publicadas neste bloco. Se sair, elas se perdem. |
| Remover item | Remover o cartão "[título]"? Ele sai do site quando você publicar. |
| Último item | A lista precisa de pelo menos um item. |
| Foto, formato | Formato não aceito. Envie JPEG, PNG ou WebP. |
| Foto, tamanho | Arquivo grande demais ([x] MB). O máximo é 4,5 MB. |
| Foto, falha | Não foi possível enviar a foto. Verifique a internet e tente de novo. |
| Campo vazio | Preencha este campo. |
| Histórico, autor | Conta removida / Conteúdo inicial |
| Erro ao abrir | Não foi possível abrir [o conteúdo / o histórico] agora. Tente de novo em instantes. O site continua no ar. |

---

## 9. Responsivo, motion e acessibilidade

**Responsivo (mobile primeiro; o painel também será usado no celular):**
- Base 360 px: coluna única, barra superior com "Menu", formulário em largura total com margem de 16 px, campos em coluna, botões da `BarraPublicar` em largura total, alvos ≥ 44 px, `font-size` ≥ 16 px nos campos.
- ≥ 768 px: barra lateral fixa de 240 px, conteúdo com largura máxima 720 px (formulário), grade de 2 colunas na lista de blocos; histórico em tabela.
- ≥ 1100 px: lista de blocos em 3 colunas.
- Sem rolagem horizontal em 320 px; testar com texto ampliado a 200 %.
- Exceção ao padrão "centralizar no celular" (preferência do dono, para páginas públicas): o painel é ferramenta de formulários e tabelas, que ficam alinhados à esquerda (exceção natural prevista). Registrado aqui.

**Motion (mínimo):**
- Transições de 150 ms (`ease-out`) só em cor/borda, expandir/recolher item (`opacity`, sem animar altura), aparecimento de `Aviso` (`opacity`).
- Spinner do botão.
- `prefers-reduced-motion: reduce`: sem transição nenhuma; spinner vira o texto "Publicando..." sem rotação.
- Nada de reveals, tilt ou parallax (identidade do site não se aplica a ferramenta interna).

**Acessibilidade (WCAG 2.2 AA, conferir na implementação):**
- Estrutura: `header`/`nav`/`main`; um `h1` por página; link "Pular para o conteúdo" como primeiro foco.
- Todo controle com `<label>` visível associado. Grupo de campos de um item de lista em `fieldset` + `legend` ("Cartão 2").
- Erros: texto + ícone + borda, ligados por `aria-describedby`; `aria-invalid`; sumário de erros com links e foco movido a ele ao tentar publicar.
- Foco visível 3 px `--cor-foco` com offset 2 px em tudo que é interativo; ordem de foco = ordem visual; modal com foco preso e retorno ao gatilho.
- Mensagens de estado: `role="status"` (publicado, pendente, enviando) e `role="alert"` (erro, conflito); não mover foco para `status`, mover foco para erros que exigem ação.
- Reordenação e adição anunciadas por `aria-live="polite"`.
- Cor nunca é a única pista (etiquetas com texto). Contraste de texto ≥ 4,5:1 e de componentes ≥ 3:1 (tokens acima).
- Alvo de toque ≥ 44 px (acima do mínimo de 24 px do WCAG 2.2).
- Imagens do formulário: miniatura com `alt` = nome do item ("Capa do plano Gold"), não o texto do site.
- Teclado: tudo operável sem mouse; nenhum atalho que dependa de arrastar.

---

## 10. Critérios de aceite visuais (para a revisão do `dev-uiux` depois da implementação)

1. A lista mostra os 9 blocos na ordem do site, cada um com resumo e última publicação; clique/teclado abre o bloco (CA-LOJ-50).
2. Cada um dos 12 blocos mostra exatamente os campos das seções 6.2 e 6.2b, nenhum a mais (CA-LOJ-50, 60, 66): nada de cor, animação, ordem de seção ou criar seção; o campo "Destino do botão" aparece só nos cartões da Loja. Tudo o que a 6.2c lista como fixo não tem campo.
2b. Vídeo e lista de links (6.7, 6.8): todos os estados e mensagens da tabela existem; destino de link só da lista fechada; o Publicar fica desabilitado durante envio.
3. Todas as mensagens da seção 8 existem com o texto da tabela (ajustes de texto só com o `copywriter`).
4. Contraste, foco e alvos conferidos com ferramenta; navegação completa só por teclado; teste em 360 px e 1280 px.
5. Cada estado da seção 7 reproduzido e capturado: salvando, publicado (com "Ver no site"), falha, rede, conflito (outro bloco e mesmo bloco), sem permissão, saída com edição, foto e vídeo recusados (formato e tamanho), vídeo enviando e cancelado, erro de validação.
6. Depois de uma falha ou conflito, o digitado continua na tela.
7. O botão Publicar é o único preenchido da tela de edição.
8. Com `prefers-reduced-motion`, nenhuma animação roda.

---

## 11. Perguntas abertas

1. ~~Destino do botão dos cartões da Loja~~: **decidido (2026-11-15): opção (a)**, "Página inicial da loja" como única escolha até existir catálogo.
2. ~~Ordem dos blocos~~: **conferida** no `index.html` da `main` (seção 5). A lista "O que inclui" dos planos exige pelo menos 1 item no `build.mjs` (`lista()`), igual às demais.
3. **Conflito que oferece "Publicar o meu bloco"** (7.5): o módulo consegue devolver à tela os blocos alterados desde a `versaoBase`? Se não, só "Carregar a versão atual" (com a tela mantida até o clique). Dono: `dev-react`.
4. **Fotos**: algum teto de largura/peso além dos 4,5 MB e redimensionamento no envio (`dev-performance-seo`)? Foto de 4 MB atrasa o LCP do site. Sem redimensionamento no MVP, a recomendação é só texto de ajuda.
5. **Texto alternativo** (6.4): hoje só os cartões da Loja têm "descrição da foto" editável; nos demais blocos com foto não há. Tornar editável é fora de escopo (spec); decidir se vira pedido futuro.
6. ~~Aviso de falha do build depois de "Publicado" (RISCO-16)~~: **deixou de existir** (ADR-0007: não há build ao publicar). Resta a dúvida de 7.6 (falha ao atualizar o site depois de gravar).
7. **Saída por sessão expirada** (7.8): restaurar o digitado após novo login ou só avisar. Dono: `dev-react` com `dev-auth`.
8. **Confirmação extra ao publicar**: este desenho publica com um clique (validação + histórico + sem desfazer). Se o cliente quiser confirmação ou desfazer, ligar a P-18.
9. **Texto de ajuda do campo "Enquadramento da imagem"**: usa o formato de posição CSS que existe hoje; se o cliente não souber usá-lo, vale pedir um seletor visual (escopo novo).

10. **Link externo no menu e no rodapé**: o CA-LOJ-65 só admite destinos da lista; se o dono quiser, por exemplo, um link para o Instagram, `arquiteto-specs` muda o CA e liga `permiteExterno` (6.8), só `https://`.
11. **Endereços das lojas de aplicativos**: em Geral (ADR-0007) ou em Baixe o app (spec 5.9)? Segui o ADR (6.2b).
12. **Planos: legendas "por mês", "para sempre", "cobrados por ano"** viram campos ou ficam fixas (6.2b).
13. **Mensagem de sucesso da newsletter** promete algo que o formulário não faz (PEND-09). Recomendo `lgpd-specialist` e `copywriter` decidirem antes do corte.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-11-15 | Primeira versão (tarefa 11, dev-uiux). |
| 1.1 | 2026-11-15 | ADR-0007 e spec v0.6: 12 blocos (novos `geral`, `videos`, `pagina-loja`), inventário dos campos novos (6.2b), o que fica fixo (6.2c), campo de vídeo (6.7), lista de links (6.8), grupos (6.9); publicar imediato (7.2, 7.3, 7.6, 7.7 e microcopy sem estados de disparo e pendente). Sessão no cabeçalho e `/loja` em `ui-site-sessao-e-loja.md`. |
