import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

// Faixas de CEP (só dígitos, como inteiro de 8 dígitos). Faixas ativas não podem se sobrepor:
// a EXCLUDE constraint está em SQL manual na migration (o Drizzle não declara EXCLUDE). O pedido
// congela valor e prazo, então não há FK de pedido para cá.
export const freteFaixas = pgTable(
  "frete_faixas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(), // ex.: "SP capital"
    cepInicio: integer("cep_inicio").notNull(),
    cepFim: integer("cep_fim").notNull(),
    valorCentavos: integer("valor_centavos").notNull(),
    prazoDiasUteis: integer("prazo_dias_uteis").notNull(),
    // Frete grátis a partir deste subtotal (RN-LOJ-16, CA-LOJ-23). Nulo = sem frete grátis. P-06 pendente.
    gratisAcimaCentavos: integer("gratis_acima_centavos"),
    ativa: boolean("ativa").notNull().default(true),
  },
  (t) => [
    check("frete_faixas_cep_ck", sql`${t.cepInicio} between 0 and 99999999 and ${t.cepFim} between ${t.cepInicio} and 99999999`),
    check("frete_faixas_valores_ck", sql`${t.valorCentavos} >= 0 and ${t.prazoDiasUteis} >= 0 and coalesce(${t.gratisAcimaCentavos}, 0) >= 0`),
  ],
);
