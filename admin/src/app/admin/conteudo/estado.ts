import type { Campo } from "./campos";

// Estado do formulário. Difere dos dados publicados em dois pontos: números são texto digitado ("19,90") e cada item de
// lista tem uma chave estável (_k) para o React (e para manter foco e "recolhido" ao reordenar). `paraEnvio` desfaz as duas coisas.
export type Valor = Record<string, unknown>;
export type Caminho = (string | number)[];

/** Os campos com dado, sem os grupos (que só organizam a tela). */
export function folhas(campos: Campo[]): Exclude<Campo, { tipo: "grupo" }>[] {
  return campos.flatMap((c) => (c.tipo === "grupo" ? folhas(c.campos) : [c]));
}

let contador = 0;
const nova = () => `k${++contador}`;
const texto = (v: unknown) => (typeof v === "string" ? v : "");

/** Dados do bloco -> estado do formulário. `novo`: item recém-adicionado (listas internas começam com uma linha vazia). */
export function paraEstado(dados: unknown, campos: Campo[], novo = false): Valor {
  const d = (dados ?? {}) as Valor;
  const o: Valor = {};
  for (const c of folhas(campos)) {
    const v = d[c.chave];
    if (c.tipo === "texto" || c.tipo === "selecao" || c.tipo === "foto" || c.tipo === "video") o[c.chave] = texto(v);
    else if (c.tipo === "inteiro") o[c.chave] = typeof v === "number" ? String(v) : "";
    else if (c.tipo === "preco") o[c.chave] = typeof v === "number" ? String(v).replace(".", ",") : "";
    else if (c.tipo === "sim_nao") o[c.chave] = v === true;
    else if (c.tipo === "lista") {
      const itens = Array.isArray(v) ? v : novo ? [{}] : [];
      o[c.chave] = itens.map((i) => ({ ...paraEstado(i, c.campos, novo), _k: nova() }));
    } else {
      const itens = Array.isArray(v) ? v : novo ? [""] : [];
      o[c.chave] = itens.map((s) => ({ _k: nova(), _v: texto(s) }));
    }
  }
  return o;
}

/** Número digitado -> número; o que não for número fica como texto para o zod apontar o campo. */
const numero = (s: unknown, inteiro: boolean) => {
  const x = String(s ?? "").trim().replace(",", ".");
  return (inteiro ? /^\d+$/ : /^\d+(\.\d+)?$/).test(x) ? Number(x) : s;
};

/** Estado do formulário -> dados do bloco (o que vai ao servidor e ao zod). */
export function paraEnvio(estado: Valor, campos: Campo[]): Valor {
  const o: Valor = {};
  for (const c of folhas(campos)) {
    const v = estado[c.chave];
    if (c.tipo === "inteiro" || c.tipo === "preco") o[c.chave] = numero(v, c.tipo === "inteiro");
    else if (c.tipo === "lista") o[c.chave] = (v as Valor[]).map((i) => paraEnvio(i, c.campos));
    else if (c.tipo === "textos") o[c.chave] = (v as { _v: string }[]).map((i) => i._v);
    else o[c.chave] = v;
  }
  return o;
}

/** Cópia de `obj` com `v` no lugar de `caminho` (sem alterar o original). */
export function definir<T>(obj: T, caminho: Caminho, v: unknown): T {
  const [k, ...resto] = caminho;
  if (k === undefined) return v as T;
  const copia = (Array.isArray(obj) ? [...obj] : { ...obj }) as Record<string | number, unknown>;
  copia[k] = definir(copia[k], resto, v);
  return copia as T;
}

export const idDe = (caminho: Caminho) => `c-${caminho.join("-")}`;

/** Nome legível do campo de um caminho, para o resumo de erros ("Plano 2: Nome"). */
export function descreverCaminho(campos: Campo[], caminho: Caminho): string {
  const [k, i, ...resto] = caminho;
  const c = folhas(campos).find((x) => x.chave === k);
  if (!c) return caminho.join(".");
  if (c.tipo === "lista" && typeof i === "number") {
    const sub = resto.length ? descreverCaminho(c.campos, resto) : "";
    return `${c.item} ${i + 1}${sub ? `: ${sub}` : ""}`;
  }
  if (c.tipo === "textos" && typeof i === "number") return `${c.rotulo}: ${c.item.toLowerCase()} ${i + 1}`;
  return c.rotulo;
}
