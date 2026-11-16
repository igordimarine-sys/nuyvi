// Comportamento do rodapé e dos botões das lojas de aplicativos, compartilhado por `/` e `/loja`. Os textos e endereços vêm do
// conteúdo (bloco Geral), gerados em atributos `data-*` e no JSON `#dados-lojas`; nada daqui depende de dado de ninguém.
(function () {
  // Botões das lojas: com endereço https abrem em outra aba; sem endereço ficam desativados com a dica.
  let lojas = { ios: '', android: '', dica: '' };
  const json = document.getElementById('dados-lojas');
  if (json) { try { lojas = JSON.parse(json.textContent || '{}'); } catch (e) { /* fica desativado */ } }
  document.querySelectorAll('[data-loja]').forEach(function (a) {
    const url = lojas[a.dataset.loja] || '';
    if (url) {
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      const s = document.createElement('span'); s.className = 'sr-only'; s.textContent = ' (abre em nova aba)'; a.append(s);
    } else {
      a.setAttribute('href', '#'); a.setAttribute('aria-disabled', 'true'); a.title = lojas.dica || '';
      a.addEventListener('click', function (e) { e.preventDefault(); });
    }
  });

  // Cadastro de e-mail (sem servidor ainda): só valida e mostra a mensagem.
  const form = document.querySelector('[data-news]'), aviso = document.querySelector('[data-news-aviso]');
  if (!form || !aviso) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      aviso.style.color = '#FF9454'; aviso.textContent = form.dataset.invalido || ''; form.email.setAttribute('aria-invalid', 'true'); form.email.focus(); return;
    }
    form.email.removeAttribute('aria-invalid');
    aviso.style.color = ''; aviso.textContent = form.dataset.ok || ''; form.reset();
  });
})();
