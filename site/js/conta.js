// Sessão visível no site (ADR-0007 A2, CA-LOJ-68 a 73). O HTML sai sempre no estado "visitante/carregando", igual para todos e em cache;
// aqui o navegador pergunta a sessão e troca o grupo de conta. Falha na pergunta = visitante. O nome só entra com textContent e
// nunca é guardado (nem localStorage, nem sessionStorage, nem cookie).

/** Estado a partir do corpo de GET /api/auth/get-session: `null`, resposta sem usuário ou inesperada = visitante. */
function resolverSessao(dados) {
  const user = dados && typeof dados === 'object' ? dados.user : null;
  if (!user || typeof user !== 'object') return { estado: 'visitante', nome: '' };
  const nome = typeof user.name === 'string' ? user.name.trim() : '';
  return { estado: user.role === 'operador' || user.role === 'admin' ? 'equipe' : 'cliente', nome: nome || 'Minha conta' };
}

/** Inicial maiúscula do nome (para o botão de conta). */
function inicialDe(nome) {
  const primeira = Array.from(String(nome).trim())[0];
  return primeira ? primeira.toLocaleUpperCase('pt-BR') : 'M';
}

/** Destino do botão de entrar: `/login` na página inicial (a volta padrão já é "/"), senão `/login?volta=<caminho atual>`. O servidor valida a volta. */
function enderecoDeLogin(caminho, busca) {
  return caminho === '/' ? '/login' : '/login?volta=' + encodeURIComponent(caminho + (busca || ''));
}

(function () {
  if (typeof document === 'undefined') return;
  const grupo = document.querySelector('[data-conta]');
  if (!grupo) return;
  const raiz = document.documentElement;
  const q = (s) => grupo.querySelector(s);
  const logada = q('[data-logada]'), toggle = q('[data-conta-toggle]'), painel = q('[data-conta-painel]');
  const nomeEl = q('[data-nome]'), inicialEl = q('[data-inicial]'), rotuloEl = q('[data-conta-rotulo]');
  const sair = q('[data-sair]'), aviso = q('[data-conta-aviso]'), erro = q('[data-conta-erro]');
  // o nome (ou o botão com a inicial) fica logo depois do botão de pausa, à frente dos outros botões; movido no DOM
  // (não só com CSS) para a ordem do Tab seguir a da tela. Em /loja não há pausa e ele fica no grupo.
  const pausa = document.querySelector('[data-pausa]');
  if (pausa) pausa.after(logada);
  // a partir de 1280 px (conta em linha) o "Sair" vai para depois de "Baixar", no início do grupo de conta;
  // abaixo disso volta para o painel que abre pelo botão com a inicial
  const largo = matchMedia('(min-width: 1280px)');
  const posicionarSair = () => { if (pausa && largo.matches) grupo.prepend(sair); else painel.append(sair); };
  posicionarSair();
  largo.addEventListener('change', posicionarSair);
  const entrar = [...document.querySelectorAll('[data-login]')];
  const destino = enderecoDeLogin(location.pathname, location.search);
  entrar.forEach((a) => { a.href = destino; });

  let timerErro = 0, resolvido = false;
  const abrir = (sim) => { logada.classList.toggle('aberto', sim); toggle.setAttribute('aria-expanded', String(sim)); };

  function aplicar(r) {
    resolvido = true;
    grupo.dataset.estado = r.estado;
    raiz.dataset.sessao = r.estado;
    const conectado = r.estado !== 'visitante';
    logada.hidden = !conectado;
    abrir(false);
    if (!conectado) return;
    nomeEl.textContent = r.nome;
    nomeEl.title = r.nome;
    inicialEl.textContent = inicialDe(r.nome);
    rotuloEl.textContent = 'Conta de ' + r.nome;
  }

  async function perguntar() {
    const abort = new AbortController();
    const limite = setTimeout(() => abort.abort(), 3000);
    try {
      const res = await fetch('/api/auth/get-session', { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' }, signal: abort.signal });
      aplicar(res.ok ? resolverSessao(await res.json()) : { estado: 'visitante', nome: '' });
    } catch (e) {
      aplicar({ estado: 'visitante', nome: '' });
    } finally {
      clearTimeout(limite);
    }
  }

  // se a resposta demora mais de 1,2 s, o botão de entrar aparece e é trocado quando ela chegar
  setTimeout(() => { if (!resolvido) { grupo.dataset.estado = 'visitante'; raiz.dataset.sessao = 'visitante'; } }, 1200);

  toggle.addEventListener('click', () => abrir(!logada.classList.contains('aberto')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && logada.classList.contains('aberto')) { abrir(false); toggle.focus(); } });
  document.addEventListener('click', (e) => { if (!logada.contains(e.target)) abrir(false); });
  logada.addEventListener('focusout', (e) => { if (e.relatedTarget && !logada.contains(e.relatedTarget)) abrir(false); });
  addEventListener('scroll', () => abrir(false), { passive: true });

  sair.addEventListener('click', async () => {
    if (sair.getAttribute('aria-disabled') === 'true') return;
    sair.setAttribute('aria-disabled', 'true');
    sair.style.opacity = '.6';
    erro.hidden = true;
    try {
      const res = await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!res.ok && res.status !== 401) throw new Error('sair: ' + res.status); // 401 = sessão já expirada, conta como saída
      aplicar({ estado: 'visitante', nome: '' });
      aviso.textContent = '';
      aviso.textContent = 'Você saiu.';
      const botao = grupo.querySelector('[data-login]');
      if (botao) botao.focus();
    } catch (e) {
      erro.hidden = false;
      clearTimeout(timerErro);
      timerErro = setTimeout(() => { erro.hidden = true; }, 6000);
    } finally {
      sair.removeAttribute('aria-disabled');
      sair.style.opacity = '';
    }
  });

  // voltar do histórico (página restaurada) ou da aba em segundo plano: pergunta de novo, para não mostrar quem já saiu
  addEventListener('pageshow', (e) => { if (e.persisted) perguntar(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') perguntar(); });
  perguntar();
})();

if (typeof module !== 'undefined') module.exports = { resolverSessao, inicialDe, enderecoDeLogin };
