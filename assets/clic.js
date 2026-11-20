/* Clic Reservas 2.0 — funções comuns a todas as telas.
   Precisa ser carregado DEPOIS de:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="/assets/config.js"></script> */
(function () {
  'use strict';
  var C = window.CLIC_CONFIG || {};
  // aceita a URL com ou sem /rest/v1/ no final
  if (C.SUPABASE_URL) C.SUPABASE_URL = String(C.SUPABASE_URL).trim().replace(/\/(rest|auth)\/v1\/?$/, '').replace(/\/+$/, '');
  if (!window.supabase || !C.SUPABASE_URL || C.SUPABASE_URL.indexOf('COLE_AQUI') === 0) {
    console.error('Clic: configure assets/config.js com a URL e a chave pública do Supabase.');
  }
  var sb = window.supabase ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;

  var Clic = {
    sb: sb,
    cfg: C,
    $: function (s, r) { return (r || document).querySelector(s); },
    $$: function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); },

    // dinheiro em centavos -> "R$ 1.234,56"
    money: function (c) { return ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
    // "R$ 12,50" ou "12,50" -> 1250
    centavos: function (txt) {
      var s = String(txt || '').replace(/[^\d,.-]/g, '');
      if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
      var n = Math.round(parseFloat(s) * 100);
      return isNaN(n) ? 0 : n;
    },
    esc: function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; },
    slug: function (s) {
      return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    },
    data: function (iso, opt) {
      if (!iso) return '';
      return new Date(iso).toLocaleString('pt-BR', opt || { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },
    toast: function (msg, erro) {
      var t = document.getElementById('toast');
      if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
      t.textContent = msg; t.className = 'on' + (erro ? ' erro' : '');
      clearTimeout(t._h); t._h = setTimeout(function () { t.className = ''; }, erro ? 5000 : 3000);
    },
    // traduz erros comuns do Supabase para português
    erro: function (e) {
      var m = (e && (e.message || e.error_description || e)) + '';
      if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
      if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).';
      if (/User already registered/i.test(m)) return 'Este e-mail já tem cadastro. Use "Entrar".';
      if (/duplicate key.*slug/i.test(m)) return 'Esse endereço já está em uso. Escolha outro.';
      if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 10 caracteres.';
      if (/rate limit/i.test(m)) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
      if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão. Tente de novo.';
      return m.replace(/^.*?:\s*/, '');
    },
    carregando: function (btn, on, txt) {
      if (!btn) return;
      if (on) { btn._txt = btn.innerHTML; btn.disabled = true; btn.innerHTML = txt || 'Aguarde…'; }
      else { btn.disabled = false; if (btn._txt) btn.innerHTML = btn._txt; }
    },
    // sessão com limite de inatividade: painel/master 60 min, PDV/produção 4 h
    sessao: async function () {
      var r = await sb.auth.getSession(), s = r.data.session;
      if (!s) { limparAtividade(); return null; }
      if (expirou()) { await sairPorInatividade(false); return null; }
      if (!lerAtividade()) marcarAtividade();
      vigiar();
      return s;
    },
    marcarAtividade: function () { marcarAtividade(); },

    // envia uma imagem para o Storage (bucket "midia") e devolve o endereço público
    enviarImagem: async function (orgId, arquivo, pasta) {
      if (!arquivo) return null;
      if (!/^image\//.test(arquivo.type || 'image/')) throw new Error('O arquivo "' + arquivo.name + '" não é uma imagem.');
      // foto grande (não animada): reduz automaticamente para caber
      if (arquivo.size > 5 * 1024 * 1024 && !/gif/i.test(arquivo.type)) {
        try {
          var bmp = await createImageBitmap(arquivo), lado = 2000, esc = Math.min(1, lado / Math.max(bmp.width, bmp.height));
          var cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * esc); cv.height = Math.round(bmp.height * esc);
          cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
          var bl = await new Promise(function (r) { cv.toBlob(r, 'image/webp', 0.85); });
          if (bl) arquivo = new File([bl], arquivo.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
        } catch (e) { }
      }
      if (arquivo.size > 5 * 1024 * 1024) throw new Error('A imagem "' + arquivo.name + '" passa de 5 MB. Use uma menor.');
      var ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      var caminho = orgId + '/' + (pasta || 'geral') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      var up = await sb.storage.from('midia').upload(caminho, arquivo, { cacheControl: '31536000', upsert: false });
      if (up.error) { var m = up.error.message || ''; if (/Bucket not found/i.test(m)) m = 'Armazenamento de imagens não configurado.'; else if (/row-level security|Unauthorized|403/i.test(m)) m = 'Sem permissão para enviar imagens nesta casa.'; throw new Error('Falha ao enviar "' + arquivo.name + '" — ' + m); }
      return sb.storage.from('midia').getPublicUrl(caminho).data.publicUrl;
    }
  };
  // ---------------------------------------------------------------- inatividade
  var CHAVE_ATIV = 'clic_atividade', vigiando = false, ultimaGravacao = 0;
  function limitePagina() { return /^\/(pdv|producao)\//.test(location.pathname) ? 240 : 60; }
  function protegida() { return /^\/(painel|master|pdv|producao)\//.test(location.pathname); }
  function lerAtividade() { try { return JSON.parse(localStorage.getItem(CHAVE_ATIV) || 'null'); } catch (e) { return null; } }
  function marcarAtividade() { ultimaGravacao = Date.now(); try { localStorage.setItem(CHAVE_ATIV, JSON.stringify({ t: ultimaGravacao, lim: limitePagina() })); } catch (e) { } }
  function limparAtividade() { try { localStorage.removeItem(CHAVE_ATIV); } catch (e) { } }
  function expirou() { var a = lerAtividade(); return !!(a && a.t && Date.now() - a.t > (a.lim || 60) * 60000); }
  async function sairPorInatividade(irParaLogin) {
    try { await sb.auth.signOut(); } catch (e) { }
    limparAtividade();
    try { sessionStorage.setItem('clic_expirou', '1'); } catch (e) { }
    if (irParaLogin) location.href = '/?voltar=' + encodeURIComponent(location.pathname) + '#entrar';
  }
  function vigiar() {
    if (vigiando || !protegida()) return; vigiando = true;
    var mexeu = function () { if (Date.now() - ultimaGravacao > 30000 && !expirou()) marcarAtividade(); };
    ['click', 'keydown', 'touchstart', 'scroll', 'mousemove'].forEach(function (ev) { window.addEventListener(ev, mexeu, { passive: true, capture: true }); });
    var conferir = function () { if (expirou()) sairPorInatividade(true); };
    setInterval(conferir, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) conferir(); });
  }
  if (sb) sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') limparAtividade(); });

  window.Clic = Clic;
})();
