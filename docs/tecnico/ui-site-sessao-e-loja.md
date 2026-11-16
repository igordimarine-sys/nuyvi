# Site público: cabeçalho com sessão e página `/loja`

Especificação visual e de comportamento. Requisitos: [spec da loja](../specs/loja.md) v0.6 (CA-LOJ-67 a 80, RN-LOJ-28 a 30, PREM-15/16, seção 9.2; tarefas 18 e 19). Decisão técnica: [ADR-0007](../adr/ADR-0007-site-e-painel-num-unico-app-next.md), adendos A2 (sessão) e A3 (`/loja`). Campos editáveis desses textos: [ui-painel-conteudo.md](ui-painel-conteudo.md) seção 6.2b (blocos `geral` e `pagina-loja`). Quem implementa: `dev-react` (HTML e CSS do template, `public/js/conta.js`). Classes citadas são as do `<style>` de `admin/src/site/index.html`; "nova" = não existe hoje.

Identidade, tokens, tipografia e movimento são os do site (`:root` do template: `--preto`, `--branco`, `--nevoa`, `--laranja`, `--por-do-sol`, `--lado`, `--mov-*`; Archivo e Manrope). Nada de token novo.

---

## Parte A. Cabeçalho com sessão (A2, CA-LOJ-68 a 73)

### A.1 Princípio

`/` e `/loja` continuam iguais para todo mundo (em cache, sem cookie). O HTML sai **sempre no estado visitante**; o navegador pergunta a sessão depois e troca o grupo de conta. Falha na pergunta = visitante (RN-LOJ-28): a página nunca fica pior por causa disso.

### A.2 Estrutura (descrição neutra, sem código)

Dentro de `.topo .acoes`, depois do botão "Baixar", entra um grupo **`conta`** (nova, `data-conta`, `role="group"`, nome acessível "Conta", texto fixo só para leitor de tela). Ele tem:
1. O **botão de entrar** que já existe (`.bt .bt-claro`, `data-login`, com `.rot-longo` e `.rot-curto`), agora com destino `/login`. O texto longo e o curto vêm do bloco Geral; o `aria-label` é o texto longo (o curto "Entrar" está contido nele: o nome acessível contém o texto visível, WCAG 2.5.3).
2. Um fragmento **logado**, escondido no HTML (`hidden`), sem dado de ninguém: botão de conta (`.conta-toggle`, nova; usa a forma do `.pausa`: círculo de 44 px), painel (`.conta-painel`, nova) com o nome (`.conta-nome`, nova), o link "Painel" (`.bt .bt-claro`, `data-painel`, destino `/admin`) e o botão "Sair" (`.bt .bt-linha`, `data-sair`).
3. Uma região `role="status"` só para leitor de tela (`data-conta-aviso`) e um aviso de erro de saída (`.conta-erro`, nova, `role="alert"`).

O botão "Entrar na NUY" da **abertura** (hero, `data-login`) segue o mesmo estado (ver A.4).

### A.3 Estados

`data-estado` no grupo (e `data-sessao` no `<html>`, para o CSS do hero) assume um destes valores:

| Estado | Quando | O que aparece |
|---|---|---|
| **carregando** | HTML inicial, até a resposta (ou 1,2 s) | O botão de entrar ocupa o lugar dele, mas com `visibility: hidden`. Nada de "Entrar" piscando para quem está conectado, e nenhum espaço extra |
| **visitante** | Sem sessão, erro, rede fora, resposta inesperada ou passou de 1,2 s | "Entrar na NUY" (curto "Entrar" abaixo de 480 px). `href` = `/login?volta=<caminho atual>`; na página `/` o `volta` é omitido (o padrão já é `/`, CA-LOJ-75) |
| **cliente** | Sessão com papel diferente de `operador` e `admin` | Nome + "Sair". Nem "Painel" nem "Entrar" (o nó "Painel" é **removido** do DOM, não só escondido) |
| **equipe** | `role` = `operador` ou `admin` | Nome + "Painel" + "Sair" |

