"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { BLOCOS, errosDe, type Bloco } from "@/modules/conteudo-site/schema";
import { consultarSituacao, publicarBloco, type RespostaPublicar } from "./actions";
import type { Campo } from "./campos";
import { definir, descreverCaminho, idDe, paraEnvio, paraEstado, type Caminho, type Valor } from "./estado";
import { Aviso, Etiqueta } from "./ui";

// Editor de UM bloco (spec UI, seções 6 e 7): estado só na tela, validação inline com as regras do servidor (zod),
// publicar sozinho o bloco, e o digitado nunca se perde por erro, conflito ou falha do disparo.
const TAMANHO_MAXIMO = 4_500_000; // igual ao servidor (modules/conteudo-site/foto.ts); o servidor confere de novo
const FORMATOS = ["image/jpeg", "image/png", "image/webp"];

type Confirmacao = { titulo: string; texto: string; ok: string; perigo?: boolean; cancelar?: string; aoConfirmar: () => void };

type Resultado =
  | { tipo: "publicado"; aviso?: string }
  | { tipo: "falha"; repetida: boolean }
  | { tipo: "rede" }
  | { tipo: "conflito"; versaoBase: number; blocos: Bloco[]; mesmoBloco: boolean; atual: unknown }
  | { tipo: "em_andamento" }
  | { tipo: "sem_permissao" }
  | { tipo: "sessao_expirada" }
  | { tipo: "sem_conteudo" };

type Ctx = {
  erros: Record<string, string>;
  siteUrl: string;
  alterar: (caminho: Caminho, v: unknown) => void;
  aoSair: (caminho: Caminho) => void;
  limparErros: () => void;
  pedirConfirmacao: (c: Confirmacao) => void;
  anunciar: (msg: string) => void;
  focar: (...ids: string[]) => void;
  enviando: (delta: 1 | -1) => void;
};
const EditorCtx = createContext<Ctx | null>(null);
const useEditor = () => {
  const c = useContext(EditorCtx);
  if (!c) throw new Error("fora do editor");
  return c;
};

// ---------- Campos ----------

function Rotulado({ id, rotulo, ajuda, erro, opcional, children }: { id: string; rotulo: string; ajuda?: string; erro?: string; opcional?: boolean; children: ReactNode }) {
  return (
    <div className={`campo${erro ? " campo-erro" : ""}`}>
      <label htmlFor={id}>{rotulo}{opcional && <> <Etiqueta>Opcional</Etiqueta></>}</label>
      {children}
      {ajuda && !erro && <p id={`${id}-desc`} className="ajuda">{ajuda}</p>}
      {erro && <p id={`${id}-desc`} className="erro-texto"><span aria-hidden="true">! </span>{erro}</p>}
    </div>
  );
}

const descricao = (id: string, erro?: string, ajuda?: string) => ({ "aria-invalid": erro ? true : undefined, "aria-describedby": erro || ajuda ? `${id}-desc` : undefined });

function Campos({ campos, valor, caminho }: { campos: Campo[]; valor: Valor; caminho: Caminho }) {
  // o primeiro texto do grupo nomeia a foto na miniatura ("Capa de Gold")
  const primeiro = campos.find((x) => x.tipo === "texto");
  const contexto = primeiro ? String(valor[primeiro.chave] ?? "") : "";
  return <>{campos.map((c) => <CampoGenerico key={c.chave} campo={c} valor={valor[c.chave]} caminho={[...caminho, c.chave]} contexto={contexto} />)}</>;
}

