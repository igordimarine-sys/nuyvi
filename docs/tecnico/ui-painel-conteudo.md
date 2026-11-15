# Painel de conteúdo do site: especificação visual e de comportamento

Tarefa 11 do plano da [spec da loja](../specs/loja.md) (fase 1a). Requisitos: seção 5.9 (HU-12, HU-13, CA-LOJ-50 a 59), RN-LOJ-24 a 26, tela da 9.2. Decisão técnica: [ADR-0006](../adr/ADR-0006-conteudo-do-site-no-banco-da-loja-com-rebuild.md). Banco: [banco.md](banco.md) ("Conteúdo do site"). Fluxo de publicação: [arquitetura.md](arquitetura.md) seção 6. Quem implementa: `dev-react` em `admin/` (CSS próprio, sem biblioteca de UI nova).

Ferramenta interna: prioridade é clareza e segurança ao publicar. Sem animação decorativa. Movimento só funcional (seção 9).

Premissas herdadas: P-15 (só admin edita), P-16 (site atualiza em até 5 min), P-17 (sem prévia nem rascunho: publicar direto), P-18 (sem botão "desfazer"; corrige-se editando de novo). Se alguma mudar, esta spec muda junto.

---

## 1. Decisão: edição e publicação por bloco

**Cada bloco é editado e publicado sozinho.** Não há "publicar tudo".

Por quê:
- O banco já grava `blocos_alterados` (1 a 9) e o módulo monta a versão nova como "última publicada + o bloco editado". Publicar por bloco é o caminho natural; publicar vários de uma vez exigiria rascunho multi-bloco (P-17 diz que não há rascunho).
- Reduz o dano de um erro: publicar "História" não pode quebrar "Planos".
- Histórico legível (CA-LOJ-57): "quem mudou qual bloco".
- Conflito de versão (seção 7.5) fica pequeno: só importa se alguém mexeu no mesmo bloco.
- Custo: quem quer mudar 3 blocos publica 3 vezes e espera 3 builds possíveis. Aceito: o disparo em sequência é seguro (uma pendente por vez, seção 7.6) e a mudança é rara.

Não existe rascunho salvo no servidor. O que foi digitado e não publicado só vive na tela (a saída avisa, seção 7.9).

---

## 2. Mapa de telas e navegação

Rotas sugeridas (nome final é do `dev-react`):

```
/admin                        Início do painel (hoje existe, página simples)
/admin/conteudo               Lista dos 9 blocos  (+ resumo da última publicação)
/admin/conteudo/[bloco]       Edição de um bloco
/admin/conteudo/historico     Histórico de publicações
```

Slugs dos blocos = os do banco: `abertura, parceiros, planos, bonus, historia, explore, loja, novidades, baixar`.

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
- Usuário sem login vai para `/entrar` (já existe) e volta ao destino depois.
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

`ListaEditavel`, `CampoFoto` e `BarraPublicar` não conhecem os 9 blocos: cada bloco é só uma configuração de campos. Evita nove telas escritas à mão.

---

## 5. Lista de blocos (`/admin/conteudo`) — CA-LOJ-50

Objetivo: mostrar os 9 blocos e a situação do site num relance, e levar ao bloco certo.

Topo: título "Conteúdo do site" e, abaixo, o resumo da última publicação: "Última publicação: 14/11/2026 às 16:32, por Ana (Planos e preços)". Link "Ver histórico". Se existir publicação pendente, `Aviso` de tipo informação (seção 7.6) acima da lista.

Lista dos 9 blocos, **na ordem em que aparecem no site** (conferida no `site/index.html` da `main` em 2026-11-15): Abertura, Rede de parceiros (abertura), Planos e preços, Bônus do plano anual, História, Explore (cartões), Loja (cartões), Baixe o app, Novidades.

Cada `CartaoBloco` mostra:
- Nome do bloco (título).
- Uma linha de resumo do que há dentro, calculada dos dados publicados, sem inventar campo: ex.: "4 planos", "4 cartões", "3 notícias", "2 cartões"; os de texto simples mostram o primeiro texto cortado (a frase da Abertura, o título da História).
- Quando foi publicado pela última vez e por quem (a partir do histórico, por `blocos_alterados`); versão 1 da migração: "Conteúdo inicial".
- Botão "Editar" (secundário) que é o próprio cartão clicável; o cartão inteiro é um único link para o bloco (um só alvo de foco por cartão).

Layout:
- Celular: um cartão por linha, largura total. **Exceção registrada ao padrão de centralizar no celular:** esta é uma lista de itens de trabalho e a edição é formulário; fica alinhada à esquerda para leitura (a preferência de centralizar vale para páginas públicas, não para ferramenta interna). Cartões empilhados, 12 px entre eles.
- A partir de 768px: grade de 2 colunas; a partir de 1100px: 3 colunas.