Resolução: o script chama `GET /api/auth/get-session` (`credentials: same-origin`, `cache: no-store`, tempo limite de 3 s). Se a resposta chegar depois de 1,2 s, o botão de entrar já foi mostrado e é trocado quando ela chegar (raro). O script também pergunta de novo quando a página volta do histórico (`pageshow` com `persisted`) e quando a aba volta a ficar visível (`visibilitychange`), para não mostrar nome que já saiu.

**Privacidade (CA-LOJ-72, RISCO-18):** o nome entra com `textContent`, nunca `innerHTML`; não é guardado em `localStorage`, `sessionStorage` nem cookie; o HTML em cache nunca o contém. Nome vazio: o texto fixo "Minha conta".

### A.4 Aparência por largura

**Visitante: igual ao de hoje em todas as larguras.** Só muda o destino.

**Cliente e equipe:**

| Largura | Forma |
|---|---|
| **≥ 1280 px** | Em linha: nome (`.conta-nome`: 14 px, peso 600, cor `--branco`, no máximo 12 caracteres de largura com reticências e `title` com o nome inteiro) + "Painel" (`.bt-claro`, só equipe) + "Sair" (`.bt-linha`). Altura 44 px, como os outros botões do `.topo` |
| **< 1280 px** | Um só botão de conta, círculo de 44 px com a **inicial do nome** (Archivo 900, maiúscula, `--branco` sobre borda `rgba(255,255,255,.2)`), nome acessível "Conta de <nome>", `aria-expanded`, `aria-controls`. Abre o painel abaixo do cabeçalho, alinhado à direita: fundo `rgba(17,21,23,.96)`, borda `rgba(255,255,255,.12)`, raio 1rem, padding .5rem, largura mínima 14rem e máxima `100vw - 2 × --lado`. Dentro, empilhados com 8 px: nome (14 px, `--nevoa`, pode quebrar em 2 linhas), "Painel" (equipe) e "Sair", os dois em largura total e 44 px de altura |

Por que 1280 e não 1024: com o menu de 5 itens (visível a partir de 1024 px), nome + "Painel" + "Sair" + "Baixar" + pausa não cabem na linha entre 1024 e 1279 px. Cálculo à mão, **não medido**: o `dev-react` confere em 320, 360, 768, 1024, 1279 e 1280 px, e com os textos mais longos permitidos (20 caracteres).

Painel (comportamento): abre e fecha pelo botão; **Esc** fecha e devolve o foco ao botão; clicar fora, tirar o foco de dentro dele ou rolar a página também fecha. Sem prender o foco (não é janela modal). Entrada com `opacity` e `transform` em 200 ms `--mov-entra`; com `prefers-reduced-motion: reduce`, sem transição. O cabeçalho que recolhe ao rolar não recolhe enquanto o foco está dentro dele (regra que já existe em `.topo.recolhido:not(:focus-within)`).

**Botão da abertura** (`.hero .botoes [data-login]`): em `carregando`, `visibility: hidden`; `visitante`, visível; `cliente` e `equipe`, `display: none` (o cabeçalho já mostra a conta e o botão de entrar não faz sentido). Sobra só "Baixar o app", centralizado: único reposicionamento, uma vez, antes do usuário interagir (o hero anima a entrada dos itens).

### A.5 Sair (CA-LOJ-71)

- Toque em "Sair": o botão fica `aria-disabled` e a 60% de opacidade; chama a saída do Better Auth; **a pessoa continua na mesma página**.
- Sucesso: estado vira `visitante` sem recarregar; o leitor de tela ouve "Você saiu." (região `status`); o **foco vai para o botão "Entrar"** (o botão que estava focado deixou de existir).
- Falha (rede ou erro): o botão volta ao normal e aparece, abaixo do grupo, `.conta-erro` (`role="alert"`, fundo `--vinho`, texto `--branco`, 14 px, some em 6 s): "Não foi possível sair. Tente de novo." Resposta 401 (sessão já expirada) conta como sucesso.
- Abrir `/admin` depois disso leva a `/login` (CA-LOJ-73, regra do servidor, nada a fazer aqui).

### A.6 Acessibilidade

