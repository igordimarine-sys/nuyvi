"use client";

import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import OutlinedInput from "@mui/material/OutlinedInput";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { BLOCOS, errosDe, type Bloco } from "@/modules/conteudo-site/schema";
import { publicarBloco, type RespostaPublicar } from "./actions";
import type { Campo } from "./campos";
import { definir, descreverCaminho, folhas, idDe, paraEnvio, paraEstado, type Caminho, type Valor } from "./estado";
import { Aviso, Etiqueta } from "./ui";

// Editor de UM bloco (spec UI, seções 6 e 7): estado só na tela, validação inline com as regras do servidor (zod),
// publicar sozinho o bloco, e o digitado nunca se perde por erro, conflito ou falha do disparo.
const TAMANHO_MAXIMO = 4_500_000; // igual ao servidor (modules/conteudo-site/foto.ts); o servidor confere de novo
const FORMATOS = ["image/jpeg", "image/png", "image/webp"];
const FORMATOS_VIDEO = ["video/mp4", "video/webm"];

type Confirmacao = { titulo: string; texto: string; ok: string; perigo?: boolean; cancelar?: string; aoConfirmar: () => void };

type Resultado =
  | { tipo: "publicado" }
  | { tipo: "falha"; repetida: boolean }
  | { tipo: "rede" }
  | { tipo: "conflito"; versaoBase: number; blocos: Bloco[]; mesmoBloco: boolean; atual: unknown }
  | { tipo: "sem_permissao" }
  | { tipo: "sessao_expirada" }
  | { tipo: "sem_conteudo" };

type Ctx = {
  erros: Record<string, string>;
  alterar: (caminho: Caminho, v: unknown) => void;
  aoSair: (caminho: Caminho) => void;
  limparErros: () => void;
  pedirConfirmacao: (c: Confirmacao) => void;
  anunciar: (msg: string) => void;
  focar: (...ids: string[]) => void;
  enviando: (delta: 1 | -1, midia?: "foto" | "video") => void;
  videos: string[];
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
    <FormControl fullWidth error={!!erro} className="campo">
      <FormLabel htmlFor={id} className="rotulo">{rotulo}{opcional && <> <Etiqueta>Opcional</Etiqueta></>}</FormLabel>
      {children}
      {ajuda && !erro && <FormHelperText id={`${id}-desc`}>{ajuda}</FormHelperText>}
      {erro && <FormHelperText id={`${id}-desc`} sx={{ fontWeight: 600 }}><span aria-hidden="true">! </span>{erro}</FormHelperText>}
    </FormControl>
  );
}

const descricao = (id: string, erro?: string, ajuda?: string) => ({ "aria-invalid": erro ? true : undefined, "aria-describedby": erro || ajuda ? `${id}-desc` : undefined });

function Campos({ campos, valor, caminho }: { campos: Campo[]; valor: Valor; caminho: Caminho }) {
  // o primeiro texto do grupo nomeia a foto na miniatura ("Capa de Gold")
  const primeiro = campos.find((x) => x.tipo === "texto");
  const contexto = primeiro ? String(valor[primeiro.chave] ?? "") : "";
  return (
    <>
      {campos.map((c) => c.tipo === "grupo"
        ? <Grupo key={c.chave} campo={c} valor={valor} caminho={caminho} />
        : <CampoGenerico key={c.chave} campo={c} valor={valor[c.chave]} caminho={[...caminho, c.chave]} contexto={contexto} />)}
    </>
  );
}

