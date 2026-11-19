/* Clic Reservas 2.0 — PDV (bilheteria, bar, cozinha e loja) */
(function () {
  'use strict';
  var sb = Clic.sb, $ = Clic.$, $$ = Clic.$$, esc = Clic.esc, money = Clic.money;
  var EU, MEMBRO, ORG, AREA, CAIXA, ITENS = [], CART = [], FORMA = 'dinheiro';
  var T = $('#tela');
  var NOMES = { bilheteria: ['Bilheteria', 'ticket'], bar: ['Bar', 'beer'], cozinha: ['Cozinha', 'chef-hat'], loja: ['Loja', 'shirt'] };

  async function iniciar() {
    var s = await Clic.sessao();
    if (!s) { location.href = '/?voltar=/pdv/#entrar'; return; }
    EU = s.user;
    var m = await sb.from('membros').select('*, organizacoes(id,nome,slug)').eq('user_id', EU.id).eq('ativo', true).limit(1).maybeSingle();
    if (!m.data) { T.innerHTML = '<div class="card" style="margin:20px">Este login não faz parte de nenhuma equipe.</div>'; return; }
    MEMBRO = m.data; ORG = m.data.organizacoes;
    $('#t-casa').textContent = ORG.nome + ' · PDV';
    var a = new URLSearchParams(location.search).get('area');
    if (a && podeArea(a)) return entrarArea(a);
    escolherArea();
  }
  function podeArea(a) { return MEMBRO.funcao !== 'operador' || MEMBRO.areas.indexOf(a) >= 0; }

  async function escolherArea() {
    AREA = null; history.replaceState(null, '', '/pdv/');
    var cx = await sb.from('caixas').select('area').eq('usuario_id', EU.id).eq('situacao', 'aberto');
    var abertos = (cx.data || []).map(function (c) { return c.area; });
    $('#t-acoes').innerHTML = (MEMBRO.funcao !== 'operador' ? '<a class="btn peq" href="/painel/">Painel</a>' : '') + '<button class="btn peq" id="sair">Sair</button>';
    $('#sair').onclick = async function () { await sb.auth.signOut(); location.href = '/'; };
    var lista = Object.keys(NOMES).filter(podeArea);
    T.innerHTML = '<div style="padding:16px 16px 0"><h2>Olá, ' + esc(MEMBRO.nome.split(' ')[0]) + '</h2><p>Escolha onde você vai vender agora.</p></div><div class="areas">' + lista.map(function (a) {
      return '<button data-a="' + a + '"><i class="ti ti-' + NOMES[a][1] + '"></i>' + NOMES[a][0] + '<div class="small muted" style="font-weight:500;margin-top:4px">' + (abertos.indexOf(a) >= 0 ? '<span class="ok">Caixa aberto</span>' : 'Caixa fechado') + '</div></button>';
    }).join('') + '</div>';
    $$('[data-a]').forEach(function (b) { b.onclick = function () { entrarArea(b.dataset.a); }; });
  }

  async function entrarArea(a) {
    AREA = a; history.replaceState(null, '', '/pdv/?area=' + a);
    var cx = await sb.from('caixas').select('*').eq('usuario_id', EU.id).eq('area', a).eq('situacao', 'aberto').maybeSingle();
    CAIXA = cx.data;
    $('#t-acoes').innerHTML = '<button class="btn peq" id="trocar">Trocar área</button>' + (CAIXA ? '<button class="btn peq" id="sangria">Sangria</button><button class="btn peq perigo" id="fechar">Fechar caixa</button>' : '');
    $('#trocar').onclick = escolherArea;
    if (!CAIXA) {
      T.innerHTML = '<form class="card" id="f-abrir" style="max-width:420px;margin:30px auto"><h2>' + NOMES[a][0] + '</h2><h3>Abrir caixa</h3><p>Informe quanto há de dinheiro na gaveta para troco. Se não houver, deixe 0,00.</p><label>Fundo de troco (R$)</label><input name="fundo" value="0,00" inputmode="decimal"><button class="btn prim full" style="margin-top:14px">Abrir caixa e começar a vender</button></form>';
      $('#f-abrir').onsubmit = async function (e) {
        e.preventDefault();
        var r = await sb.rpc('abrir_caixa', { p_org: ORG.id, p_area: a, p_fundo_centavos: Clic.centavos(this.fundo.value) });
        if (r.error) return Clic.toast(Clic.erro(r.error), true);
        entrarArea(a);
      };
      return;
    }
    $('#sangria').onclick = sangria; $('#fechar').onclick = fecharCaixa;
    await carregarItens(); CART = []; FORMA = 'dinheiro'; desenhar();
  }

  async function carregarItens() {
    if (AREA === 'bilheteria') {
      var r = await sb.from('lotes').select('*, eventos!inner(nome,inicio,fim,situacao,tipo,capa_url)').eq('org_id', ORG.id).eq('ativo', true).in('eventos.situacao', ['a_venda', 'esgotado']).neq('eventos.tipo', 'excursao').order('ordem');
      var limite = Date.now() - 12 * 36e5;
      ITENS = (r.data || []).filter(function (l) { return new Date(l.eventos.fim || l.eventos.inicio).getTime() > limite; }).map(function (l) {
        return { id: l.id, nome: l.nome, sub: l.eventos.nome, preco: l.preco_centavos, livre: l.quantidade - l.vendidos, img: l.eventos.capa_url };
      });
    } else {
      var p = await sb.from('produtos').select('*').eq('org_id', ORG.id).eq('categoria', AREA).eq('ativo', true).order('nome');
      ITENS = (p.data || []).map(function (x) { return { id: x.id, nome: x.nome, preco: x.preco_centavos, livre: x.estoque, img: x.foto_url, tamanhos: x.tamanhos }; });
    }
  }

  function total() { return CART.reduce(function (a, i) { return a + i.qtd * i.preco; }, 0); }
  function desenhar() {
    T.innerHTML = '<div class="venda"><div><div style="padding:14px 14px 0"><input id="busca" placeholder="Buscar…"></div><div class="itens" id="itens"></div></div>' +
      '<div class="lado"><h3>' + NOMES[AREA][0] + ' · venda</h3><div class="cart" id="cart"></div>' +
      '<div class="formas">' + [['dinheiro', 'Dinheiro'], ['pix_balcao', 'Pix'], ['cartao_balcao', 'Cartão'], ['point', 'Maquininha']].map(function (f) { return '<button data-f="' + f[0] + '" class="' + (FORMA === f[0] ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div id="troco-box"' + (FORMA === 'dinheiro' ? '' : ' style="display:none"') + '><label>Valor recebido (R$)</label><input id="recebido" inputmode="decimal"><div id="troco" class="small" style="margin-top:4px"></div></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0"><span class="muted">Total</span><span class="total" id="total">' + money(total()) + '</span></div>' +
      '<button class="btn prim full" id="finalizar">Finalizar venda</button><button class="btn full" style="margin-top:8px" id="limpar">Limpar</button></div></div>';
    desenharItens(''); desenharCart();
    $('#busca').oninput = function () { desenharItens(this.value.toLowerCase()); };
    $$('[data-f]').forEach(function (b) { b.onclick = function () { FORMA = b.dataset.f; $$('[data-f]').forEach(function (x) { x.classList.toggle('on', x === b); }); $('#troco-box').style.display = FORMA === 'dinheiro' ? '' : 'none'; }; });
    $('#recebido').oninput = calcTroco;
    $('#limpar').onclick = function () { CART = []; desenharCart(); };
    $('#finalizar').onclick = finalizar;
  }
  function desenharItens(f) {
    var lista = ITENS.filter(function (i) { return !f || (i.nome + ' ' + (i.sub || '')).toLowerCase().indexOf(f) >= 0; });
    $('#itens').innerHTML = lista.length ? lista.map(function (i) {
      return '<button class="item ' + (i.livre > 0 ? '' : 'off') + '" data-i="' + i.id + '"><div class="img" style="' + (i.img ? 'background-image:url(\'' + esc(i.img) + '\')' : '') + '">' + (i.img ? '' : '<i class="ti ti-' + NOMES[AREA][1] + '"></i>') + '</div><div class="t"><b>' + esc(i.nome) + '</b>' + (i.sub ? '<div class="small muted">' + esc(i.sub) + '</div>' : '') + '<span>' + money(i.preco) + '</span>' + (i.livre <= 10 ? '<div class="small" style="color:' + (i.livre ? 'var(--amarelo)' : 'var(--erro)') + '">' + (i.livre ? 'restam ' + i.livre : 'esgotado') + '</div>' : '') + '</div></button>';
    }).join('') : '<div class="muted">Nada cadastrado para esta área. Cadastre no painel.</div>';
    $$('[data-i]').forEach(function (b) {
      b.onclick = function () {
        var it = ITENS.find(function (x) { return x.id === b.dataset.i; }), tam = '';
        if (it.tamanhos && it.tamanhos.length) { tam = prompt('Tamanho (' + it.tamanhos.join(', ') + '):', it.tamanhos[0]) || ''; if (it.tamanhos.indexOf(tam) < 0) return; }
        var c = CART.find(function (x) { return x.id === it.id && x.tamanho === tam; });
        var noCart = CART.filter(function (x) { return x.id === it.id; }).reduce(function (a, x) { return a + x.qtd; }, 0);
        if (noCart + 1 > it.livre) return Clic.toast('Sem estoque suficiente', true);
        if (c) c.qtd++; else CART.push({ id: it.id, nome: it.nome + (tam ? ' (' + tam + ')' : ''), preco: it.preco, qtd: 1, tamanho: tam });
        desenharCart();
      };
    });
  }
  function desenharCart() {
    $('#cart').innerHTML = CART.length ? CART.map(function (c, k) { return '<div class="cl"><div style="flex:1"><b>' + esc(c.nome) + '</b><div class="small muted">' + money(c.preco) + '</div></div><button data-m="' + k + '">−</button><b>' + c.qtd + '</b><button data-p="' + k + '">+</button></div>'; }).join('') : '<p class="muted">Toque nos itens para adicionar.</p>';
    $$('[data-m]').forEach(function (b) { b.onclick = function () { var c = CART[+b.dataset.m]; c.qtd--; if (!c.qtd) CART.splice(+b.dataset.m, 1); desenharCart(); }; });
    $$('[data-p]').forEach(function (b) { b.onclick = function () { CART[+b.dataset.p].qtd++; desenharCart(); }; });
    $('#total').textContent = money(total()); calcTroco();
  }
  function calcTroco() {
    var r = Clic.centavos(($('#recebido') || {}).value || ''), t = total();
    if ($('#troco')) $('#troco').innerHTML = r ? (r >= t ? 'Troco: <b class="ok" style="font-size:18px">' + money(r - t) + '</b>' : '<span style="color:var(--erro)">Faltam ' + money(t - r) + '</span>') : '';
  }

  async function finalizar() {
    if (!CART.length) return Clic.toast('Carrinho vazio', true);
    var rec = Clic.centavos($('#recebido').value || ''), btn = $('#finalizar');
    if (FORMA === 'dinheiro' && rec && rec < total()) return Clic.toast('Valor recebido menor que o total', true);
    Clic.carregando(btn, true, 'Registrando…');
    var r = await sb.rpc('venda_pdv', { p_caixa: CAIXA.id, p_itens: CART.map(function (c) { return { id: c.id, qtd: c.qtd, tamanho: c.tamanho }; }), p_forma: FORMA, p_recebido_centavos: FORMA === 'dinheiro' && rec ? rec : null, p_cliente: {} });
    Clic.carregando(btn, false);
    if (r.error) return Clic.toast(Clic.erro(r.error), true);
    var d = r.data, vendidos = CART.slice(); CART = [];
    var ings = [];
    if (AREA === 'bilheteria') { var p = await sb.rpc('meu_pedido', { p_token: d.token }); ings = (p.data && p.data.ingressos) || []; }
    var f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:80;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 12px';
    f.innerHTML = '<div class="card" style="max-width:420px;width:100%;text-align:center" id="recibo"><div class="ok" style="font-size:40px"><i class="ti ti-circle-check"></i></div><h2>Venda ' + esc(d.codigo) + '</h2><div class="total">' + money(d.total_centavos) + '</div>' +
      (d.troco_centavos != null ? '<p>Troco: <b style="font-size:22px" class="ok">' + money(d.troco_centavos) + '</b></p>' : '') +
      '<div class="small muted" style="margin-bottom:10px">' + vendidos.map(function (v) { return v.qtd + '× ' + esc(v.nome); }).join('<br>') + '</div>' +
      ings.map(function (i, k) { var q = qrcode(0, 'M'); q.addData(i.qr); q.make(); return '<div style="border-top:1px dashed #444;padding-top:10px;margin-top:10px"><b>' + esc(i.descricao) + '</b><div style="background:#fff;padding:8px;border-radius:10px;width:fit-content;margin:8px auto">' + q.createSvgTag(4, 0) + '</div><div class="small muted">Ingresso ' + (k + 1) + '/' + ings.length + '</div></div>'; }).join('') +
      (ings.length ? '<div class="link-box" style="margin-top:10px"><span style="flex:1;font-size:12px">' + esc(location.origin + '/casa/?c=' + ORG.slug + '#/p/' + d.token) + '</span></div><div style="display:flex;gap:6px;margin-top:8px"><button class="btn peq" id="r-print">Imprimir</button><a class="btn peq" id="r-wa" target="_blank">Enviar no WhatsApp</a></div>' : '') +
      (AREA !== 'bilheteria' ? '<p class="small muted">Pedido enviado para a tela de produção.</p>' : '') +
      '<button class="btn prim full" style="margin-top:14px" id="r-ok">Nova venda</button></div>';
    document.body.appendChild(f);
    $('#r-ok').onclick = async function () { f.remove(); await carregarItens(); desenhar(); };
    if ($('#r-print')) $('#r-print').onclick = function () { window.print(); };
    if ($('#r-wa')) $('#r-wa').href = 'https://wa.me/?text=' + encodeURIComponent('Seus ingressos (' + ORG.nome + '): ' + location.origin + '/casa/?c=' + ORG.slug + '#/p/' + d.token);
  }

  async function sangria() {
    var v = prompt('Valor da sangria (R$):'); if (!v) return;
    var mot = prompt('Motivo (opcional):') || null;
    var r = await sb.rpc('registrar_sangria', { p_caixa: CAIXA.id, p_valor_centavos: Clic.centavos(v), p_motivo: mot });
    Clic.toast(r.error ? Clic.erro(r.error) : 'Sangria registrada', !!r.error);
  }
  async function fecharCaixa() {
    var v = prompt('Conte o dinheiro da gaveta. Quanto tem (R$)?'); if (v === null) return;
    var r = await sb.rpc('fechar_caixa', { p_caixa: CAIXA.id, p_contado_centavos: Clic.centavos(v) });
    if (r.error) return Clic.toast(Clic.erro(r.error), true);
    var x = r.data;
    T.innerHTML = '<div class="card" style="max-width:440px;margin:30px auto"><h2>Caixa fechado</h2><div class="linha-tot" style="display:flex;justify-content:space-between"><span>Fundo de troco</span><b>' + money(x.fundo) + '</b></div><div style="display:flex;justify-content:space-between"><span>Vendas em dinheiro</span><b>' + money(x.dinheiro) + '</b></div><div style="display:flex;justify-content:space-between"><span>Sangrias</span><b>−' + money(x.sangrias) + '</b></div><hr style="border-color:var(--linha)"><div style="display:flex;justify-content:space-between"><span>Esperado</span><b>' + money(x.esperado) + '</b></div><div style="display:flex;justify-content:space-between"><span>Contado</span><b>' + money(x.contado) + '</b></div><div style="display:flex;justify-content:space-between;font-size:20px"><span>Diferença</span><b style="color:' + (x.diferenca < 0 ? 'var(--erro)' : 'var(--verde)') + '">' + money(x.diferenca) + '</b></div><button class="btn prim full" style="margin-top:16px" id="voltar">Voltar</button></div>';
    $('#voltar').onclick = escolherArea;
  }

  iniciar();
})();