function CampoGenerico({ campo, valor, caminho, contexto }: { campo: Campo; valor: unknown; caminho: Caminho; contexto: string }) {
  const ed = useEditor();
  const id = idDe(caminho);
  const erro = ed.erros[caminho.join(".")];
  const alterar = (v: unknown) => ed.alterar(caminho, v);
  const comuns = { id, onBlur: () => ed.aoSair(caminho) };

  switch (campo.tipo) {
    case "texto":
      return (
        <Rotulado id={id} rotulo={campo.rotulo} ajuda={campo.ajuda} erro={erro} opcional={campo.opcional}>
          {campo.longo
            ? <textarea {...comuns} rows={4} value={String(valor ?? "")} onChange={(e) => alterar(e.target.value)} {...descricao(id, erro, campo.ajuda)} />
            : <input {...comuns} type="text" value={String(valor ?? "")} onChange={(e) => alterar(e.target.value)} {...descricao(id, erro, campo.ajuda)} />}
        </Rotulado>
      );
    case "inteiro":
    case "preco":
      return (
        <Rotulado id={id} rotulo={campo.rotulo} ajuda={campo.ajuda} erro={erro}>
          <input {...comuns} type="text" inputMode={campo.tipo === "inteiro" ? "numeric" : "decimal"} value={String(valor ?? "")} onChange={(e) => alterar(e.target.value)} {...descricao(id, erro, campo.ajuda)} />
        </Rotulado>
      );
    case "sim_nao":
      return (
        <div className="campo campo-caixa">
          <label htmlFor={id}><input {...comuns} type="checkbox" checked={valor === true} onChange={(e) => alterar(e.target.checked)} /> {campo.rotulo}</label>
        </div>
      );
    case "selecao": {
      const v = String(valor ?? "");
      return (
        <Rotulado id={id} rotulo={campo.rotulo} ajuda={campo.ajuda} erro={erro}>
          <select {...comuns} value={v} onChange={(e) => alterar(e.target.value)} {...descricao(id, erro, campo.ajuda)}>
            <option value="">{campo.vazio}</option>
            {v && !campo.opcoes.some((o) => o.valor === v) && <option value={v}>Opção que não existe mais</option>}
            {campo.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </Rotulado>
      );
    }
    case "foto":
      return <CampoFoto campo={campo} valor={String(valor ?? "")} caminho={caminho} contexto={contexto} />;
    case "lista":
      return <ListaEditavel campo={campo} valor={(valor as Valor[]) ?? []} caminho={caminho} />;
    case "textos":
      return <ListaTextos campo={campo} valor={(valor as { _k: string; _v: string }[]) ?? []} caminho={caminho} />;
  }
}

function CampoFoto({ campo, valor, caminho, contexto }: { campo: Extract<Campo, { tipo: "foto" }>; valor: string; caminho: Caminho; contexto: string }) {
  const ed = useEditor();
  const id = idDe(caminho);
  const entrada = useRef<HTMLInputElement>(null);
  const [anterior, setAnterior] = useState<string | null>(null); // foto publicada, enquanto houver foto nova ainda não publicada
  const [enviando, setEnviando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const erro = erroLocal ?? ed.erros[caminho.join(".")];
  const miniatura = valor.startsWith("http") ? valor : valor.startsWith("img/") && ed.siteUrl ? `${ed.siteUrl}/${valor}` : null;
  const nome = `${campo.rotulo}${contexto ? ` de ${contexto}` : ""}`;

  async function enviar(f: File) {
    setErroLocal(null);
    if (!FORMATOS.includes(f.type)) return setErroLocal("Formato não aceito. Envie JPEG, PNG ou WebP.");
    if (f.size > TAMANHO_MAXIMO) return setErroLocal(`Arquivo grande demais (${(f.size / 1_000_000).toFixed(1).replace(".", ",")} MB). O máximo é 4,5 MB.`);
    setEnviando(true);
    ed.enviando(1);
    try {
      const dados = new FormData();
      dados.set("foto", f);
      const res = await fetch("/api/conteudo-site/foto", { method: "POST", body: dados });
      const j = (await res.json()) as { ok: boolean; url?: string; mensagem?: string };
      if (j.ok && j.url) {
        setAnterior((a) => a ?? valor);
        ed.alterar(caminho, j.url);
      } else setErroLocal(j.mensagem ?? "Não foi possível enviar a foto. Verifique a internet e tente de novo.");
    } catch {
      setErroLocal("Não foi possível enviar a foto. Verifique a internet e tente de novo.");
    } finally {
      setEnviando(false);
      ed.enviando(-1);
    }
  }

  return (
    <div className={`campo campo-foto${erro ? " campo-erro" : ""}`} role="group" aria-labelledby={`${id}-rot`}>
      <p id={`${id}-rot`} className="rotulo">{campo.rotulo}</p>
      <div className="foto-linha">
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de ferramenta interna, URL externa (Blob ou site) */}
        {miniatura ? <img src={miniatura} alt={nome} className={enviando ? "esmaecida" : ""} /> : <span className="foto-vazia" aria-hidden="true">sem prévia</span>}
        <div>
          <p className="foto-nome">{valor.startsWith("img/") ? `Imagem atual do site (${valor.split("/").at(-1)})` : valor ? "Foto enviada pelo painel" : "Sem foto"}</p>
          {anterior !== null && !enviando && <p><Etiqueta tom="aviso">Nova, ainda não publicada</Etiqueta></p>}
          {enviando && <p role="status">Enviando...</p>}
          <div className="linha-botoes">
            <button type="button" id={id} className="botao botao-secundario" disabled={enviando} aria-describedby={`${id}-desc`} onClick={() => entrada.current?.click()}>Trocar foto</button>
            {anterior !== null && !enviando && (
              <button type="button" className="botao botao-link" onClick={() => { ed.alterar(caminho, anterior); setAnterior(null); setErroLocal(null); }}>Voltar à foto anterior</button>
            )}
          </div>
          <input ref={entrada} type="file" hidden accept="image/jpeg,image/png,image/webp" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviar(f); }} />
        </div>
      </div>
      {erro
        ? <p id={`${id}-desc`} className="erro-texto"><span aria-hidden="true">! </span>{erro}</p>
        : <p id={`${id}-desc`} className="ajuda">JPEG, PNG ou WebP, até 4,5 MB. Use imagens com pelo menos 1200 px de largura; fotos muito pesadas deixam o site lento.</p>}
    </div>
  );
}