Estados da tela:
- Carregando: esqueleto cinza dos 9 cartões (ou "Carregando..." no `Suspense`).
- Erro ao carregar (banco fora): `Aviso` erro "Não foi possível abrir o conteúdo agora. Tente de novo em instantes." + botão "Tentar de novo". O site público não é afetado (RNF-14); dizer isso: "O site continua no ar."
- Sem permissão: seção 7.8.
- Vazio: não existe (a versão 1 traz os 9 blocos). Se vier sem nenhuma versão publicada, `Aviso` erro "O conteúdo inicial ainda não foi carregado. Avise o responsável técnico."

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

Só o que existe hoje (inventário 5.9). Rótulos de interface em PT-BR, com o nome do campo no site como dica quando ajudar. **Obrigatório** = tudo, exceto o marcado "opcional" (CA-LOJ-52; o `build.mjs` já recusa texto vazio e lista vazia).

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
- **Publicar fica desabilitado** quando: não há alteração, há foto enviando, há publicação pendente de outra pessoa, ou durante o envio. Botão desabilitado explica o motivo no texto ao lado (não deixar mudo): ex.: "Nenhuma alteração para publicar."
- Rótulo do botão traz o contexto: "Publicar Planos e preços". Clique abre **uma confirmação curta**? **Não**: confirmação em todo clique vira hábito e é ignorada; a salvaguarda é a validação + histórico + aviso de que a mudança vai ao ar. O texto ao lado do botão, na situação "Alterações não publicadas", já avisa: "Ao publicar, o site mostra essa mudança em até alguns minutos." `[Sem desfazer (P-18): se o cliente quiser confirmação extra, registrar como decisão.]`
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

---

## 7. Estados do fluxo de publicação (seção 9.2 da spec)

Resumo: **toda resposta é anunciada na `BarraPublicar` e, quando exige ação, em um `Aviso` no topo do formulário.** A edição digitada nunca é apagada por erro.

### 7.1 Salvando / publicando
- Botão vira "Publicando..." com spinner, `aria-busy="true"`, desabilitado; todos os campos ficam somente leitura (evita editar durante o envio).
- Região `role="status"`: "Publicando Planos e preços...".
- Se passar de 10 s: acrescenta "Isso está demorando mais que o normal. Não feche esta página." (o hook tem timeout curto; deve responder logo).

### 7.2 Publicado (sucesso) — RISCO-16
Mostrado quando o disparo foi **aceito** (o site ainda não atualizou: o build leva alguns minutos). Não dizer "o site foi atualizado".

`Aviso` sucesso (`role="status"`), título: **"Publicado."**
Texto: "O site mostra a mudança em até alguns minutos (normalmente até 5). Se não mudar depois disso, avise o responsável técnico."
- Ações: "Voltar à lista de blocos" e "Continuar editando" (os dois como link, sem botão primário no aviso).
- Formulário continua com os valores publicados; situação volta a "Nenhuma alteração"; guarda o novo `versaoBase`.
- Honesto sobre o limite: o painel sabe que o pedido foi aceito, não que o build acabou. Se o build falhar depois, só aparece na notificação da Vercel (RISCO-16). Para a pessoa, o texto acima ("se não mudar, avise") é o único recurso; quem recebe o aviso de falha de deploy é `[PENDENTE: dev-devops]`.
- Na lista de blocos e no histórico, a publicação aparece como "Publicado".

### 7.3 Falha do disparo, edição preservada — CA-LOJ-55
`Aviso` erro (`role="alert"`, foco no aviso): **"Não foi possível publicar, tente de novo."**
Texto: "O site continua como estava; nada foi alterado. O que você digitou está aqui, nada foi perdido."
- Ação: botão "Tentar de novo" (primário) no próprio aviso; o botão Publicar da barra também volta a funcionar.
- Os campos mantêm o digitado, **inclusive fotos já enviadas**. O módulo devolve o novo `versaoBase` (número da versão `falhou`; banco.md) e a tela passa a usá-lo; a pessoa não percebe nada disso.
- Se falhar de novo repetidamente: depois da 2ª falha seguida, acrescenta "Se continuar, avise o responsável técnico." (sem expor motivo técnico, nunca a URL do hook).
- Na lista de histórico, a tentativa que falhou aparece com "Não chegou ao site" (7.7).

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

### 7.6 Publicação pendente em curso (uma por vez)
Existe versão com disparo `pendente` (a minha ou de outra pessoa). Dois casos:

- **Ao abrir a página** (ou na lista): `Aviso` informação (`role="status"`): "Há uma publicação em andamento. Aguarde alguns instantes para publicar." Botão Publicar desabilitado, com o motivo na barra. A tela consulta de novo sozinha **a cada 5 s por até 2 min** e, quando liberar, tira o aviso e reabilita o botão (sem recarregar a página, sem apagar o digitado). Depois de ~2 min a versão pendente expira sozinha (banco.md) e libera.
- **Ao clicar Publicar** e receber a restrição de uma pendente (`uma_pendente_uk`): `Aviso` informação: "Há uma publicação em andamento. Tente de novo em instantes." + botão "Tentar de novo" habilitado após 5 s. A edição é mantida.

