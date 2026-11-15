import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

// Cliente das telas de conta (rotas /api/auth/*, com rate limit e checagem de origem no servidor).
// `role` tipado só para escolher o destino após o login; quem autoriza é exigirPapel no servidor.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields({ user: { role: { type: "string", input: false } } })],
});