- Alvos de 44 px (botão de conta, "Painel", "Sair", "Entrar"). Foco visível: o `:focus-visible` do site (2 px `--ciano`).
- Ordem de foco: logo, menu, pausa, Baixar, conta (botão de conta, depois painel).
- Contraste: texto `--branco` sobre o fundo escuro do cabeçalho e do painel (acima de 15:1, estimado); `--nevoa` sobre `rgba(17,21,23,.96)` acima de 7:1 (estimado). Conferir com ferramenta.
- Texto só para leitor de tela (fixo, PREM-15): "Conta" (grupo), "Conectado como " (antes do nome), "Conta de " (botão), "Você saiu.". Texto visível fixo de erro: "Não foi possível sair. Tente de novo." e "Minha conta" (exceções ao CA-LOJ-60 a registrar na spec).
- Estado `carregando` **não é anunciado** (evita ruído a cada página). Só a saída é anunciada.
- O botão de conta usa `aria-expanded`; o painel não é `role="menu"` (são só um texto e dois controles comuns; `menu` exigiria setas e traria mais atrito).
- Sem nada importante só no `hover`. Sem dependência de JavaScript para o essencial: com o script bloqueado, fica o botão de entrar (visitante), que funciona como link (o `visibility: hidden` só vale com `html.js`, como `.js` do template).

### A.7 Layout shift

O cabeçalho é `position: fixed`, fora do fluxo: a conta **não empurra** o conteúdo da página. O que se mexe, uma vez, só para quem está conectado: a largura do grupo `conta` muda e, a partir de 1024 px, o menu desloca-se alguns pixels (ele fica entre a logo e as ações). Medir o CLS real no passo de verificação (`dev-performance-seo`); meta: contribuição desprezível. Melhoria posterior, se incomodar: um cookie-sinalizador **sem dado pessoal** (`tem sessão`, legível pelo navegador) lido por um script mínimo no `<head>` define o estado antes da primeira pintura; só o nome vem depois. Exige mudança do `dev-auth`; **não faz parte desta entrega**.

### A.8 Textos (de onde vêm)

| Texto | Origem |
|---|---|
| Entrar na NUY / Entrar (cabeçalho), Sair, Painel | bloco Geral > Cabeçalho |
| Entrar na NUY (abertura) | bloco Abertura |
| "Conectado como", "Conta de", "Você saiu.", "Conta", "Minha conta", "Não foi possível sair. Tente de novo." | fixos (A.6) |

**Para o `copywriter` (tarefa 22):** "Entrar na NUY" sugere a conta do **aplicativo**, e o login do site é a conta da **loja** (RISCO-10). Alternativas a avaliar: "Entrar", "Minha conta", "Entrar na loja". O valor inicial segue o atual até a decisão.

---

## Parte B. Página `/loja` (A3, CA-LOJ-67, 78 a 80)

### B.1 Objetivo e escopo

Vitrine simples: quem chega vê os produtos à venda, **sem carrinho, sem checkout e sem página de produto nesta entrega** (RN-LOJ-30, PREM-16). Mesma identidade do site (fundo `--fundo`, Archivo e Manrope, cor de destaque `--laranja`). Uma só ação principal da página: nenhuma; a navegação é a do cabeçalho.

### B.2 Estrutura

Mesmo cabeçalho e rodapé de `/`, **do mesmo gerador** (uma função de bloco usada pelos dois templates, para não divergirem; ver "Para o `dev-react`").

1. **Cabeçalho** (`.topo`): igual ao de `/`, com 3 diferenças: (a) **sem** botão de pausa (a página não tem animação contínua); (b) os destinos de seção viram `/#videos`, `/#premium` etc. (o valor guardado continua `#videos`; quem monta prefixa `/` nesta página); "Baixar" leva a `/#baixar`; a logo leva a `/`; (c) o item do menu cujo destino é `/loja` recebe `aria-current="page"` e a cor `--branco`. O cabeçalho **não recolhe** ao rolar (fica fixo). O grupo `conta` da Parte A funciona igual.
2. **Título** (`.secao-loja`, nova): `.rotulo` (rótulo) e `h1.t-medio` em duas `.t-linha` (a segunda com `.vazado`), mais `p.texto` (abertura). Sem as animações de entrada do site: aparece pronto.
3. **Produtos**: `h2` só para leitor de tela ("Produtos", `.sr-only`, texto fixo), depois a grade (B.3). Sem produto: o estado vazio (B.4).
4. **Rodapé** (`.rodape`): igual ao de `/`, com `/` na frente das âncoras e caminhos absolutos para as páginas legais.

