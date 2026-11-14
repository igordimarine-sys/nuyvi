import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z
    .string({ error: "DATABASE_URL é obrigatória (veja .env.example)" })
    .min(1, "DATABASE_URL está vazia")
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL deve começar com postgres:// ou postgresql://"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detalhes = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Variáveis de ambiente inválidas:\n${detalhes}`);
}

export const env = parsed.data;