function mover<T>(lista: T[], de: number, delta: -1 | 1): T[] {
  const copia = [...lista];
  const [x] = copia.splice(de, 1);
  copia.splice(de + delta, 0, x as T);
  return copia;
}

function BotaoMover({ id, i, n, delta, nome, aoMover }: { id: string; i: number; n: number; delta: -1 | 1; nome: string; aoMover: () => void }) {
  const desabilitado = delta === -1 ? i === 0 : i === n - 1;
  return (
    <button type="button" id={id} className="botao botao-icone" disabled={desabilitado} aria-label={`Mover ${nome} para ${delta === -1 ? "cima" : "baixo"}`} onClick={aoMover}>
      <span aria-hidden="true">{delta === -1 ? "↑" : "↓"}</span>
    </button>
  );
}

function ListaEditavel({ campo, valor, caminho }: { campo: Extract<Campo, { tipo: "lista" }>; valor: Valor[]; caminho: Caminho }) {
  const ed = useEditor();
  const id = idDe(caminho);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const n = valor.length;
  const colapsavel = n > 5;
  const resumoDe = (it: Valor) => String(it[campo.titulo] ?? "").trim();

  const trocar = (nova: Valor[]) => { ed.limparErros(); ed.alterar(caminho, nova); };
  const mudar = (i: number, delta: -1 | 1) => {
    trocar(mover(valor, i, delta));
    ed.anunciar(`${campo.item} movid${campo.artigo} para a posição ${i + delta + 1} de ${n}`);
    ed.focar(`${id}-${i + delta}-${delta === -1 ? "sobe" : "desce"}`, `${id}-${i + delta}-${delta === -1 ? "desce" : "sobe"}`);
  };
  const adicionar = () => {
    const novo = { ...paraEstado({}, campo.campos, true), _k: `n${Date.now()}${n}` };
    trocar([...valor, novo]);
    ed.anunciar(`${campo.item} ${n + 1} adicionad${campo.artigo}`);
    ed.focar(idDe([...caminho, n, campo.campos[0]?.chave ?? ""]));
  };
  const remover = (i: number) => {
    const it = valor[i] as Valor;
    ed.pedirConfirmacao({
      titulo: `Remover ${campo.item.toLowerCase()}`,
      texto: `Remover ${campo.artigo} ${campo.item.toLowerCase()}${resumoDe(it) ? ` "${resumoDe(it)}"` : ""}? ${campo.artigo === "o" ? "Ele" : "Ela"} sai do site quando você publicar.`,
      ok: "Remover",
      perigo: true,
      aoConfirmar: () => { trocar(valor.filter((_, k) => k !== i)); ed.anunciar(`${campo.item} removid${campo.artigo}`); ed.focar(`${id}-adicionar`); },
    });
  };

  return (
    <fieldset className="lista">
      <legend>{campo.rotulo}</legend>
      <ol>
        {valor.map((it, i) => {
          const cam = [...caminho, i];
          const prefixo = `${cam.join(".")}.`;
          const temErro = Object.keys(ed.erros).some((k) => k.startsWith(prefixo));
          const aberto = !colapsavel || !recolhidos.has(String(it._k)) || temErro;
          const nome = `${campo.item} ${i + 1}`;
          return (
            <li key={String(it._k)}>
              <fieldset className="item">
                <legend className="so-leitor">{nome}</legend>
                <div className="item-cabecalho">
                  <div className="item-titulo">
                    <strong>{nome} de {n}</strong>
                    {resumoDe(it) && <span className="item-resumo">{resumoDe(it)}</span>}
                    {temErro && <Etiqueta tom="erro">Tem erro</Etiqueta>}
                  </div>
                  <div className="item-acoes">
                    {colapsavel && (
                      <button type="button" className="botao botao-link" aria-expanded={aberto} disabled={temErro}
                        onClick={() => setRecolhidos((s) => { const x = new Set(s); if (x.has(String(it._k))) x.delete(String(it._k)); else x.add(String(it._k)); return x; })}>
                        {aberto ? "Recolher" : "Expandir"}
                      </button>
                    )}
                    <BotaoMover id={`${id}-${i}-sobe`} i={i} n={n} delta={-1} nome={nome} aoMover={() => mudar(i, -1)} />
                    <BotaoMover id={`${id}-${i}-desce`} i={i} n={n} delta={1} nome={nome} aoMover={() => mudar(i, 1)} />
                    <button type="button" className="botao botao-perigo" disabled={n === 1} title={n === 1 ? "A lista precisa de pelo menos um item" : undefined} aria-label={`Remover ${nome}`} onClick={() => remover(i)}>Remover</button>
                  </div>
                </div>
                {aberto && <div className="item-corpo"><Campos campos={campo.campos} valor={it} caminho={cam} /></div>}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {ed.erros[caminho.join(".")] && <p className="erro-texto" id={`${id}-desc`}><span aria-hidden="true">! </span>{ed.erros[caminho.join(".")]}</p>}
      <button type="button" id={`${id}-adicionar`} className="botao botao-secundario" onClick={adicionar}>{campo.adicionar}</button>
    </fieldset>
  );
}

function ListaTextos({ campo, valor, caminho }: { campo: Extract<Campo, { tipo: "textos" }>; valor: { _k: string; _v: string }[]; caminho: Caminho }) {
  const ed = useEditor();
  const id = idDe(caminho);
  const n = valor.length;
  const trocar = (nova: typeof valor) => { ed.limparErros(); ed.alterar(caminho, nova); };

  return (
    <fieldset className="lista lista-textos">
      <legend>{campo.rotulo}</legend>
      <ol>
        {valor.map((it, i) => {
          const cam = [...caminho, i];
          const idc = idDe(cam);
          const erro = ed.erros[cam.join(".")];
          const nome = `${campo.item} ${i + 1}`;
          const muda = (delta: -1 | 1) => {
            trocar(mover(valor, i, delta));
            ed.anunciar(`${nome} movido para a posição ${i + delta + 1} de ${n}`);
            ed.focar(`${id}-${i + delta}-${delta === -1 ? "sobe" : "desce"}`, `${id}-${i + delta}-${delta === -1 ? "desce" : "sobe"}`);
          };
          return (
            <li key={it._k} className={erro ? "campo-erro" : ""}>
              <div className="linha-texto">
                <input id={idc} type="text" aria-label={nome} value={it._v} onChange={(e) => ed.alterar([...cam, "_v"], e.target.value)} onBlur={() => ed.aoSair(cam)} {...descricao(idc, erro)} />
                <BotaoMover id={`${id}-${i}-sobe`} i={i} n={n} delta={-1} nome={nome} aoMover={() => muda(-1)} />
                <BotaoMover id={`${id}-${i}-desce`} i={i} n={n} delta={1} nome={nome} aoMover={() => muda(1)} />
                <button type="button" className="botao botao-perigo" disabled={n === 1} title={n === 1 ? "A lista precisa de pelo menos um item" : undefined} aria-label={`Remover ${nome}`}
                  onClick={() => { trocar(valor.filter((_, k) => k !== i)); ed.anunciar(`${nome} removido`); ed.focar(`${id}-adicionar`); }}>Remover</button>
              </div>
              {erro && <p id={`${idc}-desc`} className="erro-texto"><span aria-hidden="true">! </span>{erro}</p>}
            </li>
          );
        })}
      </ol>
      <button type="button" id={`${id}-adicionar`} className="botao botao-secundario" onClick={() => { trocar([...valor, { _k: `n${Date.now()}${n}`, _v: "" }]); ed.anunciar(`${campo.item} ${n + 1} adicionado`); ed.focar(idDe([...caminho, n])); }}>
        {campo.adicionar}
      </button>
    </fieldset>
  );
}

// ---------- Diálogo de confirmação ----------

function Dialogo({ confirmacao, aoFechar }: { confirmacao: Confirmacao | null; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (confirmacao && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-foco-inicial]")?.focus(); // foco no botão seguro (cancelar)
    } else if (!confirmacao && d.open) d.close();
  }, [confirmacao]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-titulo" onClose={aoFechar}>
      {confirmacao && (
        <>
          <h2 id="modal-titulo">{confirmacao.titulo}</h2>
          <p>{confirmacao.texto}</p>
          <div className="linha-botoes">
            <button type="button" data-foco-inicial className="botao botao-secundario" onClick={aoFechar}>{confirmacao.cancelar ?? "Cancelar"}</button>
            <button type="button" className={`botao ${confirmacao.perigo ? "botao-perigo" : "botao-primario"}`} onClick={() => { const f = confirmacao.aoConfirmar; aoFechar(); f(); }}>{confirmacao.ok}</button>
          </div>
        </>
      )}
    </dialog>
  );
}

// ---------- Editor ----------

export function BlocoEditor({ slug, nome, campos, inicial, versaoBase, pendente: pendenteInicial, siteUrl }: {
  slug: Bloco;
  nome: string;
  campos: Campo[];
  inicial: unknown;
  versaoBase: number;
  pendente: boolean;
  siteUrl: string;
}) {
  const router = useRouter();
  const schema = BLOCOS[slug].schema;
  const [estado, setEstado] = useState<Valor>(() => paraEstado(inicial, campos));
  const [publicado, setPublicado] = useState(() => JSON.stringify(paraEnvio(paraEstado(inicial, campos), campos)));
  const [geracao, setGeracao] = useState(0); // muda quando o estado é trocado por inteiro (remonta os campos)
  const [base, setBase] = useState(versaoBase);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [resumoAberto, setResumoAberto] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [lento, setLento] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [falhas, setFalhas] = useState(0);
  const [fotosEnviando, setFotosEnviando] = useState(0);
  const [pendente, setPendente] = useState(pendenteInicial);
  const [esperaRetry, setEsperaRetry] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const avisoRef = useRef<HTMLDivElement>(null);
  const resumoRef = useRef<HTMLDivElement>(null);
  const focoPedido = useRef<string[] | null>(null);

  const alterado = JSON.stringify(paraEnvio(estado, campos)) !== publicado;

  const validar = useCallback((e: Valor): Record<string, string> => {
    const r = schema.safeParse(paraEnvio(e, campos));
    const out: Record<string, string> = {};
    if (!r.success) for (const x of errosDe(r.error)) out[x.caminho] ??= x.mensagem;
    return out;
  }, [schema, campos]);

  // foco pedido por quem mexeu na lista (depois de renderizar o novo estado)
  useEffect(() => {
    const ids = focoPedido.current;
    if (!ids) return;
    focoPedido.current = null;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && !(el as HTMLButtonElement).disabled) { el.focus(); break; }
    }
  });

  // publicação em andamento (de qualquer pessoa): consulta a cada 5 s, até ~2,5 min (a pendente expira em 2 no banco)
  useEffect(() => {
    if (!pendente) return;
    let tentativas = 0;
    const t = setInterval(async () => {
      tentativas++;
      const s = await consultarSituacao();
      if ((s && !s.pendente) || tentativas >= 30) { clearInterval(t); setPendente(false); }
    }, 5000);
    return () => clearInterval(t);
  }, [pendente]);

  // aviso antes de perder a edição: fechar/recarregar (nativo) e links do painel (diálogo)
  useEffect(() => {
    if (!alterado) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      const href = a?.getAttribute("href");
      if (!a || !href || href.startsWith("#") || a.target === "_blank" || a.hasAttribute("download")) return;
      const u = new URL(a.href);
      if (u.origin !== location.origin || u.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setConfirmacao({ titulo: "Sair sem publicar?", texto: "Você tem alterações não publicadas neste bloco. Se sair, elas se perdem.", ok: "Sair sem publicar", perigo: true, cancelar: "Continuar editando", aoConfirmar: () => router.push(u.pathname + u.search) });
    };
    window.addEventListener("beforeunload", antes);
    document.addEventListener("click", clique, true);
    return () => { window.removeEventListener("beforeunload", antes); document.removeEventListener("click", clique, true); };
  }, [alterado, router]);

  const alterar = useCallback((caminho: Caminho, v: unknown) => {
    const novo = definir(estado, caminho, v);
    setEstado(novo);
    const chave = caminho.filter((c) => c !== "_v").join(".");
    if (erros[chave]) setErros((e) => { const todos = validar(novo); const n = { ...e }; if (todos[chave]) n[chave] = todos[chave]; else delete n[chave]; return n; });
  }, [estado, erros, validar]);

  const aoSair = useCallback((caminho: Caminho) => {
    const chave = caminho.join(".");
    const todos = validar(estado);
    setErros((e) => { const n = { ...e }; if (todos[chave]) n[chave] = todos[chave]; else delete n[chave]; return n; });
  }, [estado, validar]);

  const ctx: Ctx = {
    erros,
    siteUrl,
    alterar,
    aoSair,
    limparErros: () => { setErros({}); setResumoAberto(false); },
    pedirConfirmacao: setConfirmacao,
    anunciar: setAnuncio,
    focar: (...ids) => { focoPedido.current = ids; },
    enviando: (d) => setFotosEnviando((x) => x + d),
  };

  function carregar(dados: unknown, novaBase: number) {
    const e = paraEstado(dados, campos);
    setEstado(e);
    setPublicado(JSON.stringify(paraEnvio(e, campos)));
    setGeracao((g) => g + 1);
    setErros({});
    setResumoAberto(false);
    setBase(novaBase);
    setResultado(null);
  }

  async function publicar(baseUsada: number) {
    const todos = validar(estado);
    if (Object.keys(todos).length) {
      setErros(todos);
      setResumoAberto(true);
      setResultado(null);
      requestAnimationFrame(() => resumoRef.current?.focus());
      return;
    }
    setErros({});
    setResumoAberto(false);
    setResultado(null);
    setPublicando(true);
    setLento(false);
    const timer = setTimeout(() => setLento(true), 10_000);
    let r: RespostaPublicar | null = null;
    try {
      r = await publicarBloco(slug, paraEnvio(estado, campos), baseUsada);
    } catch {
      r = null; // nem chegou ao servidor
    } finally {
      clearTimeout(timer);
      setPublicando(false);
    }
    const mostrar = (x: Resultado) => { setResultado(x); requestAnimationFrame(() => avisoRef.current?.focus()); };
    if (!r) { mostrar({ tipo: "rede" }); return; }
    switch (r.tipo) {
      case "publicado":
        setPublicado(JSON.stringify(paraEnvio(estado, campos)));
        setGeracao((g) => g + 1); // remonta: some a etiqueta "Nova, ainda não publicada"
        setBase(r.numero);
        setFalhas(0);
        setResultado({ tipo: "publicado", aviso: r.aviso });
        requestAnimationFrame(() => avisoRef.current?.focus());
        break;
      case "invalido": {
        const e: Record<string, string> = {};
        for (const x of r.erros) e[x.caminho] ??= x.mensagem;
        setErros(e);
        setResumoAberto(true);
        requestAnimationFrame(() => resumoRef.current?.focus());
        break;
      }
      case "conflito":
        mostrar({ tipo: "conflito", versaoBase: r.versaoBase, blocos: r.blocosAlterados, mesmoBloco: r.mesmoBloco, atual: r.atual });
        break;
      case "em_andamento":
        setPendente(true);
        setEsperaRetry(true);
        setTimeout(() => setEsperaRetry(false), 5000);
        mostrar({ tipo: "em_andamento" });
        break;
      case "falha_disparo":
        setBase(r.versaoBase);
        setFalhas((f) => f + 1);
        mostrar({ tipo: "falha", repetida: falhas + 1 >= 2 });
        break;
      case "erro":
        setFalhas((f) => f + 1);
        mostrar({ tipo: "falha", repetida: falhas + 1 >= 2 });
        break;
      case "sem_permissao":
      case "sessao_expirada":
      case "sem_conteudo":
        mostrar({ tipo: r.tipo });
        break;
    }
  }

  const bloqueado = publicando;
  const podePublicar = alterado && !publicando && fotosEnviando === 0 && !pendente;
  const situacao = publicando ? "Publicando..."
    : pendente ? "Há uma publicação em andamento. Aguarde alguns instantes para publicar."
    : fotosEnviando > 0 ? "Aguarde o envio da foto terminar."
    : alterado ? "Alterações não publicadas. Ao publicar, o site mostra a mudança em até alguns minutos."
    : "Nenhuma alteração para publicar.";
  const nErros = Object.keys(erros).length;

  const confirmarCarregar = (c: Extract<Resultado, { tipo: "conflito" }>) => setConfirmacao({
    titulo: "Carregar a versão atual?",
    texto: "Isso troca o que você digitou pela versão atual. Quer continuar?",
    ok: "Carregar a versão atual",
    perigo: true,
    aoConfirmar: () => carregar(c.atual, c.versaoBase),
  });

  return (
    <EditorCtx.Provider value={ctx}>
      <div className="editor">
        {alterado && <p><Etiqueta tom="aviso">Alterações não publicadas</Etiqueta></p>}

        {resumoAberto && nErros > 0 && (
          <Aviso tipo="erro" refEl={resumoRef} titulo={`Não publicado. Corrija ${nErros} ${nErros === 1 ? "campo" : "campos"} abaixo.`}>
            <p>O site continua como estava.</p>
            <ul className="resumo-erros">
              {Object.entries(erros).map(([k, msg]) => {
                const cam = k.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p));
                return (
                  <li key={k}>
                    <a href={`#${idDe(cam)}`} onClick={(e) => { e.preventDefault(); document.getElementById(idDe(cam))?.focus(); }}>{descreverCaminho(campos, cam)}</a>: {msg}
                  </li>
                );
              })}
            </ul>
          </Aviso>
        )}

        {resultado?.tipo === "publicado" && (
          <Aviso tipo="sucesso" titulo="Publicado." refEl={avisoRef}>
            <p>O site mostra a mudança em até alguns minutos (normalmente até 5). Se não mudar depois disso, avise o responsável técnico.</p>
            {resultado.aviso && <p><strong>Atenção:</strong> {resultado.aviso}</p>}
            <p className="aviso-links"><Link href="/admin/conteudo">Voltar à lista de blocos</Link> · <button type="button" className="botao botao-link" onClick={() => setResultado(null)}>Continuar editando</button></p>
          </Aviso>
        )}
        {resultado?.tipo === "falha" && (
          <Aviso tipo="erro" titulo="Não foi possível publicar, tente de novo." refEl={avisoRef}
            acoes={<button type="button" className="botao botao-primario" disabled={!podePublicar} onClick={() => void publicar(base)}>Tentar de novo</button>}>
            <p>O site continua como estava; nada foi alterado. O que você digitou está aqui, nada foi perdido.{resultado.repetida && " Se continuar, avise o responsável técnico."}</p>
          </Aviso>
        )}
        {resultado?.tipo === "rede" && (
          <Aviso tipo="erro" titulo="Sem conexão. Verifique a internet e tente de novo." refEl={avisoRef}>
            <p>O que você digitou está aqui, nada foi perdido.</p>
          </Aviso>
        )}
        {resultado?.tipo === "conflito" && (
          <Aviso tipo="aviso" titulo="Outra pessoa publicou enquanto você editava." refEl={avisoRef}
            acoes={
              <>
                {resultado.mesmoBloco ? (
                  <>
                    <button type="button" className="botao botao-secundario" onClick={() => confirmarCarregar(resultado)}>Carregar a versão atual</button>
                    <button type="button" className="botao botao-perigo" onClick={() => setConfirmacao({
                      titulo: "Publicar a minha por cima?",
                      texto: "Isso substitui o que a outra pessoa publicou neste bloco. A versão dela continua no histórico.",
                      ok: "Publicar a minha",
                      perigo: true,
                      aoConfirmar: () => { setBase(resultado.versaoBase); void publicar(resultado.versaoBase); },
                    })}>Publicar a minha por cima</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="botao botao-primario" onClick={() => { setBase(resultado.versaoBase); void publicar(resultado.versaoBase); }}>Publicar o meu bloco</button>
                    <button type="button" className="botao botao-secundario" onClick={() => confirmarCarregar(resultado)}>Carregar a versão atual</button>
                  </>
                )}
              </>
            }>
            <p>
              {resultado.mesmoBloco
                ? "A outra publicação mudou este bloco."
                : `A outra publicação mudou ${resultado.blocos.map((b) => `"${BLOCOS[b].nome}"`).join(", ")}. O bloco que você está editando não foi alterado.`}
              {" "}O que você digitou continua aqui.
            </p>
          </Aviso>
        )}
        {resultado?.tipo === "em_andamento" && (
          <Aviso tipo="informacao" titulo="Há uma publicação em andamento. Tente de novo em instantes." refEl={avisoRef}
            acoes={<button type="button" className="botao botao-secundario" disabled={esperaRetry || pendente || !alterado} onClick={() => void publicar(base)}>Tentar de novo</button>}>
            <p>O que você digitou está aqui, nada foi perdido.</p>
          </Aviso>
        )}
        {resultado?.tipo === "sem_permissao" && <Aviso tipo="erro" titulo="Sem permissão." refEl={avisoRef}><p>Seu acesso não permite editar o conteúdo do site. Peça ao responsável da loja.</p></Aviso>}
        {resultado?.tipo === "sessao_expirada" && (
          <Aviso tipo="erro" titulo="Sua sessão expirou. Entre de novo." refEl={avisoRef}>
            <p>O que você digitou continua nesta tela. <a href="/entrar" target="_blank" rel="noopener">Entrar em uma nova aba</a>, volte aqui e publique de novo.</p>
          </Aviso>
        )}
        {resultado?.tipo === "sem_conteudo" && <Aviso tipo="erro" titulo="O conteúdo inicial ainda não foi carregado." refEl={avisoRef}><p>Avise o responsável técnico.</p></Aviso>}
        {pendente && resultado?.tipo !== "em_andamento" && (
          <Aviso tipo="informacao" titulo="Há uma publicação em andamento. Aguarde alguns instantes para publicar." />
        )}

        <form className="cartao" noValidate onSubmit={(e) => e.preventDefault() /* Enter num campo não publica: só o botão Publicar */}>
          <fieldset disabled={bloqueado} className="form-bloco">
            <legend className="so-leitor">{nome}</legend>
            <Campos key={geracao} campos={campos} valor={estado} caminho={[]} />
          </fieldset>
        </form>

        <div className="so-leitor" aria-live="polite">{anuncio}</div>
        <div className="barra-publicar" role="region" aria-label="Publicar">
          <div className="barra-texto">
            <p role="status">{situacao}</p>
            {lento && publicando && <p className="ajuda">Isso está demorando mais que o normal. Não feche esta página.</p>}
          </div>
          <div className="barra-acoes">
            {alterado && !publicando && (
              <button type="button" className="botao botao-link" onClick={() => setConfirmacao({
                titulo: "Descartar alterações?",
                texto: "O que você digitou neste bloco será trocado pela versão publicada.",
                ok: "Descartar",
                perigo: true,
                aoConfirmar: () => carregar(JSON.parse(publicado), base),
              })}>Descartar alterações</button>
            )}
            <button type="button" className="botao botao-primario" disabled={!podePublicar} aria-busy={publicando} onClick={() => void publicar(base)}>
              {publicando ? <><span className="giro" aria-hidden="true" /> Publicando...</> : `Publicar ${nome}`}
            </button>
          </div>
        </div>
        <Dialogo confirmacao={confirmacao} aoFechar={() => setConfirmacao(null)} />
      </div>
    </EditorCtx.Provider>
  );
}
