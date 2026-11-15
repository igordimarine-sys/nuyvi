CREATE TABLE "conteudo_versoes" (
	"numero" integer PRIMARY KEY NOT NULL,
	"conteudo" jsonb NOT NULL,
	"blocos_alterados" text[] NOT NULL,
	"origem" text DEFAULT 'painel' NOT NULL,
	"autor_id" text,
	"disparo_estado" text DEFAULT 'pendente' NOT NULL,
	"disparo_em" timestamp with time zone,
	"disparo_erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conteudo_versoes_numero_ck" CHECK ("conteudo_versoes"."numero" >= 1),
	CONSTRAINT "conteudo_versoes_conteudo_ck" CHECK (jsonb_typeof("conteudo_versoes"."conteudo") = 'object' and "conteudo_versoes"."conteudo" ?& array['textos','loja','explore','novidades','planos']),
	CONSTRAINT "conteudo_versoes_blocos_ck" CHECK (cardinality("conteudo_versoes"."blocos_alterados") between 1 and 9 and "conteudo_versoes"."blocos_alterados" <@ array['abertura','parceiros','planos','bonus','historia','explore','loja','novidades','baixar']::text[]),
	CONSTRAINT "conteudo_versoes_origem_ck" CHECK (origem in ('painel', 'migracao')),
	CONSTRAINT "conteudo_versoes_disparo_estado_ck" CHECK (disparo_estado in ('pendente', 'aceito', 'falhou')),
	CONSTRAINT "conteudo_versoes_disparo_coerente_ck" CHECK (("conteudo_versoes"."disparo_estado" = 'pendente' and "conteudo_versoes"."disparo_em" is null) or ("conteudo_versoes"."disparo_estado" <> 'pendente' and "conteudo_versoes"."disparo_em" is not null)),
	CONSTRAINT "conteudo_versoes_autor_ck" CHECK ("conteudo_versoes"."origem" = 'painel' or "conteudo_versoes"."autor_id" is null)
);
--> statement-breakpoint
ALTER TABLE "conteudo_versoes" ADD CONSTRAINT "conteudo_versoes_autor_id_user_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conteudo_versoes_uma_pendente_uk" ON "conteudo_versoes" USING btree ((true)) WHERE "conteudo_versoes"."disparo_estado" = 'pendente';--> statement-breakpoint
CREATE INDEX "conteudo_versoes_aceitas_idx" ON "conteudo_versoes" USING btree ("numero" DESC NULLS LAST) WHERE "conteudo_versoes"."disparo_estado" = 'aceito';--> statement-breakpoint
CREATE INDEX "conteudo_versoes_autor_idx" ON "conteudo_versoes" USING btree ("autor_id") WHERE "conteudo_versoes"."autor_id" is not null;--> statement-breakpoint
-- SQL manual: imutabilidade e sequência sem buracos (ADR-0006). Ver docs/tecnico/banco.md.
CREATE FUNCTION "conteudo_versoes_guarda"() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
	IF TG_OP = 'INSERT' THEN
		-- numero = último + 1 (a PK resolve a corrida entre transações concorrentes com 23505)
		IF NEW.numero <> COALESCE((SELECT max(numero) FROM conteudo_versoes), 0) + 1 THEN
			RAISE EXCEPTION 'conteudo_versoes: numero % fora da sequência', NEW.numero USING ERRCODE = '23514';
		END IF;
		IF NEW.disparo_estado = 'falhou' THEN
			RAISE EXCEPTION 'conteudo_versoes: uma versão nasce pendente ou aceita' USING ERRCODE = '23514';
		END IF;
		RETURN NEW;
	ELSIF TG_OP = 'UPDATE' THEN
		-- só mudam: disparo_* (pendente -> aceito|falhou, uma vez) e autor_id (valor -> NULL, via ON DELETE SET NULL)
		IF NEW.numero IS DISTINCT FROM OLD.numero
			OR NEW.conteudo IS DISTINCT FROM OLD.conteudo
			OR NEW.blocos_alterados IS DISTINCT FROM OLD.blocos_alterados
			OR NEW.origem IS DISTINCT FROM OLD.origem
			OR NEW.criado_em IS DISTINCT FROM OLD.criado_em
			OR (NEW.autor_id IS DISTINCT FROM OLD.autor_id AND NEW.autor_id IS NOT NULL) THEN
			RAISE EXCEPTION 'conteudo_versoes: versão publicada é imutável' USING ERRCODE = '23514';
		END IF;
		IF (NEW.disparo_estado, NEW.disparo_em, NEW.disparo_erro) IS DISTINCT FROM (OLD.disparo_estado, OLD.disparo_em, OLD.disparo_erro) THEN
			IF OLD.disparo_estado <> 'pendente' OR NEW.disparo_estado = 'pendente' THEN
				RAISE EXCEPTION 'conteudo_versoes: o disparo só vai de pendente para aceito ou falhou' USING ERRCODE = '23514';
			END IF;
		END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'conteudo_versoes: versões não são apagadas' USING ERRCODE = '23514';
END
$fn$;--> statement-breakpoint
CREATE TRIGGER "conteudo_versoes_guarda_row" BEFORE INSERT OR UPDATE OR DELETE ON "conteudo_versoes"
	FOR EACH ROW EXECUTE FUNCTION "conteudo_versoes_guarda"();