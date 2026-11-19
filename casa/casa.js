/* Clic Reservas 2.0 — site e app de cada casa (clicreservas.com.br/suacasa) */
(function () {
  'use strict';
  var sb = Clic.sb, esc = Clic.esc, money = Clic.money, $ = Clic.$, $$ = Clic.$$;
  var SLUG = (new URLSearchParams(location.search).get('c') || localStorage.getItem('clic_ultima_casa') || '').toLowerCase();
  var ORG = null, EVENTOS = [], LOJA = [], PROMOS = [], ESPACOS = [];
  var A = $('#app');
  var KCART = 'clic_cart_' + SLUG, KPED = 'clic_pedidos_' + SLUG;
  // promoter: quem chega pelo link ?p=codigo fica marcado por 7 dias neste aparelho
  var KPROM = 'clic_promoter_' + SLUG, CUPOM = null;
  (function () {
    var p = (new URLSearchParams(location.search).get('p') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    if (p) try { localStorage.setItem(KPROM, JSON.stringify({ c: p, ate: Date.now() + 7 * 864e5 })); } catch (e) {}
  })();
  function promoterLink() { try { var x = JSON.parse(localStorage.getItem(KPROM)); return x && x.ate > Date.now() ? x.c : ''; } catch (e) { return ''; } }

  // ------------------------------------------------------------ carrinho
  function cart() { try { return JSON.parse(localStorage.getItem(KCART)) || []; } catch (e) { return []; } }
  function salvarCart(c) { localStorage.setItem(KCART, JSON.stringify(c)); bolha(); }
  function bolha() { var n = cart().reduce(function (a, i) { return a + i.qtd; }, 0), b = $('#bolha'); b.textContent = n; b.style.display = n ? '' : 'none'; }
  function addCart(item) {
    var c = cart();
    var igual = c.find(function (i) { return i.tipo === item.tipo && i.id === item.id && (i.tamanho || '') === (item.tamanho || '') && !i.poltrona && !item.poltrona; });
    if (igual) igual.qtd += item.qtd; else c.push(item);
    salvarCart(c);
  }
  function pedidosSalvos() { try { return JSON.parse(localStorage.getItem(KPED)) || []; } catch (e) { return []; } }
  function guardarPedido(p) { var l = pedidosSalvos().filter(function (x) { return x.token !== p.token; }); l.unshift(p); localStorage.setItem(KPED, JSON.stringify(l.slice(0, 30))); }

  function taxaServico(sub) { return ORG.comissao_quem_paga === 'comprador' ? Math.round(sub * ORG.comissao_pct / 100) : 0; }
  function dataCurta(iso) { var d = new Date(iso); return { dia: String(d.getDate()).padStart(2, '0'), mes: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase() }; }
  function quando(iso) { return new Date(iso).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function local(e) { return e.espacos ? e.espacos.nome : (e.local_texto || 'Local a confirmar'); }
  function endereco(e) { return e.espacos ? [e.espacos.endereco, e.espacos.cidade].filter(Boolean).join(', ') : (e.endereco || ''); }
  function T(k, padrao) { return (ORG.textos && ORG.textos[k]) || padrao || ''; }
  function sec(k) { return ORG.secoes.indexOf(k) >= 0; }

  // lotes visíveis: em cada área, o lote "da vez"
  function lotesDaVez(ev) {
    var agora = Date.now(), porArea = {};
    (ev.lotes || []).filter(function (l) { return l.ativo; }).sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (l) {
      var k = l.area || ''; (porArea[k] = porArea[k] || []).push(l);
    });
    var res = [];
    Object.keys(porArea).forEach(function (k) {
      var lista = porArea[k], achou = false;
      lista.forEach(function (l) {
        var aberto = (!l.venda_inicio || new Date(l.venda_inicio) <= agora) && (!l.venda_fim || new Date(l.venda_fim) > agora);
        var tem = l.vendidos < l.quantidade;
        if (!l.vira_sozinho) { res.push({ l: l, estado: !aberto ? 'fechado' : tem ? 'venda' : 'esgotado' }); return; }
        if (achou) { res.push({ l: l, estado: 'proximo' }); return; }
        if (aberto && tem) { achou = true; res.push({ l: l, estado: 'venda' }); }
        else res.push({ l: l, estado: tem ? 'fechado' : 'esgotado' });
      });
    });
    return res;
  }

  // ------------------------------------------------------------ início
  async function iniciar() {
    if (!SLUG) { A.innerHTML = '<div class="wrap" style="padding:60px 0;text-align:center"><h2>Casa não encontrada</h2><a class="btn prim" href="/">clic reservas</a></div>'; return; }
    var r = await sb.from('organizacoes').select('id,slug,nome,nome_loja,cor_destaque,cor_secundaria,logo_url,logo_animacao,textos,secoes,venda_online_liberada,asaas_conectado,comissao_pct,comissao_quem_paga,parcelas_max,juros_comprador,ativo').eq('slug', SLUG).maybeSingle();
    if (!r.data || !r.data.ativo) { A.innerHTML = '<div class="wrap" style="padding:60px 0;text-align:center"><h2>Página não encontrada</h2><p>Confira o endereço.</p><a class="btn prim" href="/">clic reservas</a></div>'; $('#nome-casa').textContent = ''; return; }
    ORG = r.data; localStorage.setItem('clic_ultima_casa', SLUG);
    document.documentElement.style.setProperty('--dest', ORG.cor_destaque || '#FF5A1F');
    document.documentElement.style.setProperty('--fundo', ORG.cor_secundaria || '#0A0A0A');
    $('#meta-cor').content = ORG.cor_secundaria || '#0A0A0A';
    document.title = ORG.nome + ' · Ingressos';
    $('#nome-casa').innerHTML = esc(ORG.nome) + '<small>' + esc(T('slogan', 'Eventos oficiais')) + '</small>';
    if (ORG.logo_url) { $('#logo').src = ORG.logo_url; $('#favicon').href = ORG.logo_url; $('#apple-icon').href = ORG.logo_url; if (ORG.logo_animacao && ORG.logo_animacao !== 'nenhuma') $('#logo').className = 'anim-' + ORG.logo_animacao; } else $('#logo').style.display = 'none';
    if (T('whatsapp')) { $('#b-whats').href = 'https://wa.me/55' + T('whatsapp').replace(/\D/g, ''); $('#b-whats').style.display = ''; }
    var man = document.createElement('link'); man.rel = 'manifest'; man.href = Clic.cfg.SUPABASE_URL + '/functions/v1/manifest?c=' + SLUG; document.head.appendChild(man);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/casa/sw.js').catch(function () {});
    var hoje = new Date(Date.now() - 12 * 36e5).toISOString();
    var x = await Promise.all([
      sb.from('eventos').select('*, espacos(nome,endereco,cidade), lotes(*), veiculos(*, classes_poltrona(*)), pontos_embarque(*)').eq('org_id', ORG.id).in('situacao', ['a_venda', 'esgotado']).gte('inicio', new Date(Date.now() - 3 * 864e5).toISOString()).order('inicio'),
      sb.from('produtos').select('*').eq('org_id', ORG.id).eq('categoria', 'loja').eq('ativo', true).order('nome'),
      sb.from('promocoes').select('*, produtos(nome)').eq('org_id', ORG.id).eq('ativa', true),
      sb.from('espacos').select('*').eq('org_id', ORG.id).eq('ativo', true)
    ]);
    EVENTOS = (x[0].data || []).filter(function (e) { return new Date(e.fim || new Date(new Date(e.inicio).getTime() + 12 * 36e5)).toISOString() > hoje; });
    LOJA = x[1].data || []; PROMOS = x[2].data || []; ESPACOS = x[3].data || [];
    window.addEventListener('hashchange', rota); bolha(); rota();
  }

  function rota() {
    var h = (location.hash || '#/').slice(1).split('/').filter(Boolean);
    $$('nav.baixo a').forEach(function (a) { a.classList.remove('on'); });
    var aba = h[0] === 'carrinho' ? 'carrinho' : (h[0] === 'meus' || h[0] === 'p') ? 'meus' : 'inicio';
    $('nav.baixo a[data-r="' + aba + '"]').classList.add('on');
    window.scrollTo(0, 0); clearInterval(window.__poll);
    if (h[0] === 'e') return telaEvento(decodeURIComponent(h[1] || ''));
    if (h[0] === 'carrinho') return telaCarrinho();
    if (h[0] === 'meus') return telaMeus();
    if (h[0] === 'p') return telaPedido(h[1]);
    if (h[0] === 'locacoes') return telaLocacoes();
    telaInicio();
  }

  // ------------------------------------------------------------ tela inicial (site)
  function telaInicio() {
    var prox = EVENTOS.find(function (e) { return new Date(e.inicio) > new Date(); }) || EVENTOS[0];
    var heroImg = T('hero_img') || (prox && prox.capa_url) || '';
    var titulo = esc(T('hero_titulo', 'Viva noites que merecem ser lembradas.'));
    if (T('hero_destaque')) titulo = titulo.replace(esc(T('hero_destaque')), '<em>' + esc(T('hero_destaque')) + '</em>');
    var html = '';
    if (sec('banner')) {
      html += '<div class="hero" style="background-image:url(\'' + esc(heroImg) + '\')"><div class="wrap">' +
        '<div class="small muted" style="letter-spacing:.08em;text-transform:uppercase">' + esc(T('hero_chamada', 'Música • Experiências • Eventos')) + '</div>' +
        '<h1>' + titulo + '</h1><p>' + esc(T('hero_texto', 'Ingressos oficiais, experiências especiais e produtos exclusivos.')) + '</p>' +
        (prox ? '<div class="small">' + esc(prox.nome) + ' · ' + esc(T('contador_texto', 'faltam')) + '</div><div class="contador" id="contador" data-ate="' + prox.inicio + '"></div>' : '') +
        '<a class="btn prim" href="' + (prox ? '#/e/' + prox.slug : '#eventos') + '">' + esc(T('hero_botao', 'Garantir meu ingresso')) + ' <i class="ti ti-arrow-right"></i></a>' +
        '<div class="instalar card" id="instalar" style="margin-top:16px"><i class="ti ti-device-mobile" style="font-size:28px;color:var(--dest)"></i><div style="flex:1"><b>Instale o app</b><div class="small muted">Ingressos em 1 toque, direto da tela inicial</div></div><button class="btn prim peq" id="b-inst">Instalar</button></div>' +
        '</div></div>';
    }
    // eventos
    html += '<div class="wrap" id="eventos">' + (EVENTOS.length > 1 ? '<div class="datas" id="datas">' + EVENTOS.map(function (e, i) { var d = dataCurta(e.inicio); return '<button data-i="' + i + '">' + d.dia + '<small>' + d.mes + '</small></button>'; }).join('') + '</div>' : '<div style="height:16px"></div>') +
      '<h2>Próximos eventos</h2>' + (EVENTOS.length ? EVENTOS.map(function (e) {
        var d = dataCurta(e.inicio), min = Math.min.apply(null, lotesDaVez(e).filter(function (x) { return x.estado === 'venda'; }).map(function (x) { return x.l.preco_centavos; }).concat([Infinity]));
        return '<a class="evcard" id="ev-' + e.id + '" href="#/e/' + e.slug + '"><div class="capa" style="background-image:url(\'' + esc(e.capa_url || '') + '\')"><div class="data">' + d.dia + '<br><small>' + d.mes + '</small></div></div>' +
          '<div class="info"><h3>' + esc(e.nome) + '</h3><div class="small muted">' + quando(e.inicio) + ' · ' + esc(local(e)) + '</div>' +
          '<div style="margin-top:8px">' + (e.situacao === 'esgotado' ? '<span class="pill cinza">Esgotado</span>' : min < Infinity ? '<span class="pill">A partir de ' + money(min) + '</span>' : '<span class="pill cinza">Em breve</span>') + (e.tipo === 'excursao' ? ' <span class="pill">Excursão</span>' : '') + '</div></div></a>';
      }).join('') : '<div class="card" style="text-align:center"><h3>Novas datas em breve</h3><p>Cadastre seu e-mail no fim da página para ser avisado primeiro.</p></div>') + '</div>';
    // grupo
    if (sec('grupo') && T('grupo_link')) html += '<section class="sec"><div class="wrap"><div class="card"><span class="pill">Grupo oficial</span><h2 style="margin-top:8px">' + esc(T('grupo_titulo', 'Entre no grupo oficial')) + '</h2><p>' + esc(T('grupo_texto', 'Quem está no grupo recebe tudo primeiro.')) + '</p>' +
      T('grupo_beneficios').split('\n').filter(Boolean).map(function (b) { return '<div><i class="ti ti-check" style="color:var(--dest)"></i> ' + esc(b) + '</div>'; }).join('') + '<a class="btn prim" style="margin-top:12px" target="_blank" href="' + esc(T('grupo_link')) + '"><i class="ti ti-brand-whatsapp"></i> Entrar no grupo</a></div></div></section>';
    // momentos
    if (sec('momentos') && T('m1_titulo')) html += '<section class="sec"><div class="wrap"><h2>' + esc(T('momentos_titulo', 'Mais que um evento')) + '</h2><div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">' + [1, 2, 3].filter(function (n) { return T('m' + n + '_titulo'); }).map(function (n) {
      return '<div class="prod">' + (T('m' + n + '_img') ? '<div class="img" style="aspect-ratio:4/3;background-image:url(\'' + esc(T('m' + n + '_img')) + '\')"></div>' : '') + '<div class="p"><h3>' + esc(T('m' + n + '_titulo')) + '</h3><p class="small">' + esc(T('m' + n + '_texto')) + '</p></div></div>';
    }).join('') + '</div></div></section>';
    // loja
    if (sec('loja') && LOJA.length) html += '<section class="sec"><div class="wrap"><h2>' + esc(ORG.nome_loja || 'Loja oficial') + '</h2><p>Produtos oficiais para levar a experiência com você. Retire no evento.</p><div class="grade">' + LOJA.map(cardProduto).join('') + '</div></div></section>';
    // galeria
    if (sec('galeria') && (T('galeria') || []).length) html += '<section class="sec"><div class="wrap"><h2>Galeria</h2><div class="galeria">' + ORG.textos.galeria.map(function (g) { return '<img loading="lazy" src="' + esc(g) + '" alt="">'; }).join('') + '</div></div></section>';
    // depoimentos
    if (sec('depoimentos') && T('depoimentos')) html += '<section class="sec"><div class="wrap"><h2>Quem foi, aprovou</h2><div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">' + T('depoimentos').split('\n').filter(Boolean).map(function (l) { var p = l.split('|'); return '<div class="card"><p>“' + esc((p[2] || p[0]).trim()) + '”</p><b>' + esc((p[0] || '').trim()) + '</b> <span class="muted small">' + esc((p[1] || '').trim()) + '</span></div>'; }).join('') + '</div></div></section>';
    // vip
    if (sec('vip') && T('vip_titulo')) html += '<section class="sec"><div class="wrap"><div class="card" style="' + (T('vip_img') ? 'background:linear-gradient(90deg,var(--card) 50%,transparent),url(\'' + esc(T('vip_img')) + '\') right/cover;' : '') + '"><span class="pill">VIP</span><h2 style="margin-top:8px">' + esc(T('vip_titulo')) + '</h2><p style="max-width:520px">' + esc(T('vip_texto')) + '</p>' +
      T('vip_beneficios').split('\n').filter(Boolean).map(function (b) { return '<div><i class="ti ti-star" style="color:var(--dest)"></i> ' + esc(b) + '</div>'; }).join('') + (T('vip_link') ? '<a class="btn prim" style="margin-top:12px" target="_blank" href="' + esc(T('vip_link')) + '">' + esc(T('vip_botao', 'Quero ser VIP')) + '</a>' : '') + '</div></div></section>';
    // locações
    if (sec('locacoes') && ESPACOS.length) html += '<section class="sec"><div class="wrap"><h2>Espaços e locações</h2><p>Faça sua festa ou evento com a gente.</p><a class="btn" href="#/locacoes">Ver espaços</a></div></section>';
    // newsletter
    if (sec('newsletter')) html += '<section class="sec"><div class="wrap"><div class="card"><h2>Receba novidades</h2><p>Lançamentos de lotes, promoções e novidades direto no seu e-mail.</p><form id="f-news" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;position:relative"><input name="sobrenome_x" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0"><input name="nome" placeholder="Nome"><input name="email" type="email" required placeholder="E-mail"><button class="btn prim">Quero receber</button></form><div class="small muted" style="margin-top:6px">Ao enviar você concorda em receber comunicações de ' + esc(ORG.nome) + '. Cancele quando quiser.</div></div></div></section>';
    html += rodape();
    A.innerHTML = html;
    ligarProdutos(A);
    contador();
    $$('#datas button').forEach(function (b) { b.onclick = function () { $$('#datas button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); var e = EVENTOS[+b.dataset.i]; $('#ev-' + e.id).scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    var fn = $('#f-news');
    if (fn) { fn.__t = Date.now(); fn.onsubmit = async function (e) { e.preventDefault(); if (robo(fn)) { Clic.toast('Cadastro feito. Obrigado!'); fn.reset(); return; } var r = await sb.rpc('inscrever_novidades', { p_org_slug: SLUG, p_nome: fn.nome.value, p_email: fn.email.value }); Clic.toast(r.data ? 'Cadastro feito. Obrigado!' : 'Confira o e-mail ou tente de novo em alguns minutos.', !r.data); if (r.data) fn.reset(); }; }
    instalar();
  }

  // anti-robô: campo invisível que só robô preenche + tempo mínimo para preencher o formulário
  function robo(f) {
    var isca = f.querySelector('[name=sobrenome_x]');
    return !!(isca && isca.value) || (Date.now() - (f.__t || 0) < 2500);
  }

  function rodape() {
    var redes = [['instagram', 'brand-instagram'], ['tiktok', 'brand-tiktok'], ['youtube', 'brand-youtube']].filter(function (r) { return T(r[0]); });
    return '<footer class="rod"><div class="wrap"><b style="color:var(--txt)">' + esc(ORG.nome) + '</b><div>' + esc(T('rodape', 'Ingressos e experiências oficiais.')) + '</div>' +
      '<div style="margin:10px 0;display:flex;gap:12px;font-size:22px">' + redes.map(function (r) { return '<a target="_blank" href="' + esc(T(r[0])) + '"><i class="ti ti-' + r[1] + '"></i></a>'; }).join('') + (T('whatsapp') ? '<a target="_blank" href="https://wa.me/55' + esc(T('whatsapp').replace(/\D/g, '')) + '"><i class="ti ti-brand-whatsapp"></i></a>' : '') + '</div>' +
      (T('email') ? '<div>' + esc(T('email')) + '</div>' : '') + '<div style="margin-top:10px">Ingressos com QR Code individual e pagamento seguro · <a href="/painel/">Área do organizador</a> · plataforma <a href="/">clic reservas</a></div></div></footer>';
  }

  function contador() {
    var c = $('#contador'); if (!c) return;
    function tick() {
      var s = Math.max(0, Math.floor((new Date(c.dataset.ate) - Date.now()) / 1000));
      if (!s) { c.innerHTML = '<div><b>É hoje!</b></div>'; return; }
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
      c.innerHTML = [[d, 'dias'], [h, 'horas'], [m, 'min'], [x, 'seg']].map(function (p) { return '<div><b>' + String(p[0]).padStart(2, '0') + '</b><span>' + p[1] + '</span></div>'; }).join('');
    }
    tick(); clearInterval(window.__cd); window.__cd = setInterval(tick, 1000);
  }

  var promptInstalar = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); promptInstalar = e; instalar(); });
  function instalar() {
    var box = $('#instalar'); if (!box || window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('clic_inst_off')) return;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!promptInstalar && !ios) return;
    box.classList.add('on');
    $('#b-inst').onclick = function () {
      if (promptInstalar) { promptInstalar.prompt(); promptInstalar = null; box.classList.remove('on'); }
      else alert('No iPhone: toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início".');
    };
  }

  function cardProduto(p) {
    return '<div class="prod"><div class="img" style="background-image:url(\'' + esc(p.foto_url || '') + '\')"></div><div class="p"><b>' + esc(p.nome) + '</b><div class="small" style="color:var(--dest);font-weight:800">' + money(p.preco_centavos) + '</div>' +
      (p.tamanhos.length ? '<select data-tam="' + p.id + '" style="margin-top:6px;padding:8px"><option value="">Tamanho…</option>' + p.tamanhos.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select>' : '') +
      (p.estoque > 0 ? '<button class="btn prim peq full" style="margin-top:8px" data-prod="' + p.id + '">Adicionar</button>' : '<span class="pill cinza" style="margin-top:8px">Esgotado</span>') + '</div></div>';
  }
  function ligarProdutos(raiz) {
    $$('[data-prod]', raiz).forEach(function (b) {
      b.onclick = function () {
        var p = LOJA.find(function (x) { return x.id === b.dataset.prod; }), sel = $('[data-tam="' + p.id + '"]', raiz);
        if (p.tamanhos.length && (!sel || !sel.value)) return Clic.toast('Escolha o tamanho primeiro', true);
        addCart({ tipo: 'produto', id: p.id, qtd: 1, tamanho: sel ? sel.value : '', nome: p.nome + (sel && sel.value ? ' (' + sel.value + ')' : ''), preco: p.preco_centavos });
        Clic.toast('Adicionado ao carrinho');
      };
    });
  }

  // ------------------------------------------------------------ evento
  function svgMapa(ev, filtro) {
    var itens = (ev.mapa && ev.mapa.itens) || []; if (!itens.length) return '';
    var dv = lotesDaVez(ev);
    var cores = { area: ORG.cor_destaque, stage: '#2a2a2a', bar: '#c2410c', shop: '#b45309', wc: '#475569', entry: '#0f766e' };
    return '<div class="mapa"><svg viewBox="0 0 100 70">' + itens.map(function (i) {
      var nome = i.nome || '', key = nome.toLowerCase(), area = i.t === 'area';
      var v = dv.filter(function (x) { return (x.l.area || '') === key && x.estado === 'venda'; }), min = v.length ? Math.min.apply(null, v.map(function (x) { return x.l.preco_centavos; })) : null;
      return '<g class="' + (area ? 'area' : '') + (filtro && area ? (filtro === key ? ' sel' : ' apaga') : '') + '" data-area="' + esc(key) + '"><rect x="' + i.x + '" y="' + i.y + '" width="' + i.w + '" height="' + i.h + '" rx="1.4" fill="' + (i.cor || cores[i.t] || '#555') + '"' + (area && !v.length ? ' fill-opacity=".35"' : '') + '/>' +
        '<text x="' + (i.x + i.w / 2) + '" y="' + (i.y + i.h / 2 + (min ? 0 : 1)) + '" font-size="' + Math.min(3.2, i.w / 6) + '" text-anchor="middle" fill="#fff" font-family="Archivo" font-weight="800">' + esc(nome) + '</text>' +
        (area ? '<text x="' + (i.x + i.w / 2) + '" y="' + (i.y + i.h / 2 + 3.4) + '" font-size="2" text-anchor="middle" fill="#fff" font-family="Archivo">' + (min ? 'a partir de ' + money(min) : 'esgotado') + '</text>' : '') + '</g>';
    }).join('') + '</svg><div class="small muted" style="margin-top:6px">Toque numa área para ver os ingressos dela.</div></div>';
  }

  function telaEvento(slug) {
    var ev = EVENTOS.find(function (e) { return e.slug === slug; });
    if (!ev) { A.innerHTML = '<div class="wrap" style="padding:60px 0;text-align:center"><h2>Evento não encontrado</h2><a class="btn prim" href="#/">Ver eventos</a></div>'; return; }
    document.title = ev.nome + ' · ' + ORG.nome;
    var end = [local(ev), endereco(ev)].filter(Boolean).join(', '), q = encodeURIComponent(end);
    var promos = PROMOS.filter(function (p) { return !p.evento_id || p.evento_id === ev.id; });
    var junto = LOJA.filter(function (p) { return p.compre_junto; });
    var filtro = null, sel = {};
    function desenhar() {
      var dv = lotesDaVez(ev).filter(function (x) { return !filtro || (x.l.area || '') === filtro; });
      A.innerHTML = (ev.video_url ? '<video src="' + esc(ev.video_url) + '" autoplay muted loop playsinline style="width:100%;max-height:52vh;object-fit:cover;display:block"></video>' : ev.capa_url ? '<div class="hero" style="min-height:44vh;background-image:url(\'' + esc(ev.capa_url) + '\')"></div>' : '') +
        '<div class="wrap" style="margin-top:' + (ev.capa_url || ev.video_url ? '-30px' : '20px') + ';position:relative">' +
        '<span class="pill">' + quando(ev.inicio) + '</span><h1 style="margin-top:8px;font-size:clamp(28px,7vw,48px)">' + esc(ev.nome) + '</h1>' +
        '<div class="muted"><i class="ti ti-map-pin"></i> ' + esc(end) + '</div>' +
        '<div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap"><a class="btn peq" target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=' + q + '">Google Maps</a><a class="btn peq" target="_blank" href="https://waze.com/ul?q=' + q + '&navigate=yes">Waze</a><a class="btn peq" target="_blank" href="https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=' + q + '">Uber</a></div>' +
        (ev.descricao ? '<p style="white-space:pre-line">' + esc(ev.descricao) + '</p>' : '') +
        (promos.length ? '<div class="card" style="margin-bottom:14px;border-color:var(--dest)">' + promos.map(function (p) { return '<div><i class="ti ti-gift" style="color:var(--dest)"></i> A cada ' + p.a_cada + ' ingressos, ganhe 1 ' + esc(p.produtos ? p.produtos.nome : 'brinde') + '</div>'; }).join('') + '</div>' : '') +
        (ev.tipo === 'excursao' ? '<div id="excursao"></div>' :
          svgMapa(ev, filtro) + (filtro ? '<button class="btn peq" id="limpar-filtro" style="margin:10px 0">Ver todas as áreas</button>' : '') +
          '<h2 style="margin-top:18px">Ingressos</h2>' + (dv.length ? dv.map(function (x) {
            var l = x.l, livre = l.quantidade - l.vendidos, n = sel[l.id] || 0;
            return '<div class="lote ' + (x.estado === 'venda' ? '' : 'off') + '"><div><b>' + esc(l.nome) + '</b>' + (l.pessoas_por_ingresso > 1 ? ' <span class="small muted">· entrada para ' + l.pessoas_por_ingresso + ' pessoas</span>' : '') + (l.descricao ? '<div class="small muted">' + esc(l.descricao) + '</div>' : '') +
              '<div style="color:var(--dest);font-weight:900">' + money(l.preco_centavos) + '</div>' + (x.estado === 'venda' && livre <= 10 ? '<div class="small" style="color:var(--erro)">Últimos ' + livre + '!</div>' : '') + '</div>' +
              (x.estado === 'venda' ? '<div class="qtd"><button data-menos="' + l.id + '">−</button><b>' + n + '</b><button data-mais="' + l.id + '">+</button></div>' : '<span class="pill cinza">' + { esgotado: 'Esgotado', proximo: 'Próximo lote', fechado: 'Em breve' }[x.estado] + '</span>') + '</div>';
          }).join('') : '<p class="muted">Ainda não há ingressos à venda.</p>') +
          (junto.length ? '<h3 style="margin-top:18px">Leve junto <span class="small muted">· retire no evento</span></h3><div class="grade">' + junto.map(cardProduto).join('') + '</div>' : '') +
          '<div style="position:sticky;bottom:76px;margin-top:16px"><button class="btn prim full" id="add-ing" disabled>Escolha os ingressos</button></div>') +
        '</div>';
      $$('g.area').forEach(function (g) { g.onclick = function () { filtro = filtro === g.dataset.area ? null : g.dataset.area; desenhar(); }; });
      if ($('#limpar-filtro')) $('#limpar-filtro').onclick = function () { filtro = null; desenhar(); };
      $$('[data-mais]').forEach(function (b) { b.onclick = function () { var l = ev.lotes.find(function (x) { return x.id === b.dataset.mais; }); var n = (sel[l.id] || 0) + 1; if (n > Math.min(l.max_por_pedido, l.quantidade - l.vendidos)) return Clic.toast('Máximo disponível atingido', true); sel[l.id] = n; desenhar(); }; });
      $$('[data-menos]').forEach(function (b) { b.onclick = function () { sel[b.dataset.menos] = Math.max(0, (sel[b.dataset.menos] || 0) - 1); desenhar(); }; });
      ligarProdutos(A);
      var tot = 0, qt = 0; Object.keys(sel).forEach(function (id) { var l = ev.lotes.find(function (x) { return x.id === id; }); tot += sel[id] * l.preco_centavos; qt += sel[id]; });
      var b = $('#add-ing');
      if (b) {
        if (qt) { b.disabled = false; b.innerHTML = 'Adicionar ' + qt + ' ingresso(s) · ' + money(tot); }
        b.onclick = function () {
          Object.keys(sel).forEach(function (id) { if (!sel[id]) return; var l = ev.lotes.find(function (x) { return x.id === id; }); addCart({ tipo: 'lote', id: id, qtd: sel[id], nome: ev.nome + ' · ' + l.nome, preco: l.preco_centavos, evento: ev.id }); });
          sel = {}; location.hash = '#/carrinho';
        };
      }
      if (ev.tipo === 'excursao') telaExcursao(ev);
    }
    desenhar();
  }

  // ------------------------------------------------------------ excursão: escolha de poltrona
  async function telaExcursao(ev) {
    var box = $('#excursao'), veics = ev.veiculos || [], escolha = [];
    if (!veics.length) { box.innerHTML = '<p class="muted">Vendas em breve.</p>'; return; }
    var ocup = {};
    await Promise.all(veics.map(async function (v) { var r = await sb.rpc('poltronas_ocupadas', { p_veiculo: v.id }); ocup[v.id] = (r.data || []).concat(v.bloqueadas || []); }));
    var noCart = cart().filter(function (i) { return i.poltrona; });
    function desenhar() {
      box.innerHTML = (ev.volta ? '<div class="card" style="margin-bottom:12px"><i class="ti ti-arrow-back-up"></i> Volta: ' + quando(ev.volta) + '</div>' : '') +
        veics.map(function (v) {
          var classes = {}; (v.classes_poltrona || []).forEach(function (c) { var l = ev.lotes.find(function (x) { return x.id === c.lote_id; }); classes[c.codigo] = { nome: c.nome, cor: c.cor, lote: l }; });
          return '<div class="card" style="margin-bottom:14px"><h3>' + esc(v.nome) + '</h3><div class="small muted">' + esc(v.descricao || '') + '</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0">' + Object.keys(classes).map(function (k) { var c = classes[k]; return '<span class="pill" style="background:' + c.cor + '33;color:' + c.cor + '">' + esc(c.nome) + (c.lote ? ' · ' + money(c.lote.preco_centavos) : '') + '</span>'; }).join('') + '<span class="pill cinza">Ocupada</span></div>' +
            '<div style="overflow-x:auto">' + v.andares.map(function (a) {
              return '<div style="display:inline-block;vertical-align:top;margin-right:12px"><div class="small muted" style="margin-bottom:6px">' + esc(a.nome) + '</div><div class="bus">' + a.fileiras.map(function (f) {
                return '<div class="fil">' + f.map(function (c) {
                  if (!c) return '<div></div>';
                  if (c.f) return '<div class="f" style="grid-column:span ' + (c.w || 1) + '">' + ({ motorista: 'motorista', porta: 'porta', vista: 'vista', escada: 'escada', wc: 'WC' }[c.f] || '') + '</div>';
                  var cl = classes[c.c] || {}, oc = ocup[v.id].indexOf(c.s) >= 0 || noCart.some(function (i) { return i.veiculo_id === v.id && i.poltrona === c.s; }), es = escolha.some(function (x) { return x.v === v.id && x.s === c.s; });
                  return '<button class="s' + (oc ? ' oc' : '') + (es ? ' sel' : '') + '" style="background:' + (cl.cor || '#888') + ';grid-column:span ' + (c.w || 1) + '" data-v="' + v.id + '" data-s="' + esc(c.s) + '" data-c="' + esc(c.c) + '"' + (oc || !cl.lote ? ' disabled' : '') + '>' + esc(c.s) + '</button>';
                }).join('') + '</div>';
              }).join('') + '</div></div>';
            }).join('') + '</div></div>';
        }).join('') +
        (escolha.length ? '<div class="card"><h3>Passageiros</h3>' + escolha.map(function (x, i) {
          return '<div style="border-top:1px solid var(--linha);padding-top:10px;margin-top:10px"><b>Poltrona ' + esc(x.s) + '</b> · ' + esc(x.classe) + ' · ' + money(x.preco) +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>Nome completo</label><input data-pn="' + i + '" value="' + esc(x.nome || '') + '"></div><div><label>Documento (RG/CPF)</label><input data-pd="' + i + '" value="' + esc(x.doc || '') + '"></div></div></div>';
        }).join('') + ((ev.pontos_embarque || []).length ? '<label>Ponto de embarque</label><select id="embarque">' + ev.pontos_embarque.sort(function (a, b) { return new Date(a.quando) - new Date(b.quando); }).map(function (p) { return '<option value="' + p.id + '">' + Clic.data(p.quando, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · ' + esc(p.local) + '</option>'; }).join('') + '</select>' : '') +
          '<button class="btn prim full" style="margin-top:14px" id="add-pol">Adicionar ' + escolha.length + ' poltrona(s) · ' + money(escolha.reduce(function (a, x) { return a + x.preco; }, 0)) + '</button><div class="erro" id="pol-erro"></div></div>' : '<p class="muted">Toque numa poltrona livre para escolher.</p>');
      $$('.bus .s', box).forEach(function (b) {
        b.onclick = function () {
          var k = escolha.findIndex(function (x) { return x.v === b.dataset.v && x.s === b.dataset.s; });
          if (k >= 0) escolha.splice(k, 1);
          else {
            var v = veics.find(function (x) { return x.id === b.dataset.v; }), c = (v.classes_poltrona || []).find(function (x) { return x.codigo === b.dataset.c; }), l = ev.lotes.find(function (x) { return x.id === c.lote_id; });
            escolha.push({ v: v.id, s: b.dataset.s, lote: l.id, preco: l.preco_centavos, classe: c.nome });
          }
          desenhar();
        };
      });
      $$('[data-pn]', box).forEach(function (i) { i.oninput = function () { escolha[+i.dataset.pn].nome = i.value; }; });
      $$('[data-pd]', box).forEach(function (i) { i.oninput = function () { escolha[+i.dataset.pd].doc = i.value; }; });
      var b = $('#add-pol', box);
      if (b) b.onclick = function () {
        if (escolha.some(function (x) { return !(x.nome || '').trim() || !(x.doc || '').trim(); })) { $('#pol-erro').textContent = 'Preencha nome e documento de cada passageiro.'; return; }
        var emb = $('#embarque') ? $('#embarque').value : null;
        escolha.forEach(function (x) { addCart({ tipo: 'lote', id: x.lote, qtd: 1, nome: ev.nome + ' · Poltrona ' + x.s + ' (' + x.classe + ') · ' + x.nome, preco: x.preco, evento: ev.id, veiculo_id: x.v, poltrona: x.s, passageiro_nome: x.nome.trim(), passageiro_doc: x.doc.trim(), embarque_id: emb }); });
        location.hash = '#/carrinho';
      };
    }
    desenhar();
  }

  // ------------------------------------------------------------ carrinho e pagamento
  var linkConferido = false;
  function telaCarrinho() {
    // quem veio pelo link do promoter já vê o desconto dele (se houver)
    if (!CUPOM && !linkConferido && promoterLink()) {
      linkConferido = true;
      sb.rpc('cupom_info', { p_org_slug: SLUG, p_codigo: promoterLink() }).then(function (r) { if (r.data && r.data.desconto_pct > 0 && location.hash === '#/carrinho') { CUPOM = r.data; telaCarrinho(); } });
    }
    var c = cart(), bruto = c.reduce(function (a, i) { return a + i.qtd * i.preco; }, 0);
    var ingressos = c.filter(function (i) { return i.tipo === 'lote'; }).reduce(function (a, i) { return a + i.qtd * i.preco; }, 0);
    var desc = CUPOM ? Math.round(ingressos * CUPOM.desconto_pct / 100) : 0, sub = bruto - desc, taxa = taxaServico(sub);
    var online = ORG.venda_online_liberada && ORG.asaas_conectado;
    var dados = JSON.parse(localStorage.getItem('clic_comprador') || '{}');
    A.innerHTML = '<div class="wrap" style="padding-top:20px"><h1>Carrinho</h1>' + (!c.length ? '<div class="card" style="text-align:center"><h3>Carrinho vazio</h3><p>Escolha seus ingressos ou produtos.</p><a class="btn prim" href="#/">Ver eventos</a></div></div>' :
      '<div class="card">' + c.map(function (i, k) {
        return '<div class="linha-tot"><div style="flex:1"><b>' + i.qtd + '×</b> ' + esc(i.nome) + '</div><div style="text-align:right">' + money(i.qtd * i.preco) + '<br><a href="#" class="small" data-rm="' + k + '">remover</a></div></div>';
      }).join('') + '<div class="linha-tot"><span>Subtotal</span><span>' + money(bruto) + '</span></div>' + (desc ? '<div class="linha-tot" style="color:var(--verde,#16a34a)"><span>Cupom ' + esc(CUPOM.codigo.toUpperCase()) + ' (−' + Number(CUPOM.desconto_pct).toLocaleString('pt-BR') + '% nos ingressos)</span><span>−' + money(desc) + '</span></div>' : '') + (taxa ? '<div class="linha-tot"><span>Taxa de serviço</span><span>' + money(taxa) + '</span></div>' : '') +
      '<div class="linha-tot" style="border:0"><b>Total</b><b style="font-size:20px">' + money(sub + taxa) + '</b></div>' + (online ? '<div class="small muted">A taxa do Pix ou do cartão aparece antes de pagar.</div>' : '') + '</div>' +
      '<form class="card" id="f-check" style="margin-top:14px"><h3>Seus dados</h3><label>Nome completo</label><input name="nome" required value="' + esc(dados.nome || '') + '" autocomplete="name">' +
      '<label>E-mail</label><input name="email" type="email" required value="' + esc(dados.email || '') + '" autocomplete="email"><label>CPF</label><input name="cpf" inputmode="numeric" ' + (online ? 'required ' : '') + 'value="' + esc(dados.cpf || '') + '"><label>WhatsApp (o ingresso chega nele)</label><input name="whatsapp" inputmode="tel" required value="' + esc(dados.whatsapp || '') + '" autocomplete="tel">' +
      (online ? '<label>Pagamento</label><select name="metodo"><option value="pix">Pix (aprovação na hora)</option><option value="cartao">Cartão de crédito' + (ORG.parcelas_max > 1 ? ' (até ' + ORG.parcelas_max + 'x)' : '') + '</option></select>' : '') +
      '<label>Cupom de desconto (opcional)</label><div style="display:flex;gap:8px"><input name="cupom" id="cupom" autocomplete="off" autocapitalize="characters" style="flex:1;text-transform:uppercase" value="' + esc(CUPOM ? CUPOM.codigo.toUpperCase() : '') + '"><button type="button" class="btn" id="b-cupom">' + (CUPOM ? 'Remover' : 'Aplicar') + '</button></div><div class="small" id="cupom-msg" style="margin:4px 0 8px">' + (CUPOM ? (CUPOM.desconto_pct > 0 ? 'Cupom de ' + esc(CUPOM.nome) + ' aplicado.' : 'Código de ' + esc(CUPOM.nome) + ' registrado.') : '') + '</div>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;color:var(--txt2)"><input type="checkbox" name="aceito" required> Li e aceito: o ingresso é pessoal, tem QR Code de uso único e pode ser cancelado conforme as regras do evento.</label>' +
      '<button class="btn prim full" style="margin-top:12px">' + (online ? 'Ir para o pagamento' : 'Enviar pedido pelo WhatsApp') + '</button>' + (online ? '' : '<div class="small muted" style="margin-top:8px">A compra online ainda não está liberada. Envie o pedido e a equipe confirma com você.</div>') + '<div class="erro" id="ch-erro"></div></form>' +
      '<button class="btn peq" id="esvaziar" style="margin-top:12px">Esvaziar carrinho</button></div>');
    $$('[data-rm]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var x = cart(); x.splice(+a.dataset.rm, 1); salvarCart(x); telaCarrinho(); }; });
    if ($('#esvaziar')) $('#esvaziar').onclick = function () { if (confirm('Tirar tudo do carrinho?')) { salvarCart([]); telaCarrinho(); } };
    var f = $('#f-check'); if (!f) return;
    $('#b-cupom').onclick = async function () {
      if (CUPOM) { CUPOM = null; telaCarrinho(); return; }
      var cod = f.cupom.value.trim(); if (!cod) return;
      var r = await sb.rpc('cupom_info', { p_org_slug: SLUG, p_codigo: cod });
      if (!r.data) { $('#cupom-msg').innerHTML = '<span class="erro">Cupom não encontrado.</span>'; return; }
      // guarda o que já foi digitado antes de redesenhar
      localStorage.setItem('clic_comprador', JSON.stringify({ nome: f.nome.value, email: f.email.value, cpf: f.cpf.value, whatsapp: f.whatsapp.value }));
      CUPOM = r.data; telaCarrinho();
    };
    f.onsubmit = async function (e) {
      e.preventDefault(); var btn = f.querySelector('.prim'), err = $('#ch-erro'); err.textContent = '';
      var cli = { nome: f.nome.value.trim(), email: f.email.value.trim(), cpf: f.cpf.value, whatsapp: f.whatsapp.value };
      var cupomTxt = CUPOM ? CUPOM.codigo : '';
      if (!CUPOM && f.cupom.value.trim()) { err.textContent = 'Toque em "Aplicar" para usar o cupom, ou apague o campo.'; return; }
      if (online && cli.cpf.replace(/\D/g, '').length !== 11) { err.textContent = 'Confira o CPF.'; return; }
      localStorage.setItem('clic_comprador', JSON.stringify(cli));
      Clic.carregando(btn, true, 'Reservando…');
      var itens = cart().map(function (i) { return { tipo: i.tipo, id: i.id, qtd: i.qtd, tamanho: i.tamanho || '', veiculo_id: i.veiculo_id || '', poltrona: i.poltrona || '', passageiro_nome: i.passageiro_nome || '', passageiro_doc: i.passageiro_doc || '', embarque_id: i.embarque_id || '' }; });
      var r = await sb.rpc('criar_pedido', { p_org_slug: SLUG, p_canal: window.matchMedia('(display-mode: standalone)').matches ? 'app' : 'site', p_itens: itens, p_cliente: Object.assign({}, cli, { cupom: cupomTxt, promoter: promoterLink() }) });
      if (r.error) { err.textContent = Clic.erro(r.error); Clic.carregando(btn, false); return; }
      guardarPedido({ token: r.data.token, codigo: r.data.codigo, quando: new Date().toISOString() });
      salvarCart([]);
      if (r.data.forma === 'whatsapp') {
        var txt = 'Olá! Quero confirmar meu pedido ' + r.data.codigo + ' (' + money(r.data.total_centavos) + '):\n' + c.map(function (i) { return '• ' + i.qtd + 'x ' + i.nome; }).join('\n') + '\nNome: ' + cli.nome;
        if (T('whatsapp')) window.open('https://wa.me/55' + T('whatsapp').replace(/\D/g, '') + '?text=' + encodeURIComponent(txt), '_blank');
        location.hash = '#/p/' + r.data.token; return;
      }
      var pg = await sb.functions.invoke('pagar', { body: { token: r.data.token, metodo: f.metodo.value } });
      if (pg.error || !pg.data) { Clic.toast('Pedido reservado. Não foi possível abrir o pagamento agora; tente de novo pelo pedido.', true); }
      else sessionStorage.setItem('clic_pg_' + r.data.token, JSON.stringify(pg.data));
      location.hash = '#/p/' + r.data.token;
    };
  }

  // ------------------------------------------------------------ pedido / ingressos
  async function telaPedido(token) {
    A.innerHTML = '<div class="wrap" style="padding:40px 0;text-align:center" class="muted">Carregando…</div>';
    var r = await sb.rpc('meu_pedido', { p_token: token }), p = r.data;
    if (!p) { A.innerHTML = '<div class="wrap" style="padding:60px 0;text-align:center"><h2>Pedido não encontrado</h2></div>'; return; }
    var pg = JSON.parse(sessionStorage.getItem('clic_pg_' + token) || 'null');
    var html = '<div class="wrap" style="padding-top:20px"><div class="small muted">Pedido ' + esc(p.codigo) + '</div><h1>' + (p.evento ? esc(p.evento.nome) : 'Seu pedido') + '</h1>' + (p.evento ? '<div class="muted">' + quando(p.evento.inicio) + ' · ' + esc(p.evento.local || '') + '</div>' : '') + '<div style="height:12px"></div>';
    if (p.situacao === 'aguardando') {
      html += '<div class="card" style="border-color:var(--dest)"><h3>Aguardando pagamento · ' + money(p.total_centavos) + '</h3>';
      if (p.forma === 'whatsapp') html += '<p>Seu pedido foi enviado. A equipe confirma pelo WhatsApp e os ingressos aparecem aqui.</p>' + (T('whatsapp') ? '<a class="btn prim" target="_blank" href="https://wa.me/55' + esc(T('whatsapp').replace(/\D/g, '')) + '?text=' + encodeURIComponent('Pedido ' + p.codigo) + '"><i class="ti ti-brand-whatsapp"></i> Falar com a equipe</a>' : '');
      else if (pg && pg.pix_copia_cola) html += '<p>Pague com Pix. A confirmação é automática.</p>' + (pg.pix_qr ? '<div class="qr"><img src="data:image/png;base64,' + pg.pix_qr + '" width="220" alt="QR Pix"></div>' : '') + '<div style="display:flex;gap:8px"><input readonly value="' + esc(pg.pix_copia_cola) + '"><button class="btn prim" id="copiar-pix">Copiar</button></div>';
      else if (pg && pg.link) html += '<p>Finalize o pagamento no cartão.</p><a class="btn prim full" target="_blank" href="' + esc(pg.link) + '">Pagar com cartão</a>';
      else html += '<button class="btn prim" id="tentar-pg">Pagar agora</button>';
      html += '<div class="small muted" style="margin-top:10px">A reserva vale até ' + Clic.data(p.expira_em, { hour: '2-digit', minute: '2-digit' }) + '. Esta página atualiza sozinha.</div></div>';
    } else if (p.situacao === 'pago') {
      html += '<div class="pill verde" style="margin-bottom:12px">Pagamento confirmado 🎉</div>';
      if (p.codigo_retirada) html += '<div class="card" style="margin-bottom:14px;text-align:center"><div class="small muted">Código de retirada (produtos e brindes)</div><div style="font-size:30px;font-weight:900;letter-spacing:.1em">' + esc(p.codigo_retirada) + '</div>' + (p.retirado ? '<span class="pill cinza">Já retirado</span>' : '<div class="small muted">Mostre no balcão da loja no dia do evento.</div>') + '</div>';
      html += p.ingressos.map(function (i, k) {
        var qr = qrcode(0, 'M'); qr.addData(i.qr); qr.make();
        return '<div class="ingresso"><b>' + esc(i.descricao) + '</b>' + (i.passageiro ? '<div>' + esc(i.passageiro) + (i.poltrona ? ' · poltrona ' + esc(i.poltrona) : '') + '</div>' : '') + (i.embarque ? '<div class="small muted">Embarque: ' + esc(i.embarque) + '</div>' : '') +
          (i.situacao === 'valido' ? '<div class="qr">' + qr.createSvgTag(5, 0) + '</div><div class="small muted">Ingresso ' + (k + 1) + ' de ' + p.ingressos.length + ' · válido para uma entrada</div>' : '<div style="margin:16px 0"><span class="pill cinza">' + (i.situacao === 'usado' ? 'Já utilizado' : 'Cancelado') + '</span></div>') + '</div>';
      }).join('');
    } else html += '<div class="card"><h3>Pedido ' + ({ expirado: 'expirado', cancelado: 'cancelado', estornado: 'estornado', em_analise: 'em análise' }[p.situacao] || p.situacao) + '</h3><p>' + (p.situacao === 'expirado' ? 'O tempo para pagar acabou e os ingressos voltaram à venda.' : 'Fale com a equipe se tiver dúvidas.') + '</p><a class="btn" href="#/">Voltar aos eventos</a></div>';
    html += '<div class="card" style="margin-top:14px"><h3>Itens</h3>' + p.itens.map(function (i) { return '<div class="linha-tot"><span>' + i.qtd + '× ' + esc(i.descricao) + '</span><span>' + money(i.qtd * i.preco) + '</span></div>'; }).join('') + '<div class="linha-tot" style="border:0"><b>Total</b><b>' + money(p.total_centavos) + '</b></div></div>' +
      '<p class="small muted" style="margin-top:14px">Guarde este link: é por ele que você acessa seus ingressos. Também ficam salvos em "Meus ingressos" neste aparelho.</p></div>';
    A.innerHTML = html;
    if ($('#copiar-pix')) $('#copiar-pix').onclick = function () { navigator.clipboard.writeText(pg.pix_copia_cola); Clic.toast('Código Pix copiado'); };
    if ($('#tentar-pg')) $('#tentar-pg').onclick = async function () {
      var x = await sb.functions.invoke('pagar', { body: { token: token, metodo: 'pix' } });
      if (x.error || !x.data) return Clic.toast('Pagamento indisponível no momento.', true);
      sessionStorage.setItem('clic_pg_' + token, JSON.stringify(x.data)); telaPedido(token);
    };
    if (p.situacao === 'aguardando') window.__poll = setInterval(async function () {
      var y = await sb.rpc('meu_pedido', { p_token: token });
      if (y.data && y.data.situacao !== 'aguardando') { clearInterval(window.__poll); if (y.data.situacao === 'pago') Clic.toast('Pagamento confirmado! Seus ingressos estão aqui 🎉'); telaPedido(token); }
    }, 5000);
  }

  async function telaMeus() {
    var l = pedidosSalvos();
    A.innerHTML = '<div class="wrap" style="padding-top:20px"><h1>Meus ingressos</h1>' + (l.length ? '<div id="lista-meus" class="muted">Carregando…</div>' : '<div class="card" style="text-align:center"><h3>Nenhum ingresso neste aparelho</h3><p>Seus pedidos aparecem aqui depois da compra.</p><a class="btn prim" href="#/">Ver eventos</a></div>') + '</div>';
    if (!l.length) return;
    var rs = await Promise.all(l.map(function (x) { return sb.rpc('meu_pedido', { p_token: x.token }); }));
    $('#lista-meus').innerHTML = rs.map(function (r, i) {
      var p = r.data; if (!p) return '';
      return '<a class="lote" style="color:var(--txt)" href="#/p/' + l[i].token + '"><div><b>' + esc(p.evento ? p.evento.nome : 'Pedido ' + p.codigo) + '</b><div class="small muted">' + (p.evento ? quando(p.evento.inicio) : '') + ' · ' + p.ingressos.length + ' ingresso(s)</div></div><span class="pill ' + (p.situacao === 'pago' ? 'verde' : 'cinza') + '">' + ({ pago: 'Pago', aguardando: 'Aguardando', expirado: 'Expirado', cancelado: 'Cancelado' }[p.situacao] || p.situacao) + '</span></a>';
    }).join('');
  }

  // ------------------------------------------------------------ locações
  function telaLocacoes() {
    A.innerHTML = '<div class="wrap" style="padding-top:20px"><h1>Espaços e locações</h1><div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">' + ESPACOS.map(function (e) {
      return '<div class="prod">' + (e.foto_url ? '<div class="img" style="aspect-ratio:16/10;background-image:url(\'' + esc(e.foto_url) + '\')"></div>' : '') + '<div class="p"><h3>' + esc(e.nome) + '</h3><div class="small muted">' + esc([e.endereco, e.cidade].filter(Boolean).join(', ')) + (e.capacidade ? ' · até ' + e.capacidade + ' pessoas' : '') + '</div>' + (e.valor_base_centavos ? '<div style="color:var(--dest);font-weight:800">A partir de ' + money(e.valor_base_centavos) + '</div>' : '') + '<p class="small">' + esc(e.descricao || '') + '</p></div></div>';
    }).join('') + '</div><form class="card" id="f-loc" style="margin-top:16px;position:relative"><h3>Pedir orçamento</h3><input name="sobrenome_x" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0"><label>Espaço</label><select name="espaco"><option value="">Qualquer</option>' + ESPACOS.map(function (e) { return '<option value="' + e.id + '">' + esc(e.nome) + '</option>'; }).join('') + '</select>' +
      '<label>Nome</label><input name="nome" required><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>WhatsApp</label><input name="whatsapp" required></div><div><label>E-mail</label><input name="email" type="email"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>Data desejada</label><input name="data" type="date"></div><div><label>Convidados</label><input name="convidados" type="number" min="1"></div></div><label>Mensagem</label><textarea name="mensagem" rows="3"></textarea><button class="btn prim full" style="margin-top:12px">Enviar pedido</button></form></div>' + rodape();
    $('#f-loc').__t = Date.now();
    $('#f-loc').onsubmit = async function (e) {
      e.preventDefault(); var f = this;
      if (robo(f)) { Clic.toast('Pedido enviado! Entraremos em contato.'); f.reset(); return; }
      var r = await sb.rpc('solicitar_locacao', { p_org_slug: SLUG, p_espaco: f.espaco.value || null, p_dados: { nome: f.nome.value, whatsapp: f.whatsapp.value, email: f.email.value, data: f.data.value, convidados: f.convidados.value, mensagem: f.mensagem.value } });
      Clic.toast(r.data ? 'Pedido enviado! Entraremos em contato.' : 'Não foi possível enviar.', !r.data); if (r.data) f.reset();
    };
  }

  iniciar();
})();