/** Grupo de campos (6.9): fieldset com título; abre sozinho se algum campo de dentro tem erro. */
function Grupo({ campo, valor, caminho }: { campo: Extract<Campo, { tipo: "grupo" }>; valor: Valor; caminho: Caminho }) {
  const ed = useEditor();
  const [recolhido, setRecolhido] = useState(false);
  const temErro = folhas(campo.campos).some((f) => Object.keys(ed.erros).some((k) => k === [...caminho, f.chave].join(".") || k.startsWith(`${[...caminho, f.chave].join(".")}.`)));
  const aberto = !recolhido || temErro;
  return (
    <fieldset className="grupo" id={`grupo-${campo.chave}`}>
      <legend tabIndex={-1}>{campo.rotulo} {temErro && <Etiqueta tom="erro">Tem erro</Etiqueta>}</legend>
      <Button size="small" aria-expanded={aberto} disabled={temErro} onClick={() => setRecolhido((x) => !x)}>{aberto ? "Recolher" : "Expandir"}</Button>
      {aberto && <Campos campos={campo.campos} valor={valor} caminho={caminho} />}
    </fieldset>
  );
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
          <OutlinedInput {...comuns} multiline={campo.longo} minRows={campo.longo ? 4 : undefined} value={String(valor ?? "")} onChange={(e) => alterar(e.target.value)} inputProps={descricao(id, erro, campo.ajuda)} />
        </Rotulado>
      );
    case "inteiro":
    case "preco":
      return (
        <Rotulado id={id} rotulo={campo.rotulo} ajuda={campo.ajuda} erro={erro}>
          <OutlinedInput {...comuns} value={String(valor ?? "")} onChange={(e) => alterar(e.target.value)} inputProps={{ inputMode: campo.tipo === "inteiro" ? "numeric" : "decimal", ...descricao(id, erro, campo.ajuda) }} />
        </Rotulado>
      );
    case "sim_nao":
      return (
        <div className="campo campo-caixa">
          <FormControlLabel control={<Checkbox {...comuns} checked={valor === true} onChange={(e) => alterar(e.target.checked)} />} label={campo.rotulo} />
        </div>
      );
    case "selecao": {
      const v = String(valor ?? "");
      return (
        <Rotulado id={id} rotulo={campo.rotulo} ajuda={campo.ajuda} erro={erro}>
          <Select native input={<OutlinedInput />} value={v} onChange={(e) => alterar(e.target.value)} onBlur={comuns.onBlur} inputProps={{ id, ...descricao(id, erro, campo.ajuda) }}>
            <option value="">{campo.vazio}</option>
            {v && !campo.opcoes.some((o) => o.valor === v) && <option value={v}>Opção que não existe mais</option>}
            {campo.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </Select>
        </Rotulado>
      );
    }
    case "video":
      return <CampoVideo campo={campo} valor={String(valor ?? "")} caminho={caminho} />;
    case "grupo":
      return null; // tratado em `Campos`
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
  const miniatura = valor.startsWith("http") ? valor : valor.startsWith("img/") ? `/${valor}` : null;
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
          {enviando && <p role="status" className="enviando"><CircularProgress size={16} aria-hidden="true" /> Enviando...</p>}
          <div className="linha-botoes">
            <Button id={id} variant="outlined" color="inherit" disabled={enviando} aria-describedby={`${id}-desc`} onClick={() => entrada.current?.click()}>Trocar foto</Button>
            {anterior !== null && !enviando && (
              <Button onClick={() => { ed.alterar(caminho, anterior); setAnterior(null); setErroLocal(null); }}>Voltar à foto anterior</Button>
            )}
          </div>
          <input ref={entrada} type="file" hidden accept="image/jpeg,image/png,image/webp" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviar(f); }} />
        </div>
      </div>
      {erro
        ? <FormHelperText error id={`${id}-desc`} sx={{ fontWeight: 600 }}><span aria-hidden="true">! </span>{erro}</FormHelperText>
        : <FormHelperText id={`${id}-desc`}>JPEG, PNG ou WebP, até 4,5 MB. Use imagens com pelo menos 1200 px de largura; fotos muito pesadas deixam o site lento.</FormHelperText>}
    </div>
  );
}

