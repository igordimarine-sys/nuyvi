// Servidor local do site com recarga automática. Sem dependências: `node dev.mjs` (yarn dev / yarn dev:painel).
// Monta o index.html em memória com o mesmo `montar` do build.mjs e NUNCA grava o index.html versionado.
// O navegador recarrega sozinho quando:
//   - um arquivo de site/ é salvo (HTML, CSS, JS, imagens, conteudo/*.json);
//   - CONTEUDO_URL definida: alguém publica no painel. Sem consulta periódica: a loja local chama
//     POST /__publicado (SITE_DEPLOY_HOOK_URL=http://127.0.0.1:8765/__publicado em loja/.env.local), como o deploy
//     hook faz na Vercel, e só então o conteúdo é lido. Também lê uma vez ao iniciar.
// LOJA_URL e BLOB_PUBLIC_HOST: mesmas variáveis do build.mjs.
import { createServer } from 'node:http';
import { readFileSync, watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { montar, urlSegura } from './build.mjs';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));
const PORTA = Number(process.env.PORT ?? 8765);
const CONTEUDO_URL = process.env.CONTEUDO_URL ? urlSegura(process.env.CONTEUDO_URL, 'CONTEUDO_URL') : null;
const LOJA_URL = process.env.LOJA_URL ? urlSegura(process.env.LOJA_URL, 'LOJA_URL').href.replace(/\/$/, '') : '';
const BLOB_HOST = process.env.BLOB_PUBLIC_HOST ?? '';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};
const RECARGA = `<script>new EventSource('/__recarga').onmessage=()=>location.reload()</script>`;

const ler = nome => JSON.parse(readFileSync(join(RAIZ, 'conteudo', `${nome}.json`), 'utf8'));
const dadosLocais = () => ({ textos: ler('textos'), loja: ler('loja'), explore: ler('explore'), novidades: ler('novidades'), planos: ler('planos') });

let dadosPainel = null; // última versão publicada lida da loja
let versaoPainel = null;
let pagina = null; // index.html montado, já com o script de recarga
const clientes = new Set();

function remontar(motivo) {
  try {
    const dados = CONTEUDO_URL ? dadosPainel : dadosLocais();
    if (!dados) return; // ainda sem conteúdo da loja
    const { html } = montar(readFileSync(join(RAIZ, 'index.html'), 'utf8'), dados, { lojaUrl: LOJA_URL, blobHost: BLOB_HOST });
    pagina = html.replace(/<\/body>/i, `${RECARGA}</body>`);
    console.log(`[site] página montada (${motivo})`);
    for (const res of clientes) res.write('data: recarregar\n\n');
  } catch (e) {
    console.error(`[site] não montou (${motivo}): ${e.message}. Mantendo a página anterior.`);
  }
}

// Lê a última versão publicada. Após o aviso da loja, a versão nova só fica "aceita" depois que o hook responde,
// então tenta algumas vezes (até ~5 s) até o número mudar. Não há consulta fora disso.
async function lerPainel(motivo, esperarNova = false) {
  for (let tentativa = 0; tentativa < (esperarNova ? 10 : 1); tentativa++) {
    if (tentativa) await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch(CONTEUDO_URL, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (res.status !== 200) throw new Error(`respondeu ${res.status}${res.status === 404 ? ' (nada publicado ainda)' : ''}`);
      const versao = res.headers.get('x-conteudo-versao');
      if (esperarNova && versao !== null && versao === versaoPainel) { await res.body?.cancel(); continue; }
      dadosPainel = await res.json();
      versaoPainel = versao;
      return remontar(`${motivo}: versão ${versao ?? '?'}`);
    } catch (e) {
      return console.error(`[site] não consegui ler ${CONTEUDO_URL.href} (${motivo}): ${e.message}`);
    }
  }
  console.error(`[site] ${motivo}: a versão publicada não mudou`);
}

// Salvou arquivo em site/: index.html ou conteudo/*.json remontam; o resto só recarrega o navegador.
let espera = null;
watch(RAIZ, { recursive: true }, (_evento, arquivo) => {
  if (!arquivo || arquivo.startsWith('node_modules') || arquivo.startsWith('.')) return;
  clearTimeout(espera);
  espera = setTimeout(() => {
    if (arquivo === 'index.html' || arquivo.startsWith(`conteudo${sep}`)) return remontar(`${arquivo} salvo`);
    console.log(`[site] ${arquivo} salvo`);
    for (const res of clientes) res.write('data: recarregar\n\n');
  }, 100);
});

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (caminho === '/__recarga') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': ok\n\n');
    clientes.add(res);
    req.on('close', () => clientes.delete(res));
    return;
  }
  if (caminho === '/__publicado') {
    if (req.method !== 'POST' || !CONTEUDO_URL) { res.writeHead(CONTEUDO_URL ? 405 : 404); return res.end(); }
    res.writeHead(200).end(); // responde já, como o deploy hook: a loja só marca a versão como aceita depois disso
    lerPainel('publicado no painel', true);
    return;
  }
  if (caminho === '/' || caminho === '/index.html') {
    if (!pagina) { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Sem conteúdo do painel: suba a loja e publique, ou reinicie (veja o terminal).'); }
    res.writeHead(200, { 'Content-Type': TIPOS['.html'], 'Cache-Control': 'no-store' });
    return res.end(pagina);
  }
  const arquivo = normalize(join(RAIZ, caminho));
  if (!arquivo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  try {
    const corpo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(corpo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Não encontrado');
  }
}).listen(PORTA, '127.0.0.1', () => {
  console.log(`[site] http://127.0.0.1:${PORTA}  (conteúdo: ${CONTEUDO_URL ? `painel em ${CONTEUDO_URL.href}` : 'conteudo/*.json'})`);
  if (CONTEUDO_URL) lerPainel('início'); else remontar('início');
});