### 7.7 Histórico de publicações (`/admin/conteudo/historico`) — CA-LOJ-57
Tabela no desktop, lista de cartões no celular. Colunas: **Data e hora** (fuso de Brasília, formato "14/11/2026 16:32"), **Quem publicou**, **Bloco** (nome em português, um ou mais), **Situação**.
- Quem publicou: o nome da conta. Se a conta foi removida: **"Conta removida"** (texto cinza, não é erro). Versão inicial da migração (`origem = migracao`): **"Conteúdo inicial"** como autor e bloco "Todos os blocos".
- Situação: "Publicado" (aceito), "Não chegou ao site" (falhou; com ajuda "O pedido de publicação falhou e o site não mudou."), "Em publicação" (pendente). Etiqueta com texto, não só cor. Mostrar o `disparo_erro` ao usuário **não**: é técnico; fica só para o responsável técnico. As tentativas que falharam ficam visíveis porque ajudam a entender "por que o site não mudou" (decisão pedida em banco.md sobre filtrar; mostrar tudo, com a etiqueta).
- Mais novo primeiro; 50 por página, botão "Ver mais antigas" (paginação por número, banco.md consulta 5).
- Sem conteúdo da versão (a consulta nem traz `conteudo`): o histórico só diz quem, quando e qual bloco. "Ver o que mudou" e restaurar versão **não** estão no escopo (P-18). Dizer isso ao dono no resumo.
- Vazio: "Ainda não há publicações." (na prática nunca, por causa da versão 1.)
- Erro ao carregar: "Não foi possível abrir o histórico. Tente de novo." + botão.

### 7.8 Sem permissão — CA-LOJ-56
Tela dentro da casca, `role` normal (h1): **"Sem permissão"**. Texto: "Seu acesso não permite editar o conteúdo do site. Peça ao responsável da loja." Link "Voltar ao início". Nenhum dado do conteúdo é enviado ao navegador. Quando a tentativa é uma ação de publicar (por qualquer caminho), a resposta é a mesma mensagem e nada é alterado. Operador: o item sequer aparece no menu (seção 2).
Sessão expirada (não é falta de permissão): "Sua sessão expirou. Entre de novo." com link para `/entrar`; **a edição digitada não se perde só pelo redirecionamento** `[o dev-react decide: guardar no navegador (sessionStorage) por conta e restaurar após o login, ou avisar antes]`; no mínimo, a tela de sessão expirada deve aparecer sem apagar o formulário e permitir reentrar numa nova aba.

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
| Situação, com mudança | Alterações não publicadas. Ao publicar, o site mostra a mudança em até alguns minutos. |
| Botão | Publicar Planos e preços |
| Publicando | Publicando... |
| Publicado | Publicado. O site mostra a mudança em até alguns minutos (normalmente até 5). Se não mudar depois disso, avise o responsável técnico. |
| Falha | Não foi possível publicar, tente de novo. O site continua como estava. O que você digitou está aqui, nada foi perdido. |
| Falha repetida | Se continuar, avise o responsável técnico. |
| Sem internet | Sem conexão. Verifique a internet e tente de novo. |
| Erro de validação (topo) | Não publicado. Corrija N campos abaixo. O site continua como estava. |
| Conflito | Outra pessoa publicou enquanto você editava. |
| Conflito, outro bloco | A outra publicação mudou "[bloco]". O bloco que você está editando não foi alterado. |
| Conflito, mesmo bloco | A outra publicação mudou este bloco. |
| Confirma carregar atual | Isso troca o que você digitou pela versão atual. Quer continuar? |
| Pendente | Há uma publicação em andamento. Aguarde alguns instantes para publicar. |
| Pendente ao clicar | Há uma publicação em andamento. Tente de novo em instantes. |
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
| Histórico, falha | Não chegou ao site |
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
2. Cada bloco mostra exatamente os campos da seção 6.2, nenhum a mais (CA-LOJ-50); o campo "Destino do botão" aparece só nos cartões da Loja.
3. Todas as mensagens da seção 8 existem com o texto da tabela (ajustes de texto só com o `copywriter`).
4. Contraste, foco e alvos conferidos com ferramenta; navegação completa só por teclado; teste em 360 px e 1280 px.
5. Cada estado da seção 7 reproduzido e capturado: salvando, publicado, falha, rede, conflito (outro bloco e mesmo bloco), pendente, sem permissão, saída com edição, foto recusada (formato e tamanho), erro de validação.
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
6. **Aviso de falha do build depois de "Publicado"** (RISCO-16): sem retorno no painel; quem recebe o aviso da Vercel e como o editor é avisado (`dev-devops`).
7. **Saída por sessão expirada** (7.8): restaurar o digitado após novo login ou só avisar. Dono: `dev-react` com `dev-auth`.
8. **Confirmação extra ao publicar**: este desenho publica com um clique (validação + histórico + sem desfazer). Se o cliente quiser confirmação ou desfazer, ligar a P-18.
9. **Texto de ajuda do campo "Enquadramento da imagem"**: usa o formato de posição CSS que existe hoje; se o cliente não souber usá-lo, vale pedir um seletor visual (escopo novo).

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-11-15 | Primeira versão (tarefa 11, dev-uiux). |