function CampoVideo({ campo, valor, caminho }: { campo: Extract<Campo, { tipo: "video" }>; valor: string; caminho: Caminho }) {
  const ed = useEditor();
  const id = idDe(caminho);
  const entrada = useRef<HTMLInputElement>(null);
  const cancelar = useRef<AbortController | null>(null);
  const [anterior, setAnterior] = useState<string | null>(null); // valor publicado, enquanto houver troca ainda não publicada
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const erro = erroLocal ?? ed.erros[caminho.join(".")];
  const origem = valor.startsWith("http") ? valor : valor ? `/${valor.replace(/^\//, "")}` : null;
  const doSite = valor.startsWith("video/");
  const nome = doSite ? valor.split("/").slice(1).join("/") : valor ? "Vídeo enviado pelo painel" : "Nenhum vídeo";

  const escolher = (novo: string) => { setErroLocal(null); setAnterior((a) => a ?? valor); ed.alterar(caminho, novo); };

  async function enviar(f: File) {
    setErroLocal(null);
    if (!FORMATOS_VIDEO.includes(f.type)) return setErroLocal("Formato não aceito. Envie MP4 ou WebM.");
    if (f.size > TAMANHO_MAXIMO) return setErroLocal(`Arquivo grande demais (${(f.size / 1_000_000).toFixed(1).replace(".", ",")} MB). O máximo é 4,5 MB.`);
    const abort = new AbortController();
    cancelar.current = abort;
    setEnviando(true);
    ed.enviando(1, "video");
    try {
      const dados = new FormData();
      dados.set("video", f);
      const res = await fetch("/api/conteudo-site/foto", { method: "POST", body: dados, signal: abort.signal });
      const j = (await res.json()) as { ok: boolean; url?: string; mensagem?: string };
      if (j.ok && j.url) {
        setAnterior((a) => a ?? valor);
        ed.alterar(caminho, j.url);
        setAviso(null);
      } else setErroLocal(j.mensagem ?? "Não foi possível enviar o vídeo. Verifique a internet e tente de novo.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") setAviso("Envio cancelado.");
      else setErroLocal("Não foi possível enviar o vídeo. Verifique a internet e tente de novo.");
    } finally {
      cancelar.current = null;
      setEnviando(false);
      ed.enviando(-1, "video");
      entrada.current?.focus();
    }
  }

  const naLista = ed.videos.includes(valor);
  return (
    <fieldset className={`campo campo-video${erro ? " campo-erro" : ""}`} aria-describedby={`${id}-desc`}>
      <legend>{campo.rotulo}{campo.opcional && <> <Etiqueta>Opcional</Etiqueta></>}</legend>
      {origem
        ? <video key={origem} className="video-previa" src={origem} controls muted playsInline preload="metadata" aria-label={`Prévia do vídeo: ${nome}`}>Não foi possível mostrar a prévia neste navegador. O vídeo continua valendo.</video>
        : <span className="foto-vazia" aria-hidden="true">sem vídeo</span>}
      <p className="foto-nome">{nome}</p>
      {anterior !== null && !enviando && <p><Etiqueta tom="aviso">{doSite ? "Alterado, ainda não publicado" : "Novo, ainda não publicado"}</Etiqueta></p>}
      {anterior !== null && !enviando && <p role="status" className="ajuda">Você trocou o vídeo. Confira se a imagem de espera combina com ele.</p>}
      <FormLabel htmlFor={id} className="rotulo">Vídeos que já estão no site</FormLabel>
      <Select native fullWidth input={<OutlinedInput />} disabled={enviando} value={valor} onChange={(e) => escolher(e.target.value)} onBlur={() => ed.aoSair(caminho)} inputProps={{ id }}>
        {campo.opcional && <option value="">Nenhum (usar o do computador)</option>}
        {!campo.opcional && !valor && <option value="">Escolha um vídeo</option>}
        {valor && !naLista && <option value={valor}>Vídeo enviado pelo painel (atual)</option>}
        {ed.videos.map((v) => <option key={v} value={v}>{v.replace(/^video\//, "")}</option>)}
      </Select>
      <div className="linha-botoes">
        <Button variant="outlined" color="inherit" disabled={enviando} onClick={() => entrada.current?.click()}>Enviar um vídeo novo</Button>
        {enviando && <Button onClick={() => cancelar.current?.abort()}>Cancelar envio</Button>}
        {anterior !== null && !enviando && <Button onClick={() => { ed.alterar(caminho, anterior); setAnterior(null); setErroLocal(null); }}>Voltar ao vídeo anterior</Button>}
      </div>
      {enviando && <div role="status" className="enviando-video"><LinearProgress aria-label="Enviando o vídeo" /> Enviando...</div>}
      <input ref={entrada} type="file" hidden accept="video/mp4,video/webm" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviar(f); }} />
      {aviso && !enviando && !erro && <p role="status" className="ajuda">{aviso}</p>}
      {erro
        ? <FormHelperText error id={`${id}-desc`} role="alert" sx={{ fontWeight: 600 }}><span aria-hidden="true">! </span>{erro}</FormHelperText>
        : <FormHelperText id={`${id}-desc`}>{campo.ajuda ? `${campo.ajuda} ` : ""}MP4 ou WebM, até 4,5 MB. É vídeo de fundo, sem som; de preferência com até 15 segundos.</FormHelperText>}
    </fieldset>
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
    <IconButton id={id} disabled={desabilitado} aria-label={`Mover ${nome} para ${delta === -1 ? "cima" : "baixo"}`} onClick={aoMover}>
      <span aria-hidden="true">{delta === -1 ? "↑" : "↓"}</span>
    </IconButton>
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
    if (campo.semConfirmar) { trocar(valor.filter((_, k) => k !== i)); ed.anunciar(`${campo.item} removid${campo.artigo}`); ed.focar(`${id}-adicionar`); return; }
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
                      <Button size="small" aria-expanded={aberto} disabled={temErro}
                        onClick={() => setRecolhidos((s) => { const x = new Set(s); if (x.has(String(it._k))) x.delete(String(it._k)); else x.add(String(it._k)); return x; })}>
                        {aberto ? "Recolher" : "Expandir"}
                      </Button>
                    )}
                    <BotaoMover id={`${id}-${i}-sobe`} i={i} n={n} delta={-1} nome={nome} aoMover={() => mudar(i, -1)} />
                    <BotaoMover id={`${id}-${i}-desce`} i={i} n={n} delta={1} nome={nome} aoMover={() => mudar(i, 1)} />
                    <Button variant="outlined" color="error" disabled={n === 1} title={n === 1 ? "A lista precisa de pelo menos um item" : undefined} aria-label={`Remover ${nome}`} onClick={() => remover(i)}>Remover</Button>
                  </div>
                </div>
                {aberto && <div className="item-corpo"><Campos campos={campo.campos} valor={it} caminho={cam} /></div>}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {ed.erros[caminho.join(".")] && <FormHelperText error id={`${id}-desc`} sx={{ fontWeight: 600, mb: 1 }}><span aria-hidden="true">! </span>{ed.erros[caminho.join(".")]}</FormHelperText>}
      <Button id={`${id}-adicionar`} variant="outlined" disabled={campo.max !== undefined && n >= campo.max} onClick={adicionar}>{campo.adicionar}</Button>
      {campo.max !== undefined && n >= campo.max && <p className="ajuda">O máximo é {campo.max} itens.</p>}
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
                <OutlinedInput id={idc} size="small" error={!!erro} value={it._v} onChange={(e) => ed.alterar([...cam, "_v"], e.target.value)} onBlur={() => ed.aoSair(cam)} inputProps={{ "aria-label": nome, ...descricao(idc, erro) }} sx={{ flex: "1 1 200px" }} />
                <BotaoMover id={`${id}-${i}-sobe`} i={i} n={n} delta={-1} nome={nome} aoMover={() => muda(-1)} />
                <BotaoMover id={`${id}-${i}-desce`} i={i} n={n} delta={1} nome={nome} aoMover={() => muda(1)} />
                <Button variant="outlined" color="error" disabled={n === 1} title={n === 1 ? "A lista precisa de pelo menos um item" : undefined} aria-label={`Remover ${nome}`}
                  onClick={() => { trocar(valor.filter((_, k) => k !== i)); ed.anunciar(`${nome} removido`); ed.focar(`${id}-adicionar`); }}>Remover</Button>
              </div>
              {erro && <FormHelperText error id={`${idc}-desc`} sx={{ fontWeight: 600 }}><span aria-hidden="true">! </span>{erro}</FormHelperText>}
            </li>
          );
        })}
      </ol>
      <Button id={`${id}-adicionar`} variant="outlined" onClick={() => { trocar([...valor, { _k: `n${Date.now()}${n}`, _v: "" }]); ed.anunciar(`${campo.item} ${n + 1} adicionado`); ed.focar(idDe([...caminho, n])); }}>
        {campo.adicionar}
      </Button>
    </fieldset>
  );
}