Não leva: fibras de fundo, GSAP, Lenis, `ghost-fibers.js`. Leva só `conta.js` e o script do formulário de novidades (ver "Para o `dev-react`"). A página abre mais leve e o movimento fica por conta do CSS (nenhum além do já existente).

### B.3 Grade de produtos (CA-LOJ-78, RN-LOJ-30)

`ul.loja.loja-grade` (`role="list"`) com um `li` por produto ativo, cada um um `article.produto.produto-estatico`. Reaproveita `.loja`, `.produto`, `.foto`, `.info`, `.rotulo`, `h3`.

| Largura | Colunas | Observação |
|---|---|---|
| < 640 px | 1 | cartão de largura total, 16 px de respiro lateral (`--lado`), 16 px entre cartões |
| ≥ 640 px | 2, 3 ou 4 conforme a largura | `repeat(auto-fill, minmax(min(100%, 17rem), 1fr))`: o número de colunas se ajusta sozinho, sem ponto de quebra por coluna |

Conteúdo do cartão, de cima para baixo (tudo vem do catálogo, nunca do conteúdo do site, RN-LOJ-18):

| Elemento | Marcação e estilo | Regra |
|---|---|---|
| Foto | `.foto` (5/4, `object-fit: cover`) com `img`; `alt=""` (o nome está ao lado); `width` e `height` ou `aspect-ratio` para não saltar; as 2 primeiras sem `loading="lazy"`, as demais com | primeira foto pela ordem do catálogo. Se as fotos reais tiverem fundo branco ou o produto for cortado, trocar para `object-fit: contain` com respiro de 6% (como `.cartao .contida`); decidir com fotos reais |
| "Esgotado" | `.etiqueta-esgotado` (nova), no canto superior esquerdo da foto: pílula 12 px, borda `rgba(255,255,255,.35)`, fundo `rgba(7,9,10,.8)`, texto `--branco`, maiúsculas com espaçamento. A foto fica a 55% de opacidade (`.produto-esgotado`, nova) | só se **todas** as variações ativas estão sem estoque (RN-LOJ-30). O estado nunca é só a cor ou a opacidade: tem a palavra. O texto vem de `pagina-loja` |
| Categoria | `.rotulo` dentro de `.info`, sem margem inferior | nome da categoria do catálogo |
| Nome | `h3` (estilo existente do `.produto h3`) | nome do produto |
| Preço | `p.preco-produto` (nova): Archivo 900, `clamp(1.1rem, 2vw, 1.4rem)`, `--branco`. Se os preços diferem, antes dele `<small>a partir de</small>` (Manrope 600, `--nevoa`, como `.destaque .preco small`) | menor preço entre as variações **ativas**, formato "R$ 199,90"; sem "a partir de" quando todas custam o mesmo. Produto esgotado mostra o preço normalmente |

O cartão **não é link** (não há página de produto): `.produto-estatico` neutraliza a ampliação da foto no `:hover` e o cursor de clique que o `.produto` tem. Quando a página de produto existir (fase 1b), o cartão volta a ser `<a>` e a classe sai. Sem botão, sem "comprar", sem ícone de carrinho.

Ordem dos produtos: a da lista do catálogo `[a definir com o dev-react e o dono: sem ordenação escolhida na spec]`. Sem paginação nesta entrega; se passar de uns 48 produtos, rever.

### B.4 Estados

