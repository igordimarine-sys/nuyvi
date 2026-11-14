import { createAuthClient } from "better-auth/react";

// Cliente das telas de conta (rotas /api/auth/*, com rate limit e checagem de origem no servidor).
export const authClient = createAuthClient();
