# ADR-0004: Stack e arquitetura macro da loja N.UY

| Campo | Valor |
|---|---|
| Status | Aprovado em 2026-11-14. Contas (Vercel, Neon, gateway) em nome da N.UY. Linhas "Painel" e "Ligação com o site" a serem **substituídas por [ADR-0006](ADR-0006-conteudo-do-site-no-banco-da-loja-com-rebuild.md)** (aceito em 2026-11-15) |
| Data | 2026-11-14 |
| Decisores | Desenvolvedor; proposta do dev-arquitetura |
| Tipo | Técnico |
| Projeto / spec | [docs/specs/loja.md](../specs/loja.md) (v0.1; decisões do desenvolvedor de 2026-11-14 prevalecem) · RNF-01 a RNF-13 · CA-LOJ-18, 19, 24, 25 · [ADR-0001](ADR-0001-loja-propria-unica-n-uy-vendedora.md) · [ADR-0002](ADR-0002-desconto-automatico-por-plano-n-uy.md) |
| Desenho detalhado | [docs/tecnico/arquitetura.md](../tecnico/arquitetura.md) |

## Contexto

- Loja própria, única para site e app; o app abre a loja como página web (sem telas nativas). A N.UY é a única vendedora (ADR-0001).
- Decisões do desenvolvedor (2026-11-14), que valem sobre a spec v0.1:
  - **login próprio da loja**: o app é feito em Base44 e não se sabe se ele expõe endpoints;
  - visitante compra pelo preço cheio, sem conta;
  - Pix e cartão à vista por gateway; nota fiscal emitida fora do sistema; frete por tabela;
  - código na pasta `loja/` deste repositório **público**, separada de `site/`;
  - o desconto por plano (ADR-0002) fica **fora do MVP** até a integração com o Base44 ser verificada, mas precisa de um ponto de extensão claro.
- O site atual (`site/`) é HTML estático na Vercel (projeto `nuyvi`), com Sveltia CMS gravando JSON no Git. Ele continua como está e não tem `package.json`.
- Volume previsto: até 500 variações e 50 pedidos/dia, com pico de 5× (RNF-01, **premissa**, P-11). RPO de 1 h e RTO de 4 h (RNF-09, **premissa**). Isso cabe com folga em uma instância de aplicação e um Postgres pequeno.
- Diretriz do time: Next.js (App Router) + TypeScript + PostgreSQL. Outra opção só com motivo concreto. Não há motivo aqui.
- O que exige atenção no desenho: concorrência de estoque (CA-LOJ-24), webhook idempotente (CA-LOJ-18), total sempre calculado no servidor (CA-LOJ-19), expiração da reserva do Pix (CA-LOJ-15) e segredos fora de um repositório público (RNF-13).

## Opções consideradas

| | A. Vercel Pro + Neon Postgres | B. Vercel Pro + Supabase (banco, auth e storage) | C. VPS com Docker (Next standalone + Postgres próprio) |
|---|---|---|---|
| Ganho | Mesma plataforma do site; deploy por push e preview por PR; Postgres serverless com branch por ambiente; restauração para qualquer ponto em até 7 dias no plano Launch, o que atende RPO de 1 h | Uma conta só para banco, login e arquivos; painel de dados pronto | Menor custo fixo; sem limite de cron nem de duração de função; controle total |
| Custo mensal (aprox.) | Vercel Pro US$ 20 por assento de dev (inclui US$ 20 de crédito de uso). Neon Launch sem mínimo, cobrado por uso: US$ 0,106 por CU-hora e US$ 0,35 por GB-mês; estimativa para esta carga **US$ 5 a 20** (*hipótese*: tráfego intermitente com scale-to-zero; o próprio Neon dá ~US$ 15 de exemplo). **Total: ~US$ 25 a 40** | Vercel Pro US$ 20 + Supabase Pro a partir de US$ 25. O backup diário (7 dias) dá RPO de 24 h; para RPO de 1 h, o PITR custa +US$ 100/mês. **Total: ~US$ 45, ou ~US$ 145 com PITR** | VPS de ~US$ 5 a 20 (*não verificado*, depende do provedor), mais armazenamento externo de backup |
| Risco | Pouco: dois fornecedores gerenciados. Função serverless tem limite de duração (300 s), irrelevante para esta carga | Login acoplado ao Supabase Auth; o plano gratuito pausa após 1 semana sem uso (não serve para produção) | Um dev solo vira operador: atualizações, TLS, backup testado, monitoração e 99,5% de disponibilidade (RNF-04) por conta própria |
| Reversibilidade | Alta: Postgres padrão (`pg_dump`), Next.js roda fora da Vercel | Média: o banco sai fácil; auth e storage exigem migração | Alta |

