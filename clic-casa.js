/* ==========================================================
   Clic Reservas — casa em que a pessoa está trabalhando (window.ClicCasa)
   Usado por Portaria, Promoter, Solteiras e Valet.

   - Depois do login, mostra o nome da casa em todo elemento com
     data-casa-nome (ex.: no topo da tela).
   - Quem trabalha em mais de uma casa (ex.: promoter) ganha um botão
     no canto de baixo, à esquerda, para trocar de casa.
   - Casa só para consulta: mostra uma faixa de aviso no topo.
   O banco e as funções já filtram tudo pela casa; aqui é só a tela.
   ========================================================== */
(function () {
  const AVISOS = {
    somente_leitura: ['#7f1d1d', '#fecaca', 'Sistema só para consulta. Fale com o responsável pela casa.'],
  };
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function limpar() {
    document.getElementById('clic-casa-chip')?.remove();
    document.getElementById('clic-casa-aviso')?.remove();
  }
  async function mostrar(sb) {
    let lista = [];
    try {
      const { data, error } = await sb.rpc('minhas_casas');
      if (error) return;
      lista = (data || []).filter((c) => c.situacao !== 'bloqueada');
    } catch (_) { return; }
    if (!lista.length) return;
    const atual = lista.find((c) => c.atual) || lista[0];
    window.CASA = { id: atual.casa_id, nome: atual.nome, slug: atual.slug, logo_url: atual.logo_url, situacao: atual.situacao };
    document.querySelectorAll('[data-casa-nome]').forEach((el) => { el.textContent = (el.dataset.casaPrefixo || '') + atual.nome; });
    if (document.title && !document.title.startsWith(atual.nome)) document.title = `${atual.nome} | ${document.title.replace(/^Clic Reservas \| /, '')}`;

    limpar();
    const a = AVISOS[atual.situacao];
    if (a) {
      const faixa = document.createElement('div');
      faixa.id = 'clic-casa-aviso';
      faixa.setAttribute('role', 'status');
      faixa.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:60;padding:10px 14px;text-align:center;font:800 14px/1.4 system-ui,sans-serif;background:${a[0]};color:${a[1]}`;
      faixa.textContent = a[2];
      document.body.appendChild(faixa);
    }
    if (lista.length > 1) {
      const chip = document.createElement('div');
      chip.id = 'clic-casa-chip';
      chip.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:60;background:#111318;border:1px solid #3f3f46;border-radius:12px;padding:6px 10px;font:700 13px system-ui,sans-serif;color:#fff;display:flex;gap:8px;align-items:center';
      chip.innerHTML = `<label for="clic-casa-sel" style="color:#a1a1aa">Casa</label>
        <select id="clic-casa-sel" style="background:#0a0a0f;color:#fff;border:1px solid #3f3f46;border-radius:8px;font:700 13px system-ui,sans-serif;padding:4px 6px">
          ${lista.map((c) => `<option value="${esc(c.casa_id)}" ${c.casa_id === atual.casa_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select>`;
      document.body.appendChild(chip);
      chip.querySelector('select').addEventListener('change', async (ev) => {
        const { error } = await sb.rpc('escolher_casa', { p_casa: ev.target.value });
        if (error) { alert('Não foi possível trocar de casa.'); return; }
        // A sessão de cada tela é por casa: entra de novo já na casa escolhida.
        location.reload();
      });
    }
  }
  window.ClicCasa = {
    ligar(sb) {
      if (!sb?.auth) return;
      sb.auth.onAuthStateChange((evento, sessao) => {
        if (sessao && (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION')) setTimeout(() => mostrar(sb), 0);
        if (evento === 'SIGNED_OUT') limpar();
      });
    },
    atualizar: mostrar,
  };
})();
