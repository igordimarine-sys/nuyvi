-- SQL manual: amplia conteudo_versoes_blocos_ck de 9 para 12 blocos (videos, geral, pagina-loja; ADR-0007 A1).
-- Rollback: repetir os 3 comandos com a lista de 9 e "between 1 and 9" (só vale se nenhuma versão usar os blocos novos).
-- NOT VALID + VALIDATE: a constraint nova já vale para inserções e a varredura das linhas antigas não segura lock pesado.
ALTER TABLE "conteudo_versoes" DROP CONSTRAINT "conteudo_versoes_blocos_ck";--> statement-breakpoint
ALTER TABLE "conteudo_versoes" ADD CONSTRAINT "conteudo_versoes_blocos_ck" CHECK (cardinality("conteudo_versoes"."blocos_alterados") between 1 and 12 and "conteudo_versoes"."blocos_alterados" <@ array['abertura','parceiros','planos','bonus','historia','explore','loja','novidades','baixar','videos','geral','pagina-loja']::text[]) NOT VALID;--> statement-breakpoint
ALTER TABLE "conteudo_versoes" VALIDATE CONSTRAINT "conteudo_versoes_blocos_ck";