Fontes: [Vercel Hobby e comparação com Pro](https://vercel.com/docs/plans/hobby), [Termos da Vercel, seção 4](https://vercel.com/legal/terms) ("Hobby plan for your personal or non-commercial use"), [limites de Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing) (Hobby: uma vez por dia, precisão de ±59 min), [preços do Neon](https://neon.com/pricing), [regiões do Neon](https://neon.com/docs/introduction/regions) (`aws-sa-east-1` São Paulo disponível), [preços do Supabase](https://supabase.com/pricing). Consultados em 2026-11-14; preços mudam, conferir antes de contratar.

**Por que o plano Hobby da Vercel não serve:** pelos termos, ele é só para uso pessoal ou não comercial, e a loja vende. Além disso, o cron do Hobby roda uma vez por dia, e a expiração do Pix com conferência no gateway precisa rodar a cada poucos minutos (RNF-05).

## Decisão

**Opção A.**

| Item | Decisão | Motivo |
|---|---|---|
| Linguagem e framework | TypeScript + Next.js (App Router), última estável (16.x em 2026-11-14, pelo `npm view next`). Versão exata e detalhes de React: `dev-react` | Diretriz do time; um app serve a loja, o `/admin` e os webhooks |
| Banco | PostgreSQL gerenciado no **Neon**, plano Launch, região `aws-sa-east-1` | Transação e lock de linha resolvem a concorrência de estoque; PITR atende o RPO |
| Hospedagem | **Vercel Pro**, um projeto novo (ex.: `nuy-loja`) com Root Directory `loja/`, separado do projeto `nuyvi` do site, e região das funções **perto do banco** (São Paulo, `gru1`, *conferir na lista de regiões da Vercel*; o padrão é `iad1`) | Uso comercial; cron com intervalo de minutos; o site não muda |
| Acesso a dados | **Drizzle ORM** + `drizzle-kit` para migrations | Fica perto do SQL, então transação, `SELECT ... FOR UPDATE` e `INSERT ... ON CONFLICT DO NOTHING` (o coração do estoque e do webhook) ficam explícitos e tipados; é leve em função serverless. O Prisma também atenderia (o raw SQL cobre o lock), mas a mesma operação crítica ficaria fora do caminho tipado. Opinião técnica: as duas servem, e o Drizzle encaixa melhor no trecho que mais importa |
| Autenticação | Indicação ao `dev-auth`: **Better Auth** (o Auth.js passou a fazer parte do Better Auth, conforme o aviso em authjs.dev), uma instância só para clientes e equipe, com papéis `cliente`, `operador` e `admin`. Desenho, provedores e sessões: `dev-auth` | Login próprio é decisão do desenvolvedor; biblioteca mantida e com Postgres/Drizzle |
| Fotos de produto | Vercel Blob (disponível no Pro), upload pelo `/admin` | Já faz parte da plataforma; nada de imagem de produto no Git |
| Gateway (candidatos) | Mercado Pago, Pagar.me e Asaas; Stripe só se confirmar Pix para conta brasileira. **Escolha final do `dev-integrations`** com o cliente (P-07), pelo CNPJ da N.UY | Todos oferecem Pix e cartão no Brasil (*hipótese não verificada* sobre tarifas e recursos atuais) |
| Estilo | **Monolito modular** em `loja/src/modules/<módulo>`: um app Next.js, um banco, sem serviços separados | 1 dev, carga baixa |
| Painel | Rota `/admin` dentro da própria loja, protegida por papel e checada no servidor | Uma base de código, uma sessão, sem segundo deploy |
| Ligação com o site | Subdomínio próprio para a loja (ex.: `loja.<domínio N.UY>`); os cartões de `site/conteudo/loja.json` ganham um campo de link para `/categoria/<slug>` | Projeto e cookies separados; o `/admin` do Sveltia (no site) e o `/admin` da loja não colidem |

## Consequências

**Positivas**
- Uma plataforma para o site e a loja, previews por PR e um banco de dev/preview por branch do Neon (sem tocar produção).
- Correção de estoque e de pagamento garantida no banco (transação, lock e chave única), não em memória.
- Sair da Vercel ou do Neon é barato: Next.js e Postgres são padrões.

**Negativas e custos aceitos**
- Custo fixo de ~US$ 25 a 40/mês mais as tarifas do gateway por venda (*não verificadas*). Conversão para reais por conta do câmbio do dia.
- Duas contas para administrar (Vercel e Neon). O ideal é que fiquem no nome da N.UY ou que a transferência esteja prevista (decisão do desenvolvedor).
- Função serverless: nada de processo em segundo plano permanente. Trabalho fora da requisição usa cron da Vercel e/ou `after()` do Next.js (conferir na documentação da versão instalada). O mecanismo é do `dev-integrations`.
- O projeto `nuyvi` do site, se estiver no Hobby, também é uso comercial (landing de um produto pago). Vale mover os dois projetos para o mesmo time Pro.

**Riscos e mitigação**
- Segredos num repositório público: só `.env.example` versionado; chaves nas variáveis de ambiente da Vercel, separadas por ambiente; chave de produção do gateway só em Production (`dev-devops`, `dev-security`).
- Preview deployment com banco de produção: proibido; cada preview usa uma branch do Neon e o sandbox do gateway (`dev-infra`, `dev-devops`).
- Latência entre função e banco: ambos em São Paulo; se a Vercel não tiver `gru1` no plano, mover as duas pontas para a mesma região dos EUA (`iad1` + `aws-us-east-1`).

**Impacto em outros agentes:** `dev-devops` (projeto `loja/`, pipeline e ambientes), `dev-database` (schema Drizzle, locking e idempotência), `dev-auth` (Better Auth, papéis), `dev-infra` (Neon, projeto Vercel, região, plano Pro, domínio), `dev-integrations` (gateway, webhook, cron de expiração, e-mails fora da requisição), `dev-react` (implementação), `dev-security` (revisão), `dev-tests` (testes de concorrência e idempotência).

## Quando revisitar

- Custo da Vercel acima de ~US$ 100/mês por uso de função ou de banda: comparar com a opção C.
- Necessidade de trabalho longo ou contínuo (importação grande, fila com muitos workers): avaliar um worker separado com o `dev-integrations`.
- Volume real 10× acima do RNF-01 (500 pedidos/dia): medir o banco antes de qualquer mudança.
- Base44 expuser identidade e plano: reavaliar se o login continua próprio ou passa a ser federado com o app (ADR do `dev-auth`).
