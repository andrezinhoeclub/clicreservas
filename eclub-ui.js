/* ==========================================================
   E-Club 2.0 — peças comuns de tela (window.ECUI)
   - ECUI.icone(nome)            desenho do ícone (SVG) para usar no HTML
   - ECUI.confirmar({...})       janela "tem certeza?" no visual do sistema
   - ECUI.pedirTexto({...})      janela com campo (substitui o prompt)
   - ECUI.avisoGrande({...})     aviso verde grande, com botão (ex.: Desfazer)
   - ECUI.prepararLogin({...})   olhinho na senha + lembrar e-mail
   Nada aqui fala com o servidor: só desenha na tela.
   ========================================================== */
(function () {
  "use strict";

  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    lua: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    busca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    cobrar: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    presente: '<path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/>',
    bloqueio: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    fone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    documento: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M14 10h4M14 14h4"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    bolo: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3M12 8v3M17 8v3"/>',
    lapis: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    lixo: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    pessoas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    novaPessoa: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    carro: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A2 2 0 0 0 13.7 6H7.3a2 2 0 0 0-1.6.8L3 10.5 1.6 11.2A2 2 0 0 0 1 12.6V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',
    grafico: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    coroa: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-4-7z"/><path d="M5 20h14"/>',
    ajustes: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    porta: '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.56v16.16a1 1 0 0 1-1.24.97L5 20V5.56a2 2 0 0 1 1.51-1.94l4-1A2 2 0 0 1 13 4.56Z"/>',
    coracao: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    olho: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    olhoFechado: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
    cadeado: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    impressora: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    contatos: '<path d="M16 2v2M8 2v2"/><rect x="3" y="4" width="18" height="18" rx="2"/><circle cx="12" cy="11" r="3"/><path d="M7 20a5 5 0 0 1 10 0"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    voltar: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    zap: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    mapa: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'
  };

  function icone(nome, estilo) {
    const p = P[nome] || P.info;
    return '<svg class="ec-i" viewBox="0 0 24 24" aria-hidden="true"' + (estilo ? ' style="' + estilo + '"' : '') + '>' + p + '</svg>';
  }

  // ---------- janela de confirmação ----------
  let modal = null, responder = null;
  function montarModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "ec-modal";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML =
      '<div class="ec-modal-card">' +
        '<h3 class="ec-modal-tit"><span class="ec-modal-ic"></span><span class="ec-modal-titxt"></span></h3>' +
        '<p class="ec-modal-txt"></p>' +
        '<input class="ec-modal-in" hidden>' +
        '<div class="ec-modal-acoes">' +
          '<button type="button" class="ec-btn neutro" data-r="nao"></button>' +
          '<button type="button" class="ec-btn ouro" data-r="sim"></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", ev => {
      if (!responder) return;
      if (ev.target === modal) return responder(false);
      const b = ev.target.closest("button[data-r]");
      if (b) responder(b.dataset.r === "sim");
    });
    // Teclado é da janela enquanto ela está aberta: Enter confirma, Esc cancela,
    // e nenhuma tecla chega na tela de trás (ex.: o Enter da Portaria).
    window.addEventListener("keydown", ev => {
      if (!responder) return;
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); responder(false); }
      else if (ev.key === "Enter") { ev.preventDefault(); ev.stopImmediatePropagation(); responder(true); }
      else if (!modal.contains(ev.target)) { ev.stopImmediatePropagation(); }
    }, true);
    return modal;
  }

  function abrir({ titulo, texto = "", confirmar = "Confirmar", cancelar = "Cancelar", perigo = false, campo = null }) {
    const m = montarModal();
    if (responder) responder(false); // fecha uma anterior, se houver
    const tit = m.querySelector(".ec-modal-tit");
    tit.classList.toggle("perigo", !!perigo);
    m.querySelector(".ec-modal-ic").innerHTML = perigo ? icone("alerta") : "";
    m.querySelector(".ec-modal-titxt").textContent = titulo || "Confirmar";
    const txt = m.querySelector(".ec-modal-txt");
    txt.textContent = texto || "";
    txt.hidden = !texto;
    const inp = m.querySelector(".ec-modal-in");
    inp.hidden = !campo;
    if (campo) {
      inp.type = campo.tipo || "text";
      inp.placeholder = campo.placeholder || "";
      inp.value = campo.valor || "";
      inp.maxLength = campo.max || 200;
    }
    const sim = m.querySelector('[data-r="sim"]');
    sim.textContent = confirmar;
    sim.className = "ec-btn " + (perigo ? "perigo" : "ouro");
    m.querySelector('[data-r="nao"]').textContent = cancelar;
    const focoAntes = document.activeElement;
    m.hidden = false;
    setTimeout(() => (campo ? inp : sim).focus(), 30);
    return new Promise(resolve => {
      responder = ok => {
        responder = null;
        m.hidden = true;
        const valor = campo ? inp.value : null;
        try { focoAntes && focoAntes.focus && focoAntes.focus(); } catch (_) {}
        resolve(campo ? (ok ? valor : null) : !!ok);
      };
    });
  }

  function confirmar(opcoes) { return abrir(opcoes || {}); }
  function pedirTexto(opcoes) {
    const o = opcoes || {};
    return abrir({ ...o, campo: { tipo: o.tipo, placeholder: o.placeholder, valor: o.valor, max: o.max } });
  }
  function aberto() { return !!responder; }

  // ---------- aviso grande ----------
  let toast = null, timerToast = null, timerConta = null;
  function avisoGrande({ titulo, sub = "", botao = "", aoClicar = null, tempo = 6000, erro = false, iconeNome = null }) {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "ec-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    clearTimeout(timerToast); clearInterval(timerConta);
    toast.classList.toggle("erro", !!erro);
    toast.innerHTML =
      '<div class="ec-toast-ic">' + icone(iconeNome || (erro ? "alerta" : "check")) + '</div>' +
      '<div class="ec-toast-txt"><b></b><span></span></div>' +
      (botao ? '<button type="button">' + icone("undo") + '<em style="font-style:normal"></em></button>' : "");
    toast.querySelector("b").textContent = titulo || "";
    const s = toast.querySelector(".ec-toast-txt span");
    s.textContent = sub || ""; s.hidden = !sub;
    let restante = Math.round(tempo / 1000);
    const em = toast.querySelector("button em");
    const pintar = () => { if (em) em.textContent = botao + " (" + restante + ")"; };
    pintar();
    if (botao) {
      toast.querySelector("button").onclick = () => { fechar(); if (aoClicar) aoClicar(); };
      timerConta = setInterval(() => { restante = Math.max(0, restante - 1); pintar(); }, 1000);
    }
    requestAnimationFrame(() => toast.classList.add("on"));
    timerToast = setTimeout(fechar, tempo);
    function fechar() { clearTimeout(timerToast); clearInterval(timerConta); toast.classList.remove("on"); }
    return fechar;
  }

  // ---------- login: olhinho + lembrar e-mail ----------
  function guardar(chave, valor) { try { valor ? localStorage.setItem(chave, valor) : localStorage.removeItem(chave); } catch (_) {} }
  function ler(chave) { try { return localStorage.getItem(chave) || ""; } catch (_) { return ""; } }

  function prepararLogin({ email, senha, form, chave }) {
    const elEmail = document.getElementById(email);
    const elSenha = document.getElementById(senha);
    const elForm = form ? document.getElementById(form) : (elSenha && elSenha.form);
    if (!elSenha || elSenha.dataset.ecPronto) return;
    elSenha.dataset.ecPronto = "1";
    // Olhinho
    const caixa = document.createElement("div");
    caixa.className = "ec-senha";
    elSenha.parentNode.insertBefore(caixa, elSenha);
    caixa.appendChild(elSenha);
    const olho = document.createElement("button");
    olho.type = "button";
    olho.className = "ec-olho login-link-sec";
    olho.setAttribute("aria-label", "Mostrar senha");
    const pintarOlho = () => {
      const vendo = elSenha.type === "text";
      olho.innerHTML = icone(vendo ? "olhoFechado" : "olho") + (vendo ? "Esconder" : "Mostrar");
      olho.setAttribute("aria-label", vendo ? "Esconder senha" : "Mostrar senha");
    };
    olho.addEventListener("click", () => { elSenha.type = elSenha.type === "password" ? "text" : "password"; pintarOlho(); elSenha.focus(); });
    pintarOlho();
    caixa.appendChild(olho);
    // Lembrar e-mail (só o e-mail, nunca a senha)
    if (elEmail && chave) {
      const salvo = ler(chave);
      const rot = document.createElement("label");
      rot.className = "ec-lembrar";
      rot.innerHTML = '<input type="checkbox"> Lembrar meu e-mail neste aparelho';
      const marca = rot.querySelector("input");
      marca.checked = !!salvo;
      if (salvo && !elEmail.value) { elEmail.value = salvo; setTimeout(() => elSenha.focus(), 50); }
      caixa.insertAdjacentElement("afterend", rot);
      marca.addEventListener("change", () => { if (!marca.checked) guardar(chave, ""); });
      if (elForm) elForm.addEventListener("submit", () => {
        guardar(chave, marca.checked ? String(elEmail.value || "").trim() : "");
        elSenha.type = "password"; pintarOlho();
      }, true);
    }
  }

  // ---------- atualização ao vivo ----------
  // A tela não precisa mais de F5. De três jeitos ao mesmo tempo:
  //  1) AVISO NA HORA: o Supabase avisa quando uma tabela muda (por exemplo,
  //     você liga o modo teste na Dashboard) e a tela busca de novo;
  //  2) AO VOLTAR: ao voltar para a aba, abrir o notebook, ou a internet
  //     voltar, a tela busca de novo na hora (o aviso pode ter se perdido);
  //  3) REDE DE SEGURANÇA: de tempos em tempos busca sozinha mesmo que o
  //     aviso falhe (a cada 15 s se o aviso estiver fora do ar, 60 s se não).
  // Se nada disso funcionar, a tela continua como antes — nunca piora.
  //
  // aoVivo({ sb, atualizar, tabelas, atraso, minimo, nome })
  //   sb        cliente do Supabase já logado
  //   atualizar função que busca tudo de novo (a própria tela já tem uma)
  //   tabelas   quais tabelas observar, ex.: ['configuracoes', 'eventos']
  //   atraso    espera curta (ms) para juntar vários avisos seguidos
  //   minimo    intervalo mínimo (ms) entre duas buscas
  //   seguranca (opcional) de quanto em quanto tempo (ms) buscar mesmo sem aviso;
  //             se não vier, usa 60 s com o aviso funcionando e 15 s sem ele
  // Devolve { agora(), parar() }.
  function aoVivo(op) {
    const sb = op.sb, atualizar = op.atualizar;
    const tabelas = op.tabelas || [];
    const atraso = op.atraso == null ? 300 : op.atraso;
    const minimo = op.minimo == null ? 1500 : op.minimo;
    let timer = null, rodando = false, repetir = false, vivo = true, ultima = 0, conectado = false, canal = null, vigia = null;

    async function rodar() {
      if (!vivo) return;
      if (rodando) { repetir = true; return; }
      rodando = true;
      try { await atualizar(); } catch (_) { /* a tela já trata os próprios erros */ }
      ultima = Date.now();
      rodando = false;
      if (repetir) { repetir = false; agendar(); }
    }
    function agendar() {
      if (!vivo) return;
      clearTimeout(timer);
      const espera = Math.max(atraso, minimo - (Date.now() - ultima));
      timer = setTimeout(rodar, espera);
    }
    function voltou() { if (!document.hidden) agendar(); }

    document.addEventListener("visibilitychange", voltou);
    window.addEventListener("focus", voltou);
    window.addEventListener("online", agendar);

    // Rede de segurança. Só busca com a aba à vista.
    vigia = setInterval(() => {
      if (!vivo || document.hidden) return;
      const quanto = op.seguranca || (conectado ? 60000 : 15000);
      if (Date.now() - ultima >= quanto) agendar();
    }, 5000);

    (async () => {
      try {
        if (!sb || !tabelas.length || typeof sb.channel !== "function") return;
        // Garante que o canal vai com a sessão de quem está logado.
        try {
          const { data } = await sb.auth.getSession();
          if (data && data.session && sb.realtime && typeof sb.realtime.setAuth === "function") sb.realtime.setAuth(data.session.access_token);
        } catch (_) {}
        if (!vivo) return;
        canal = sb.channel("aovivo-" + (op.nome || "tela") + "-" + Math.random().toString(36).slice(2, 8));
        tabelas.forEach((t) => canal.on("postgres_changes", { event: "*", schema: "public", table: t }, agendar));
        canal.subscribe((estado) => {
          conectado = estado === "SUBSCRIBED";
          // Ao (re)conectar, busca o que pode ter passado enquanto estava fora.
          if (conectado) agendar();
        });
      } catch (_) { conectado = false; }
    })();

    return {
      agora: agendar,
      parar() {
        vivo = false;
        clearTimeout(timer); clearInterval(vigia);
        document.removeEventListener("visibilitychange", voltou);
        window.removeEventListener("focus", voltou);
        window.removeEventListener("online", agendar);
        try { if (canal && sb && sb.removeChannel) sb.removeChannel(canal); } catch (_) {}
      },
    };
  }

  window.ECUI = { icone, confirmar, pedirTexto, aberto, avisoGrande, prepararLogin, aoVivo };
})();
