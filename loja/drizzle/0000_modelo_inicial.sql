CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categorias_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "produto_fotos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"ativo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produtos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "variacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"tamanho" text,
	"cor" text,
	"preco_centavos" integer NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variacoes_sku_unique" UNIQUE("sku"),
	CONSTRAINT "variacoes_preco_ck" CHECK ("variacoes"."preco_centavos" >= 0),
	CONSTRAINT "variacoes_sku_ck" CHECK ("variacoes"."sku" = upper(btrim("variacoes"."sku")) and "variacoes"."sku" <> '')
);
--> statement-breakpoint
CREATE TABLE "emails_saida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"proxima_tentativa_em" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_em" timestamp with time zone,
	"ultimo_erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emails_saida_tipo_ck" CHECK (tipo in ('pedido_recebido', 'pago', 'enviado', 'cancelado')),
	CONSTRAINT "emails_saida_status_ck" CHECK (status in ('pendente', 'enviado', 'falhou'))
);
--> statement-breakpoint
CREATE TABLE "estoque_movimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variacao_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"quantidade" integer NOT NULL,
	"motivo" text,
	"pedido_id" uuid,
	"usuario_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estoque_movimentos_tipo_ck" CHECK (tipo in ('entrada', 'ajuste', 'venda', 'estorno')),
	CONSTRAINT "estoque_movimentos_sinal_ck" CHECK (("estoque_movimentos"."tipo" = 'venda' and "estoque_movimentos"."quantidade" < 0)
        or ("estoque_movimentos"."tipo" in ('entrada', 'estorno') and "estoque_movimentos"."quantidade" > 0)
        or ("estoque_movimentos"."tipo" = 'ajuste' and "estoque_movimentos"."quantidade" <> 0 and "estoque_movimentos"."motivo" is not null))
);
--> statement-breakpoint
CREATE TABLE "estoque_reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"variacao_id" uuid NOT NULL,
	"quantidade" integer NOT NULL,
	"status" text DEFAULT 'ativa' NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estoque_reservas_qtd_ck" CHECK ("estoque_reservas"."quantidade" > 0),
	CONSTRAINT "estoque_reservas_status_ck" CHECK (status in ('ativa', 'baixada', 'liberada'))
);
--> statement-breakpoint
CREATE TABLE "estoque_saldos" (
	"variacao_id" uuid PRIMARY KEY NOT NULL,
	"fisico" integer DEFAULT 0 NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estoque_saldos_nao_negativo_ck" CHECK ("estoque_saldos"."fisico" >= 0)
);
--> statement-breakpoint
CREATE TABLE "frete_faixas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"cep_inicio" integer NOT NULL,
	"cep_fim" integer NOT NULL,
	"valor_centavos" integer NOT NULL,
	"prazo_dias_uteis" integer NOT NULL,
	"gratis_acima_centavos" integer,
	"ativa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "frete_faixas_cep_ck" CHECK ("frete_faixas"."cep_inicio" between 0 and 99999999 and "frete_faixas"."cep_fim" between "frete_faixas"."cep_inicio" and 99999999),
	CONSTRAINT "frete_faixas_valores_ck" CHECK ("frete_faixas"."valor_centavos" >= 0 and "frete_faixas"."prazo_dias_uteis" >= 0 and coalesce("frete_faixas"."gratis_acima_centavos", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "estornos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pagamento_id" uuid NOT NULL,
	"valor_centavos" integer NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"id_externo" text,
	"motivo_falha" text,
	"solicitado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estornos_valor_ck" CHECK ("estornos"."valor_centavos" > 0),
	CONSTRAINT "estornos_status_ck" CHECK (status in ('pendente', 'confirmado', 'falhou'))
);
--> statement-breakpoint
CREATE TABLE "gateway_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gateway" text NOT NULL,
	"evento_id" text NOT NULL,
	"tipo" text NOT NULL,
	"pagamento_id" uuid,
	"payload" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pagamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"gateway" text NOT NULL,
	"id_externo" text,
	"metodo" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"valor_centavos" integer NOT NULL,
	"pix_copia_e_cola" text,
	"pix_expira_em" timestamp with time zone,
	"motivo_recusa" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagamentos_metodo_ck" CHECK (metodo in ('pix', 'cartao')),
	CONSTRAINT "pagamentos_status_ck" CHECK (status in ('pendente', 'aprovado', 'recusado', 'cancelado', 'expirado')),
	CONSTRAINT "pagamentos_valor_ck" CHECK ("pagamentos"."valor_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "pedido_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"de_status" text,
	"para_status" text NOT NULL,
	"ator_tipo" text NOT NULL,
	"ator_usuario_id" text,
	"motivo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedido_historico_para_ck" CHECK (para_status in ('aguardando_pagamento', 'pago', 'expirado', 'cancelado', 'cancelamento_solicitado', 'em_separacao', 'estorno_pendente', 'cancelado_estornado', 'enviado', 'entregue', 'em_troca', 'devolvido')),
	CONSTRAINT "pedido_historico_de_ck" CHECK ("pedido_historico"."de_status" is null or "pedido_historico"."de_status" in ('aguardando_pagamento', 'pago', 'expirado', 'cancelado', 'cancelamento_solicitado', 'em_separacao', 'estorno_pendente', 'cancelado_estornado', 'enviado', 'entregue', 'em_troca', 'devolvido')),
	CONSTRAINT "pedido_historico_ator_ck" CHECK (ator_tipo in ('sistema', 'comprador', 'equipe'))
);
--> statement-breakpoint
CREATE TABLE "pedido_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" uuid NOT NULL,
	"variacao_id" uuid NOT NULL,
	"produto_nome" text NOT NULL,
	"variacao_descricao" text,
	"sku" text NOT NULL,
	"quantidade" integer NOT NULL,
	"preco_unitario_centavos" integer NOT NULL,
	"desconto_centavos" integer DEFAULT 0 NOT NULL,
	"total_centavos" integer NOT NULL,
	CONSTRAINT "pedido_itens_qtd_ck" CHECK ("pedido_itens"."quantidade" > 0 and "pedido_itens"."preco_unitario_centavos" >= 0),
	CONSTRAINT "pedido_itens_desconto_ck" CHECK ("pedido_itens"."desconto_centavos" between 0 and "pedido_itens"."preco_unitario_centavos" * "pedido_itens"."quantidade"),
	CONSTRAINT "pedido_itens_total_ck" CHECK ("pedido_itens"."total_centavos" = "pedido_itens"."preco_unitario_centavos" * "pedido_itens"."quantidade" - "pedido_itens"."desconto_centavos")
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" integer GENERATED ALWAYS AS IDENTITY (sequence name "pedidos_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1),
	"usuario_id" text,
	"status" text DEFAULT 'aguardando_pagamento' NOT NULL,
	"comprador_email" text NOT NULL,
	"comprador_nome" text NOT NULL,
	"comprador_cpf" text NOT NULL,
	"comprador_telefone" text NOT NULL,
	"entrega_cep" text NOT NULL,
	"entrega_logradouro" text NOT NULL,
	"entrega_numero" text NOT NULL,
	"entrega_complemento" text,
	"entrega_bairro" text NOT NULL,
	"entrega_cidade" text NOT NULL,
	"entrega_uf" text NOT NULL,
	"subtotal_centavos" integer NOT NULL,
	"desconto_centavos" integer DEFAULT 0 NOT NULL,
	"frete_centavos" integer NOT NULL,
	"frete_prazo_dias_uteis" integer NOT NULL,
	"total_centavos" integer NOT NULL,
	"plano_codigo" text,
	"plano_percentual_bp" integer,
	"token_acompanhamento_hash" text,
	"token_expira_em" timestamp with time zone,
	"expira_em" timestamp with time zone,
	"pago_em" timestamp with time zone,
	"nota_fiscal_numero" text,
	"nota_fiscal_chave" text,
	"rastreio_codigo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_status_ck" CHECK (status in ('aguardando_pagamento', 'pago', 'expirado', 'cancelado', 'cancelamento_solicitado', 'em_separacao', 'estorno_pendente', 'cancelado_estornado', 'enviado', 'entregue', 'em_troca', 'devolvido')),
	CONSTRAINT "pedidos_valores_ck" CHECK ("pedidos"."subtotal_centavos" >= 0 and "pedidos"."desconto_centavos" >= 0 and "pedidos"."frete_centavos" >= 0 and "pedidos"."desconto_centavos" <= "pedidos"."subtotal_centavos"),
	CONSTRAINT "pedidos_total_ck" CHECK ("pedidos"."total_centavos" = "pedidos"."subtotal_centavos" - "pedidos"."desconto_centavos" + "pedidos"."frete_centavos"),
	CONSTRAINT "pedidos_cpf_ck" CHECK ("pedidos"."comprador_cpf" ~ '^[0-9]{11}$'),
	CONSTRAINT "pedidos_cep_ck" CHECK ("pedidos"."entrega_cep" ~ '^[0-9]{8}$' and "pedidos"."entrega_uf" ~ '^[A-Z]{2}$'),
	CONSTRAINT "pedidos_envio_ck" CHECK ("pedidos"."status" not in ('enviado', 'entregue', 'em_troca', 'devolvido') or ("pedidos"."nota_fiscal_numero" is not null and "pedidos"."rastreio_codigo" is not null))
);
--> statement-breakpoint
ALTER TABLE "produto_fotos" ADD CONSTRAINT "produto_fotos_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variacoes" ADD CONSTRAINT "variacoes_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails_saida" ADD CONSTRAINT "emails_saida_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_variacao_id_variacoes_id_fk" FOREIGN KEY ("variacao_id") REFERENCES "public"."variacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_movimentos" ADD CONSTRAINT "estoque_movimentos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_reservas" ADD CONSTRAINT "estoque_reservas_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_reservas" ADD CONSTRAINT "estoque_reservas_variacao_id_variacoes_id_fk" FOREIGN KEY ("variacao_id") REFERENCES "public"."variacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estoque_saldos" ADD CONSTRAINT "estoque_saldos_variacao_id_variacoes_id_fk" FOREIGN KEY ("variacao_id") REFERENCES "public"."variacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estornos" ADD CONSTRAINT "estornos_pagamento_id_pagamentos_id_fk" FOREIGN KEY ("pagamento_id") REFERENCES "public"."pagamentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_eventos" ADD CONSTRAINT "gateway_eventos_pagamento_id_pagamentos_id_fk" FOREIGN KEY ("pagamento_id") REFERENCES "public"."pagamentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_historico" ADD CONSTRAINT "pedido_historico_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_variacao_id_variacoes_id_fk" FOREIGN KEY ("variacao_id") REFERENCES "public"."variacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "produto_fotos_produto_idx" ON "produto_fotos" USING btree ("produto_id","ordem");--> statement-breakpoint
CREATE INDEX "produtos_categoria_idx" ON "produtos" USING btree ("categoria_id") WHERE "produtos"."ativo";--> statement-breakpoint
CREATE INDEX "variacoes_produto_idx" ON "variacoes" USING btree ("produto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variacoes_produto_tamanho_cor_uq" ON "variacoes" USING btree ("produto_id",coalesce("tamanho", ''),coalesce("cor", ''));--> statement-breakpoint
CREATE UNIQUE INDEX "emails_saida_pedido_tipo_uq" ON "emails_saida" USING btree ("pedido_id","tipo");--> statement-breakpoint
CREATE INDEX "emails_saida_pendentes_idx" ON "emails_saida" USING btree ("proxima_tentativa_em") WHERE "emails_saida"."status" = 'pendente';--> statement-breakpoint
CREATE INDEX "estoque_movimentos_variacao_idx" ON "estoque_movimentos" USING btree ("variacao_id","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "estoque_movimentos_pedido_idx" ON "estoque_movimentos" USING btree ("pedido_id") WHERE "estoque_movimentos"."pedido_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "estoque_reservas_pedido_variacao_uq" ON "estoque_reservas" USING btree ("pedido_id","variacao_id");--> statement-breakpoint
CREATE INDEX "estoque_reservas_ativas_idx" ON "estoque_reservas" USING btree ("variacao_id") WHERE "estoque_reservas"."status" = 'ativa';--> statement-breakpoint
CREATE INDEX "estoque_reservas_expira_idx" ON "estoque_reservas" USING btree ("expira_em") WHERE "estoque_reservas"."status" = 'ativa';--> statement-breakpoint
CREATE INDEX "estornos_pagamento_idx" ON "estornos" USING btree ("pagamento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_eventos_uq" ON "gateway_eventos" USING btree ("gateway","evento_id");--> statement-breakpoint
CREATE INDEX "gateway_eventos_pagamento_idx" ON "gateway_eventos" USING btree ("pagamento_id") WHERE "gateway_eventos"."pagamento_id" is not null;--> statement-breakpoint
CREATE INDEX "pagamentos_pedido_idx" ON "pagamentos" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pagamentos_gateway_id_uq" ON "pagamentos" USING btree ("gateway","id_externo") WHERE "pagamentos"."id_externo" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pagamentos_um_aprovado_uq" ON "pagamentos" USING btree ("pedido_id") WHERE "pagamentos"."status" = 'aprovado';--> statement-breakpoint
CREATE INDEX "pedido_historico_pedido_idx" ON "pedido_historico" USING btree ("pedido_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_itens_pedido_variacao_uq" ON "pedido_itens" USING btree ("pedido_id","variacao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_numero_uq" ON "pedidos" USING btree ("numero");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_token_hash_uq" ON "pedidos" USING btree ("token_acompanhamento_hash") WHERE "pedidos"."token_acompanhamento_hash" is not null;--> statement-breakpoint
CREATE INDEX "pedidos_usuario_idx" ON "pedidos" USING btree ("usuario_id","criado_em" DESC NULLS LAST) WHERE "pedidos"."usuario_id" is not null;--> statement-breakpoint
CREATE INDEX "pedidos_email_idx" ON "pedidos" USING btree (lower("comprador_email"));--> statement-breakpoint
CREATE INDEX "pedidos_status_idx" ON "pedidos" USING btree ("status","criado_em");--> statement-breakpoint
CREATE INDEX "pedidos_expiracao_idx" ON "pedidos" USING btree ("expira_em") WHERE "pedidos"."status" = 'aguardando_pagamento';--> statement-breakpoint
-- Manual (Drizzle não declara EXCLUDE): faixas de frete ativas não se sobrepõem.
-- Rollback: ALTER TABLE "frete_faixas" DROP CONSTRAINT "frete_faixas_sem_sobreposicao_ex";
ALTER TABLE "frete_faixas" ADD CONSTRAINT "frete_faixas_sem_sobreposicao_ex" EXCLUDE USING gist (int4range("cep_inicio", "cep_fim", '[]') WITH &&) WHERE ("ativa");
