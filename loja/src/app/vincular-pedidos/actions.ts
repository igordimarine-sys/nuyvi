"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { confirmarVinculoPedidos, solicitarVinculoPedidos } from "@/modules/contas/vincular-pedidos";

// Server Actions são endpoints POST públicos: a sessão é checada dentro das funções do módulo.
export async function pedirVinculo() {
  await solicitarVinculoPedidos();
  redirect("/vincular-pedidos?resultado=enviado");
}

export async function confirmarVinculo(formData: FormData) {
  const token = z.string().min(10).max(1000).safeParse(formData.get("token"));
  const n = token.success ? await confirmarVinculoPedidos(token.data) : null;
  redirect(n === null ? "/vincular-pedidos?resultado=invalido" : `/vincular-pedidos?resultado=ok&n=${n}`);
}