// ---------- Diálogo de confirmação ----------

function Dialogo({ confirmacao, aoFechar }: { confirmacao: Confirmacao | null; aoFechar: () => void }) {
  // guarda o último conteúdo para o texto não sumir durante a animação de saída
  const [ultima, setUltima] = useState<Confirmacao | null>(confirmacao);
  if (confirmacao && confirmacao !== ultima) setUltima(confirmacao);
  const c = confirmacao ?? ultima;
  return (
    <Dialog open={confirmacao !== null} onClose={aoFechar} aria-labelledby="modal-titulo" aria-describedby="modal-texto" maxWidth="xs" fullWidth>
      {c && (
        <>
          <DialogTitle id="modal-titulo">{c.titulo}</DialogTitle>
          <DialogContent><DialogContentText id="modal-texto">{c.texto}</DialogContentText></DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: "wrap", gap: 1 }}>
            {/* foco inicial no botão seguro (cancelar) */}
            <Button autoFocus variant="outlined" color="inherit" onClick={aoFechar}>{c.cancelar ?? "Cancelar"}</Button>
            <Button variant={c.perigo ? "outlined" : "contained"} color={c.perigo ? "error" : "primary"} onClick={() => { const f = c.aoConfirmar; aoFechar(); f(); }}>{c.ok}</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

// ---------- Editor ----------

export function BlocoEditor({ slug, nome, campos, inicial, versaoBase, videos }: {
  slug: Bloco;
  nome: string;
  campos: Campo[];
  inicial: unknown;
  versaoBase: number;
  videos: string[];
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
  const [videosEnviando, setVideosEnviando] = useState(0);
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
    alterar,
    aoSair,
    limparErros: () => { setErros({}); setResumoAberto(false); },
    pedirConfirmacao: setConfirmacao,
    anunciar: setAnuncio,
    focar: (...ids) => { focoPedido.current = ids; },
    enviando: (d, midia) => (midia === "video" ? setVideosEnviando : setFotosEnviando)((x) => x + d),
    videos,
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
        setResultado({ tipo: "publicado" });
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
  const podePublicar = alterado && !publicando && fotosEnviando === 0 && videosEnviando === 0;
  const situacao = publicando ? "Publicando..."
    : videosEnviando > 0 ? "Aguarde o envio do vídeo terminar."
    : fotosEnviando > 0 ? "Aguarde o envio da foto terminar."
    : alterado ? "Alterações não publicadas. Ao publicar, a mudança já aparece no site."
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
            <p>A mudança já está no site.</p>
            <p className="aviso-links"><a href={slug === "pagina-loja" ? "/loja" : "/"} target="_blank" rel="noopener">Ver no site<span className="so-leitor"> (abre em nova aba)</span></a> · <Link href="/admin/conteudo">Voltar à lista de blocos</Link> · <Button size="small" onClick={() => setResultado(null)}>Continuar editando</Button></p>
          </Aviso>
        )}
        {resultado?.tipo === "falha" && (
          <Aviso tipo="erro" titulo="Não foi possível publicar, tente de novo." refEl={avisoRef}
            acoes={<Button variant="contained" disabled={!podePublicar} onClick={() => void publicar(base)}>Tentar de novo</Button>}>
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
                    <Button variant="outlined" color="inherit" onClick={() => confirmarCarregar(resultado)}>Carregar a versão atual</Button>
                    <Button variant="outlined" color="error" onClick={() => setConfirmacao({
                      titulo: "Publicar a minha por cima?",
                      texto: "Isso substitui o que a outra pessoa publicou neste bloco. A versão dela continua no histórico.",
                      ok: "Publicar a minha",
                      perigo: true,
                      aoConfirmar: () => { setBase(resultado.versaoBase); void publicar(resultado.versaoBase); },
                    })}>Publicar a minha por cima</Button>
                  </>
                ) : (
                  <>
                    <Button variant="contained" onClick={() => { setBase(resultado.versaoBase); void publicar(resultado.versaoBase); }}>Publicar o meu bloco</Button>
                    <Button variant="outlined" color="inherit" onClick={() => confirmarCarregar(resultado)}>Carregar a versão atual</Button>
                  </>
                )}
              </>
            }>
            <p>
              {resultado.mesmoBloco
                ? "A outra publicação mudou este bloco."
                : resultado.blocos.length === 0
                  ? "O conteúdo mudou desde que você abriu; seu bloco não foi alterado."
                  : `A outra publicação mudou ${resultado.blocos.map((b) => `"${BLOCOS[b].nome}"`).join(", ")}. O bloco que você está editando não foi alterado.`}
              {" "}O que você digitou continua aqui.
            </p>
          </Aviso>
        )}
        {resultado?.tipo === "sem_permissao" && <Aviso tipo="erro" titulo="Sem permissão." refEl={avisoRef}><p>Seu acesso não permite editar o conteúdo do site. Peça ao responsável da loja.</p></Aviso>}
        {resultado?.tipo === "sessao_expirada" && (
          <Aviso tipo="erro" titulo="Sua sessão expirou. Entre de novo." refEl={avisoRef}>
            <p>O que você digitou continua nesta tela. <a href="/admin/login" target="_blank" rel="noopener">Entrar em uma nova aba</a>, volte aqui e publique de novo.</p>
          </Aviso>
        )}
        {resultado?.tipo === "sem_conteudo" && <Aviso tipo="erro" titulo="O conteúdo inicial ainda não foi carregado." refEl={avisoRef}><p>Avise o responsável técnico.</p></Aviso>}

        {campos.filter((c) => c.tipo === "grupo").length >= 3 && (
          <nav aria-label="Neste bloco" className="ancoras-grupos">
            <strong>Neste bloco:</strong>{" "}
            {campos.filter((c) => c.tipo === "grupo").map((c, i) => (
              <span key={c.chave}>{i > 0 && " · "}<a href={`#grupo-${c.chave}`} onClick={(e) => { e.preventDefault(); const el = document.getElementById(`grupo-${c.chave}`); el?.scrollIntoView(); el?.querySelector<HTMLElement>("legend")?.focus(); }}>{c.rotulo}</a></span>
            ))}
          </nav>
        )}

        <Paper component="form" variant="outlined" className="cartao" noValidate onSubmit={(e) => e.preventDefault() /* Enter num campo não publica: só o botão Publicar */}>
          <fieldset disabled={bloqueado} className="form-bloco">
            <legend className="so-leitor">{nome}</legend>
            <Campos key={geracao} campos={campos} valor={estado} caminho={[]} />
          </fieldset>
        </Paper>

        <div className="so-leitor" aria-live="polite">{anuncio}</div>
        <Paper square elevation={8} className="barra-publicar" role="region" aria-label="Publicar">
          <div className="barra-texto">
            <p role="status">{situacao}</p>
            {lento && publicando && <p className="ajuda">Isso está demorando mais que o normal. Não feche esta página.</p>}
          </div>
          <div className="barra-acoes">
            {alterado && !publicando && (
              <Button color="inherit" onClick={() => setConfirmacao({
                titulo: "Descartar alterações?",
                texto: "O que você digitou neste bloco será trocado pela versão publicada.",
                ok: "Descartar",
                perigo: true,
                aoConfirmar: () => carregar(JSON.parse(publicado), base),
              })}>Descartar alterações</Button>
            )}
            <Button variant="contained" size="large" disabled={!podePublicar} aria-busy={publicando} onClick={() => void publicar(base)}
              startIcon={publicando ? <CircularProgress size={16} color="inherit" aria-hidden="true" /> : undefined}>
              {publicando ? "Publicando..." : `Publicar ${nome}`}
            </Button>
          </div>
        </Paper>
        <Dialogo confirmacao={confirmacao} aoFechar={() => setConfirmacao(null)} />
      </div>
    </EditorCtx.Provider>
  );
}