| Estado | Visual e texto |
|---|---|
| **Com produtos** | B.3 |
| **Sem produto ativo** (CA-LOJ-79) | No lugar da grade, `.loja-vazio` (nova): superfície arredondada 1.25rem com o mesmo degradê do `.produto` (`linear-gradient(160deg,#1b1114,#111517 60%)`), padding `clamp(2rem, 6vw, 4rem)`, texto centralizado. Dentro, `p.loja-vazio-texto` (nova: Archivo 900 maiúsculas, `clamp(1.5rem, 5vw, 2.5rem)`, classe `.sol` para o degradê) com o **texto do estado vazio** (valor inicial "Em breve"). Sem botão, sem erro, sem ícone |
| **Carregando** | Não existe: a página é pré-renderizada. As fotos reservam o espaço (`aspect-ratio`) sobre o fundo radial laranja do `.foto`, sem salto |
| **Erro ou banco fora** | Pelo ADR-0007 o erro **não é capturado** na página: quem visita recebe a página de erro do app (PEND-08) ou a versão anterior em cache. **Se** o `dev-react` capturar o erro dentro da página, usar `.loja-vazio` com `role="alert"` e o texto fixo "Não foi possível mostrar os produtos agora. Tente de novo em instantes." mais um link "Tentar de novo" (recarrega). Decidir no passo de verificação do ADR |
| **Sessão** | Mesmos quatro estados da Parte A |

### B.5 Alinhamento e responsivo

- Mobile primeiro (base 360 px). O bloco de título (rótulo, título, abertura) e o estado vazio ficam **centralizados abaixo de 768 px** (preferência do dono para telas novas) e à **esquerda de 768 px em diante** (como as seções do site). Decisão deliberada: as seções existentes do site são alinhadas à esquerda no celular, e `/loja` fica centralizada no bloco de título. Se o dono preferir a mesma linha do site, é só retirar o `text-align: center`. Registrar.
- O interior do cartão de produto fica **à esquerda** (exceção natural: cartão com informação em lista, como o `.produto` do site).
- Espaço acima do título: `.secao-loja` tem `padding-top: clamp(7rem, 14vw, 10rem)` (o `.secao` normal tem 4 rem, que fica **sob** o cabeçalho fixo de ~74 px). Abaixo da grade, o `.secao` já dá `clamp(4rem, 10vw, 8rem)` antes do rodapé.
- Sem rolagem horizontal em 320 px; testar com texto a 200%. O fundo ganha um brilho suave no topo (`radial-gradient` laranja a 14% no `.secao-loja::before`, atrás do título), sem animação.

### B.6 Acessibilidade

- Um `h1` (título); `h2` "Produtos" (só leitor de tela); `h3` por produto. Lista real (`ul`/`li`, com `role="list"`, porque o estilo remove os marcadores).
- `main` com `id="conteudo"` e o link "Pular para o conteúdo" como primeiro foco, como em `/`.
- Foto decorativa (`alt=""`): o nome do produto está no `h3` do mesmo cartão. Se o catálogo tiver "descrição da foto", usá-la.
- Preço lido naturalmente: "a partir de R$ 199,90". "Esgotado" é texto real, lido junto do cartão.
- Contraste: `--laranja` (categoria) sobre `#111517` perto de 7:1; `--nevoa` sobre `#111517` perto de 8:1 (estimados). Conferir com ferramenta.
- Movimento: nenhum além de transições de cor já existentes; com `prefers-reduced-motion`, nada.

### B.7 Textos (de onde vêm)

| Texto | Origem |
|---|---|
| `<title>` e descrição | bloco Página da loja |
| Rótulo, título (2 linhas), abertura, estado vazio, "a partir de", "Esgotado" | bloco Página da loja |
| Nome, categoria, preço, foto | catálogo (`modules/catalogo/vitrine.ts`), nunca o conteúdo do site |
| "Produtos" (sr-only), erro de saída, textos de sessão | fixos (A.6) |
| Cabeçalho, rodapé e menu | bloco Geral (os mesmos de `/`) |

**Para o `copywriter` (tarefa 22):** título, abertura, "Em breve", "a partir de" e "Esgotado" (valores iniciais **provisórios** no painel, ver 6.2b). O botão "Entrar na NUY" (A.8). A mensagem de sucesso da newsletter, que hoje promete algo que o formulário não faz (PEND-09).

### B.8 Classes novas (resumo)

Em CSS compartilhado com `/` (ver abaixo): `.secao-loja`, `.loja-grade`, `.produto-estatico`, `.produto-esgotado`, `.etiqueta-esgotado`, `.preco-produto`, `.loja-vazio`, `.loja-vazio-texto`, `.conta`, `.conta-toggle`, `.conta-painel`, `.conta-nome`, `.conta-erro`. **Reaproveitadas sem mudança:** `.topo`, `.marca`, `.slogan`, `.bt`, `.bt-claro`, `.bt-linha`, `.bt-baixar`, `.rot-longo`, `.rot-curto`, `.pausa` (forma do botão de conta), `.pular`, `.sr-only`, `.secao`, `.rotulo`, `.t-medio`, `.t-linha`, `.vazado`, `.sol`, `.texto`, `.loja`, `.produto`, `.foto`, `.info`, `.rodape` e filhas, `.lojas-app`.

### B.9 Para o `dev-react`

- **CSS em um só lugar**: tokens, reset, tipografia, `.bt`, `.topo`, `.rodape`, `.secao`, `.rotulo`, títulos, `.produto` e as classes novas passam do `<style>` de `index.html` para um arquivo compartilhado (por exemplo `public/css/site-base.css`) usado por `/` e `/loja`; o CSS que só existe na home (abertura, carrosséis, planos) continua nela. O `public/css/estilos.css` que existe hoje é um build Tailwind das versões antigas e **não serve** a este fim. Como equilibrar CSS embutido (primeira pintura) e arquivo é decisão sua com o `dev-performance-seo`.
- **Cabeçalho e rodapé de uma função só**, usada pelos dois templates (sem pausa e com `/#` na `/loja`).
- **Formulário de novidades**: o script que hoje é inline em `index.html` passa para um arquivo (por exemplo `public/js/news.js`) lido pelas duas páginas, com as mensagens (sucesso, e-mail inválido) vindas de atributos `data-` gerados por `montar` a partir do bloco Geral.
- `conta.js`: o contrato de A.2 a A.5 (estados, `volta`, foco ao sair, `pageshow`, `visibilitychange`, `textContent`). A forma exata de chamar a saída do Better Auth e a leitura de `user.role` é sua.
- O `volta` é validado **no servidor** (A2 do ADR); o script só monta o endereço.

---

## Critérios de aceite visuais (revisão do `dev-uiux`)

1. Visitante, cliente e equipe em `/` e em `/loja`, em 360, 768, 1024 e 1280 px: cada estado da tabela A.3 e a forma de A.4 (CA-LOJ-68 a 70). Nome nunca aparece para visitante (CA-LOJ-72).
2. Em `carregando` nada pisca: o botão "Entrar" não aparece para quem está conectado.
3. "Sair" mantém a página, devolve o foco ao "Entrar" e anuncia "Você saiu." (CA-LOJ-71); falha mostra o aviso de A.5.
4. Painel de conta: Esc, clique fora e rolar fecham; foco devolvido; sem salto da página; sem animação com `prefers-reduced-motion`.
5. `/loja` usa o mesmo cabeçalho, rodapé, fontes e cores do site; sem carrinho nem botão de compra (CA-LOJ-78, 80).
6. Produto com preços diferentes mostra "a partir de" + o menor; com preço único, só o preço; esgotado mostra a etiqueta e o preço (RN-LOJ-30).
7. Sem produto: só o texto do painel, sem erro (CA-LOJ-79). Mudar os textos no bloco Página da loja e publicar muda `/loja` (CA-LOJ-67).
8. Contraste e foco conferidos com ferramenta; navegação só por teclado; sem rolagem horizontal em 320 px.

## Perguntas abertas

1. Alinhamento do título de `/loja` no celular: centralizado (preferência do dono) ou à esquerda como o site (B.5).
2. Ordem dos produtos na vitrine (B.3).
3. Erro da vitrine dentro da página, ou a página de erro do app (B.4, PEND-08).
4. Cookie-sinalizador para zerar o deslocamento do cabeçalho (A.7): vale a pena depois da medição?
5. Fotos de produto: `cover` ou `contain`, a decidir com fotos reais (B.3).
