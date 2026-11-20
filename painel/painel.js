/* Clic Reservas 2.0 — painel do organizador (todas as telas). */
(function () {
  'use strict';
  var sb = Clic.sb, $ = Clic.$, $$ = Clic.$$, esc = Clic.esc, money = Clic.money;
  var EU = null, ORG = null, MEMBRO = null;
  var C = $('#conteudo');

  // ---------------------------------------------------------------- utilidades
  function titulo(t) { $('#titulo').textContent = t; document.title = t + ' · clic reservas'; }
  function vazio(icone, txt) { return '<div class="vazio"><i class="ti ti-' + icone + '"></i>' + txt + '</div>'; }
  function pill(sit) {
    var m = { pago: ['verde', 'Pago'], aguardando: ['amarelo', 'Aguardando'], cancelado: ['vermelho', 'Cancelado'], expirado: ['cinza', 'Expirado'],
      em_analise: ['amarelo', 'Em análise'], estornado: ['cinza', 'Estornado'], rascunho: ['cinza', 'Rascunho'], a_venda: ['verde', 'À venda'],
      esgotado: ['amarelo', 'Esgotado'], encerrado: ['cinza', 'Encerrado'] };
    var x = m[sit] || ['cinza', sit]; return '<span class="pill ' + x[0] + '">' + x[1] + '</span>';
  }
  var FORMA = { pix: 'Pix', cartao: 'Cartão', whatsapp: 'WhatsApp', dinheiro: 'Dinheiro', pix_balcao: 'Pix balcão', cartao_balcao: 'Cartão balcão', point: 'Maquininha' };
  var CANAL = { site: 'Site', app: 'App', bilheteria: 'Bilheteria', pdv: 'PDV' };
  function isoLocal(d) { if (!d) return ''; var x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); }
  function admin() { return MEMBRO.funcao === 'admin'; }
  function modal(html, aoMontar) {
    var f = document.createElement('div'); f.className = 'modal-fundo';
    f.innerHTML = '<div class="modal">' + html + '</div>';
    f.addEventListener('click', function (e) { if (e.target === f || e.target.closest('[data-fechar]')) f.remove(); });
    document.body.appendChild(f); if (aoMontar) aoMontar(f); return f;
  }
  async function q(promessa) { var r = await promessa; if (r.error) { Clic.toast(Clic.erro(r.error), true); r.error.code = r.error.code || 'mostrado'; throw r.error; } return r.data; }
  function form(f) { var o = {}; new FormData(f).forEach(function (v, k) { if (o[k] !== undefined) { if (!Array.isArray(o[k])) o[k] = [o[k]]; o[k].push(v); } else o[k] = v; }); return o; }
  function csv(nome, linhas) {
    var t = linhas.map(function (l) { return l.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv' })); a.download = nome; a.click();
  }

  function senhaAleatoria() {
    var c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint32Array(10), t = '';
    crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) t += c[a[i] % c.length]; return t;
  }
  // chama uma Edge Function e devolve { data } ou { erro: 'mensagem em português' }
  async function chamarFuncao(nome, corpo) {
    var r = await sb.functions.invoke(nome, { body: corpo });
    if (!r.error) return { data: r.data || {} };
    var msg = '';
    try { var j = await r.error.context.json(); msg = j.erro || j.error || j.message || ''; } catch (e) {}
    if (!msg && /Failed to send|fetch/i.test(r.error.message || '')) msg = 'Esta função ainda não foi ativada. Fale com a Clic.';
    return { erro: msg || Clic.erro(r.error) };
  }

  // ---------------------------------------------------------------- início
  async function iniciar() {
    var s = await Clic.sessao();
    if (!s) { location.href = '/#entrar'; return; }
    EU = s.user;
    if (/nova-senha/.test(location.search)) return telaNovaSenha();
    // dados da casa: deste navegador ou guardados na própria conta (link de confirmação aberto em outro aparelho)
    var pend = localStorage.getItem('clic_cadastro_pendente') || (EU.user_metadata && EU.user_metadata.cadastro ? JSON.stringify(EU.user_metadata.cadastro) : null);
    var jaTem = pend ? await sb.from('membros').select('id', { count: 'exact', head: true }).eq('user_id', EU.id) : null;
    if (pend && !(jaTem && jaTem.count)) {
      var d = JSON.parse(pend);
      var r = await sb.rpc('criar_organizacao', { p_slug: d.slug, p_nome: d.nome, p_responsavel: d.responsavel, p_whatsapp: d.whatsapp,
        p_cidade: d.cidade, p_tipo: d.tipo, p_publico: d.publico, p_quem_paga: d.quem });
      if (!r.error || /já tem uma casa/i.test(r.error.message)) localStorage.removeItem('clic_cadastro_pendente');
      else Clic.toast('Não foi possível criar a casa automaticamente: ' + Clic.erro(r.error), true);
    } else if (pend) localStorage.removeItem('clic_cadastro_pendente');
    var m = await sb.from('membros').select('*, organizacoes(*)').eq('user_id', EU.id).eq('ativo', true).order('criado_em').limit(1).maybeSingle();
    if (!m.data) {
      titulo('Bem-vindo');
      return telaCriarCasa();
    }
    MEMBRO = m.data; ORG = m.data.organizacoes;
    if (MEMBRO.funcao === 'operador') { location.href = '/pdv/'; return; }
    $('#nome-casa').textContent = ORG.nome;
    $('#ver-site').href = '/' + ORG.slug;
    if (!admin()) $$('.so-admin').forEach(function (a) { a.style.display = 'none'; });
    window.addEventListener('hashchange', rota);
    rota();
  }

  // login sem casa: cria a casa aqui mesmo (sem novo cadastro)
  function telaCriarCasa() {
    var md = (EU.user_metadata && EU.user_metadata.cadastro) || {};
    var nm = (EU.user_metadata && EU.user_metadata.nome) || '';
    C.innerHTML = '<form class="card" id="f-casa" style="max-width:620px"><h3>Falta criar a sua casa</h3><p class="muted">Seu login (' + esc(EU.email) + ') está pronto. Preencha os dados da casa para liberar o painel. Se você faz parte da equipe de outra casa, peça ao administrador para te adicionar e ignore esta tela.</p>' +
      '<label>Nome da casa ou do evento</label><input name="nome" required value="' + esc(md.nome || '') + '">' +
      '<label>Endereço do seu site</label><div style="display:flex;align-items:center;border:1px solid var(--linha2);border-radius:10px;overflow:hidden"><span class="muted" style="padding:0 0 0 12px;white-space:nowrap">clicreservas.com.br/</span><input name="slug" required pattern="[a-z0-9-]{3,40}" value="' + esc(md.slug || '') + '" style="border:0"></div>' +
      '<div class="linha2"><div><label>Seu nome</label><input name="responsavel" required value="' + esc(md.responsavel || nm) + '"></div><div><label>WhatsApp</label><input name="whatsapp" required inputmode="tel" value="' + esc(md.whatsapp || '') + '" placeholder="41999999999"></div></div>' +
      '<div class="linha2"><div><label>Cidade</label><input name="cidade" value="' + esc(md.cidade || '') + '"></div><div><label>Tipo de evento</label><select name="tipo">' + ['Balada / casa noturna', 'Bar / pub', 'Show / música ao vivo', 'Pagode / samba', 'Sertanejo / forró', 'Excursões', 'Festa particular', 'Esporte / corrida', 'Teatro / stand-up', 'Feira / congresso', 'Outro'].map(function (t) { return '<option' + (t === md.tipo ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div></div>' +
      '<label>Quem paga os 5%?</label><label class="check"><input type="radio" name="quem" value="comprador"' + (md.quem !== 'produtor' ? ' checked' : '') + '> O comprador, junto com a taxa de serviço</label><label class="check"><input type="radio" name="quem" value="produtor"' + (md.quem === 'produtor' ? ' checked' : '') + '> Eu (os 5% saem do meu valor)</label>' +
      '<button class="btn prim" style="margin-top:14px">Criar minha casa</button><div class="erro" id="casa-erro" style="margin-top:8px"></div></form>';
    var f = $('#f-casa');
    f.nome.oninput = function () { if (!f.slug.dataset.mexeu) f.slug.value = Clic.slug(this.value).slice(0, 40); };
    f.slug.oninput = function () { this.dataset.mexeu = '1'; this.value = this.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); };
    f.onsubmit = async function (e) {
      e.preventDefault(); var b = f.querySelector('.prim'), er = $('#casa-erro'); er.textContent = '';
      Clic.carregando(b, true, 'Criando…');
      var r = await sb.rpc('criar_organizacao', { p_slug: f.slug.value, p_nome: f.nome.value.trim(), p_responsavel: f.responsavel.value.trim(),
        p_whatsapp: f.whatsapp.value.replace(/\D/g, ''), p_cidade: f.cidade.value.trim(), p_tipo: f.tipo.value, p_publico: md.publico || null, p_quem_paga: f.quem.value });
      if (r.error) { Clic.carregando(b, false); er.textContent = /duplicate|unique/i.test(r.error.message) ? 'Este endereço já está em uso. Escolha outro.' : /check/i.test(r.error.message) ? 'Endereço inválido: use de 3 a 40 letras minúsculas, números ou hífen (não pode começar ou terminar com hífen).' : Clic.erro(r.error); return; }
      localStorage.removeItem('clic_cadastro_pendente');
      Clic.toast('Casa criada!'); location.href = '/painel/#painel'; location.reload();
    };
  }

  function telaNovaSenha() {
    titulo('Criar nova senha');
    C.innerHTML = '<form class="card" style="max-width:420px" id="f-ns"><label>Nova senha (10+ caracteres)</label><input name="s" type="password" minlength="10" required><button class="btn prim full" style="margin-top:14px">Salvar senha</button></form>';
    $('#f-ns').onsubmit = async function (e) {
      e.preventDefault();
      var r = await sb.auth.updateUser({ password: this.s.value });
      if (r.error) return Clic.toast(Clic.erro(r.error), true);
      Clic.toast('Senha alterada'); location.href = '/painel/';
    };
  }

  var PAGINAS = {};
  function rota() {
    var p = (location.hash || '#painel').slice(1).split('/');
    $$('#menu a[data-p]').forEach(function (a) { a.classList.toggle('on', a.dataset.p === p[0]); });
    $('#menu').classList.remove('on');
    var fn = PAGINAS[p[0]] || PAGINAS.painel;
    C.innerHTML = '<div class="vazio">Carregando…</div>';
    fn(p.slice(1)).then(function () { if (!p[1]) setTimeout(function () { tutorial(PAGINAS[p[0]] ? p[0] : 'painel'); }, 350); }).catch(function (e) { console.error(e); C.innerHTML = vazio('alert-triangle', 'Não foi possível carregar. ' + esc(Clic.erro(e))); });
  }
  $('#abrir-menu').onclick = function () { $('#menu').classList.toggle('on'); };
  $('#sair').onclick = async function () { await sb.auth.signOut(); location.href = '/'; };


  // ================================================================ TUTORIAL GUIADO
  // Abre sozinho na 1ª visita de cada tela; depois fica no botão "Tutorial".
  var TUT = {
    painel: [
      [null, 'Bem-vindo ao seu painel', 'Este é o resumo da sua casa: vendas de hoje, faturamento, ingressos emitidos e pedidos em preparo. Vamos dar uma volta rápida.'],
      ['.passos', 'Primeiros passos', 'Siga estes 6 passos para começar a vender. Cada um tem um botão "Fazer agora" que leva direto à tela certa.'],
      ['#menu', 'Menu', 'Tudo fica aqui: eventos, vendas, portarias, produtos, equipe e o seu site. Em cada tela nova este tutorial aparece uma vez.'],
      ['#ver-site', 'Seu site e app', 'Abre o site da sua casa, do jeito que o cliente vê. É esse link que você divulga.'],
      ['#b-tutorial', 'Rever o tutorial', 'Quando quiser ver as dicas de novo, toque aqui.']
    ],
    eventos: [
      [null, 'Eventos e ingressos', 'Aqui você cria os eventos (festa, show) ou excursões com escolha de poltrona.'],
      ['a[href="#eventos/novo"]', 'Novo evento', 'Comece aqui. Depois de salvar o evento, crie os lotes (preço e quantidade) e, se quiser, desenhe o mapa da casa.'],
      [null, 'Rascunho ou à venda', 'O evento em Rascunho não aparece no site. Mude para "À venda" quando os lotes estiverem prontos.']
    ],
    vendas: [
      [null, 'Vendas', 'Todos os pedidos: site, app, bilheteria e PDV. Filtre por canal e situação.'],
      ['#f-busca', 'Buscar pedido', 'Procure pelo código, nome, e-mail ou WhatsApp do cliente. Abra o pedido para confirmar pagamento, reenviar ou cancelar.']
    ],
    portarias: [
      [null, 'Portarias', 'Cada portaria (ex.: Portão principal, Entrada VIP) fica presa a um evento.'],
      ['#f-pt', 'Criar portaria', 'Crie a portaria e leia o QR Code de pareamento com o celular de quem vai ficar na porta. O aparelho já abre pronto para ler os ingressos.']
    ],
    brindes: [
      [null, 'Brindes e retiradas', 'O cliente mostra um código por pedido, que libera o brinde e os produtos comprados.'],
      ['#f-baixa', 'Dar baixa', 'Digite o código do cliente para registrar a entrega.'],
      ['#f-promo', 'Promoções', 'Crie promoções como "a cada 4 ingressos, ganhe 1 copo". O brinde precisa estar cadastrado em Produtos › Loja.']
    ],
    produtos: [
      [null, 'Produtos', 'Bar e Cozinha aparecem só no PDV. A Loja aparece também no site e no "Compre junto" do ingresso.'],
      ['#f-prod', 'Cadastrar produto', 'Nome, preço, estoque e foto. A foto vira o botão no PDV.']
    ],
    estoque: [
      [null, 'Estoque', 'O estoque baixa sozinho a cada venda e volta quando um pedido é cancelado.'],
      ['#f-aj', 'Ajuste manual', 'Use para entrada de mercadoria, perda ou contagem.']
    ],
    locacoes: [
      [null, 'Espaços e locações', 'Cadastre seus espaços. Eles servem de local dos eventos e aparecem na página "Locações" do site.'],
      ['#f-esp', 'Novo espaço', 'Os pedidos de orçamento feitos pelo site chegam nesta tela.']
    ],
    contatos: [
      [null, 'Contatos', 'Quem se cadastrou em "Receba novidades" e quem comprou com e-mail. Baixe a planilha para usar nas suas campanhas.']
    ],
    financeiro: [
      [null, 'Financeiro e caixas', 'Receita, ticket médio, cancelamentos e a taxa da plataforma no período.'],
      ['#f-per', 'Período', 'Escolha as datas. Abaixo aparecem as vendas por forma de pagamento, por área e a conferência de cada caixa do PDV.']
    ],
    repasses: [
      [null, 'Repasses para a Clic', 'Vendas online pagam a comissão sozinhas pelo split. Vendas em dinheiro, balcão ou maquininha geram taxa a pagar.'],
      [null, 'Vencimento', 'A semana vai de segunda a domingo e vence na quarta seguinte. Gere o Pix aqui e a baixa é automática.']
    ],
    promoters: [
      [null, 'Promoters', 'Cada promoter tem um link de vendas e um cupom com o código dele. Toda venda por eles fica marcada e a comissão é calculada sozinha.'],
      ['#f-promo-p', 'Cadastrar promoter', 'Escolha o código (ex.: fabi), como ele ganha (% das vendas, valor por ingresso ou por pessoa que entrou), se o cupom dá desconto e se ele pode colocar nomes na lista.'],
      [null, 'Links e pagamento', 'Em "Links" você manda pelo WhatsApp o link de vendas e a área do promoter. Em "Pagar" você registra o que já pagou de comissão.']
    ],
    lista: [
      [null, 'Lista de nomes', 'Os nomes que os promoters colocam pela área deles aparecem aqui, junto com os que a casa coloca.'],
      ['#f-cfg', 'Quando a lista fecha', 'Defina até quando os promoters podem colocar nomes. Na porta, a portaria busca o nome e dá entrada.'],
      ['#f-nome', 'Colocar nome', 'Coloque nomes da casa, VIP, cortesia ou aniversariante, com quantas pessoas entram por nome.']
    ],
    equipe: [
      [null, 'Equipe', 'Administrador vê tudo. Gestor cuida de eventos, vendas, produtos, portarias e site. Operador só usa o PDV das áreas marcadas.'],
      ['#f-conv', 'Adicionar membro', 'Coloque nome, e-mail e uma senha inicial (ou toque em Gerar). Depois passe os dados para a pessoa entrar.']
    ],
    pagamentos: [
      [null, 'Pagamentos online', 'Conecte sua conta Asaas para vender com Pix e cartão. O dinheiro cai direto na sua conta.'],
      ['#f-quem', 'Quem paga a comissão', 'Escolha se a taxa vai para o comprador ou sai do seu valor. Dá para mudar quando quiser.'],
      ['#f-asaas', 'Conta Asaas', 'Cole a chave de API do Asaas. Enquanto não houver pagamento online, o site envia os pedidos pelo WhatsApp.']
    ],
    site: [
      [null, 'Site e identidade', 'Deixe o site e o app com a cara da sua casa: nome, cores, logo, textos e fotos.'],
      ['#f-site', 'Seções', 'Ligue ou desligue cada parte do site. Seções vazias somem sozinhas. Salve e confira em "Ver meu site".']
    ]
  };

  function tutorial(pagina, forcar) {
    var passos = TUT[pagina];
    if (!passos || (!forcar && localStorage.getItem('clic_tut_' + (EU ? EU.id : '') + '_' + pagina))) return;
    try { localStorage.setItem('clic_tut_' + (EU ? EU.id : '') + '_' + pagina, '1'); } catch (e) {}
    var i = 0, fundo = document.createElement('div'), luz = document.createElement('div'), bal = document.createElement('div');
    fundo.className = 'tut-fundo'; luz.className = 'tut-luz'; bal.className = 'tut-bal';
    document.body.appendChild(fundo); document.body.appendChild(luz); document.body.appendChild(bal);
    function fechar() { fundo.remove(); luz.remove(); bal.remove(); window.removeEventListener('resize', mostrar); document.removeEventListener('keydown', tecla); }
    function tecla(e) { if (e.key === 'Escape') fechar(); if (e.key === 'ArrowRight' || e.key === 'Enter') proximo(); }
    function proximo() { if (++i >= passos.length) fechar(); else mostrar(); }
    function mostrar() {
      var p = passos[i], alvo = p[0] && document.querySelector(p[0]);
      if (alvo && alvo.offsetParent === null && alvo.id !== 'menu') alvo = null;
      if (alvo && alvo.id === 'menu' && window.innerWidth <= 900) alvo = null;
      bal.innerHTML = '<div class="small laranja" style="margin-bottom:4px">' + (i + 1) + ' de ' + passos.length + '</div><h3 style="margin:0 0 6px">' + esc(p[1]) + '</h3><p style="margin:0 0 14px">' + esc(p[2]) + '</p>' +
        '<div class="acoes" style="justify-content:space-between"><button class="btn peq" data-t="pular">Pular</button><div class="acoes">' + (i ? '<button class="btn peq" data-t="voltar">Voltar</button>' : '') +
        '<button class="btn peq prim" data-t="ok">' + (i === passos.length - 1 ? 'Entendi' : 'Próximo') + '</button></div></div>';
      bal.querySelector('[data-t=pular]').onclick = fechar;
      bal.querySelector('[data-t=ok]').onclick = proximo;
      var v = bal.querySelector('[data-t=voltar]'); if (v) v.onclick = function () { i--; mostrar(); };
      if (!alvo) {
        luz.style.display = 'none'; fundo.style.display = 'block';
        bal.style.left = Math.max(12, (window.innerWidth - bal.offsetWidth) / 2) + 'px';
        bal.style.top = Math.max(12, (window.innerHeight - bal.offsetHeight) / 2) + 'px';
        return;
      }
      fundo.style.display = 'none'; luz.style.display = 'block';
      alvo.scrollIntoView({ block: 'nearest' });
      var r = alvo.getBoundingClientRect(), m = 6;
      var alto = Math.min(r.height, window.innerHeight - 24);
      luz.style.left = (r.left - m) + 'px'; luz.style.top = (r.top - m) + 'px';
      luz.style.width = (r.width + m * 2) + 'px'; luz.style.height = (alto + m * 2) + 'px';
      var bw = bal.offsetWidth, bh = bal.offsetHeight, x, y;
      if (r.right + 14 + bw < window.innerWidth && r.width < window.innerWidth * 0.5) { x = r.right + 14; y = r.top; }
      else if (r.top + alto + 14 + bh < window.innerHeight) { x = r.left; y = r.top + alto + 14; }
      else { x = r.left; y = r.top - bh - 14; }
      bal.style.left = Math.min(Math.max(12, x), window.innerWidth - bw - 12) + 'px';
      bal.style.top = Math.min(Math.max(12, y), window.innerHeight - bh - 12) + 'px';
    }
    window.addEventListener('resize', mostrar); document.addEventListener('keydown', tecla);
    mostrar();
  }
  $('#b-tutorial').onclick = function () { tutorial((location.hash || '#painel').slice(1).split('/')[0] || 'painel', true); };

  // ================================================================ PAINEL
  PAGINAS.painel = async function () {
    titulo('Painel');
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var d14 = new Date(hoje); d14.setDate(d14.getDate() - 13);
    var r = await Promise.all([
      sb.from('eventos').select('id,nome,inicio,situacao', { count: 'exact' }).eq('org_id', ORG.id).order('inicio'),
      sb.from('lotes').select('id,evento_id,quantidade,vendidos', { count: 'exact' }).eq('org_id', ORG.id),
      sb.from('pedidos').select('id,codigo,cliente_nome,total_centavos,subtotal_centavos,canal,forma,pago_em,situacao').eq('org_id', ORG.id).eq('situacao', 'pago').order('pago_em', { ascending: false }).limit(1000),
      sb.from('ingressos').select('evento_id,situacao').eq('org_id', ORG.id).neq('situacao', 'cancelado').limit(5000),
      sb.from('producao').select('id', { count: 'exact', head: true }).eq('org_id', ORG.id).neq('situacao', 'entregue')
    ]);
    var eventos = r[0].data || [], lotes = r[1].data || [], pagos = r[2].data || [], ings = r[3].data || [];
    var temSite = !!(ORG.logo_url || (ORG.textos && ORG.textos.hero_titulo));
    var passos = [
      ['Personalize seu site e app', 'Logo, cores e textos.', temSite, '#site'],
      ['Conecte sua conta Asaas', 'O dinheiro das vendas cai direto nela.', ORG.asaas_conectado, '#pagamentos'],
      ['Cadastre o primeiro evento', 'Data, local e capa.', eventos.length > 0, '#eventos/novo'],
      ['Crie os lotes de ingressos', 'Pista, camarote, VIP…', lotes.length > 0, '#eventos'],
      ['Coloque o evento à venda', 'Mude a situação para "À venda".', eventos.some(function (e) { return e.situacao === 'a_venda'; }), '#eventos'],
      ['Primeira venda', 'Divulgue o link e acompanhe aqui.', pagos.length > 0, '#vendas']
    ];
    var feitos = passos.filter(function (p) { return p[2]; }).length, atual = passos.findIndex(function (p) { return !p[2]; });
    var link = Clic.cfg.SITE + '/' + ORG.slug;
    var vHoje = pagos.filter(function (p) { return new Date(p.pago_em) >= hoje; });
    var tot = pagos.reduce(function (a, p) { return a + p.total_centavos; }, 0);
    var dias = []; for (var i = 0; i < 14; i++) { var d = new Date(d14); d.setDate(d.getDate() + i); dias.push({ d: d, v: 0 }); }
    pagos.forEach(function (p) { var dt = new Date(p.pago_em); dt.setHours(0, 0, 0, 0); var k = Math.round((dt - d14) / 864e5); if (k >= 0 && k < 14) dias[k].v += p.total_centavos; });
    var max = Math.max.apply(null, dias.map(function (x) { return x.v; }).concat([1]));
    var prox = eventos.filter(function (e) { return new Date(e.inicio) > new Date(Date.now() - 12 * 36e5) && e.situacao !== 'cancelado'; }).slice(0, 5);

    C.innerHTML =
      (feitos < 6 ? '<div class="card" style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Primeiros passos para vender</h3><span class="laranja">' + feitos + ' de 6</span></div>' +
        '<div class="barra" style="margin-bottom:12px"><i style="width:' + (feitos / 6 * 100) + '%"></i></div><div class="passos">' +
        passos.map(function (p, i) {
          return '<div class="passo ' + (p[2] ? 'ok' : i === atual ? 'atual' : '') + '"><b>' + (p[2] ? '<i class="ti ti-check ok"></i> ' : (i + 1) + ' · ') + esc(p[0]) + '</b><div class="small muted">' + esc(p[1]) + '</div>' +
            (p[2] ? '' : '<a class="small" href="' + p[3] + '">Fazer agora →</a>') + '</div>';
        }).join('') + '</div></div>' : '') +
      '<div class="link-box" style="margin-bottom:16px"><i class="ti ti-link laranja"></i><span style="flex:1">' + esc(link) + '</span><button class="btn peq" id="copiar">Copiar</button></div>' +
      '<div class="grid g4" style="margin-bottom:16px">' +
      '<div class="metric"><span>Vendas de hoje</span><b>' + money(vHoje.reduce(function (a, p) { return a + p.total_centavos; }, 0)) + '</b><span>' + vHoje.length + ' pedido(s)</span></div>' +
      '<div class="metric" style="border-left-color:var(--verde)"><span>Faturamento total</span><b>' + money(tot) + '</b><span>' + pagos.length + ' pedidos pagos</span></div>' +
      '<div class="metric" style="border-left-color:var(--rosa)"><span>Ingressos emitidos</span><b>' + ings.length + '</b><span>' + ings.filter(function (x) { return x.situacao === 'usado'; }).length + ' já entraram</span></div>' +
      '<div class="metric" style="border-left-color:var(--amarelo)"><span>Pedidos em preparo</span><b>' + (r[4].count || 0) + '</b><span>bar, cozinha e loja</span></div></div>' +
      '<div class="duas"><div class="card"><h3>Vendas nos últimos 14 dias</h3><div class="grafico">' +
      dias.map(function (x) { return '<div title="' + money(x.v) + '" style="height:' + Math.max(2, x.v / max * 100) + '%;opacity:' + (x.v ? 1 : .25) + '"><span>' + x.d.getDate() + '</span></div>'; }).join('') +
      '</div><div style="height:18px"></div></div>' +
      '<div class="card"><div style="display:flex;justify-content:space-between"><h3>Próximos eventos</h3><a href="#eventos/novo" class="small">+ Novo</a></div>' +
      (prox.length ? prox.map(function (e) {
        var ls = lotes.filter(function (l) { return l.evento_id === e.id; }), cap = ls.reduce(function (a, l) { return a + l.quantidade; }, 0), vend = ls.reduce(function (a, l) { return a + l.vendidos; }, 0);
        var ent = ings.filter(function (x) { return x.evento_id === e.id && x.situacao === 'usado'; }).length;
        return '<div class="lista-item"><div><a href="#eventos/' + e.id + '"><b>' + esc(e.nome) + '</b></a><div class="small muted">' + Clic.data(e.inicio) + ' · ' + vend + '/' + cap + ' vendidos · ' + ent + ' entraram</div>' +
          '<div class="barra" style="margin-top:6px"><i style="width:' + (cap ? vend / cap * 100 : 0) + '%"></i></div></div>' + pill(e.situacao) + '</div>';
      }).join('') : vazio('calendar', 'Nenhum evento agendado.')) + '</div></div>' +
      '<div class="card" style="margin-top:16px"><div style="display:flex;justify-content:space-between"><h3>Últimas vendas</h3><a href="#vendas" class="small">Todas as vendas</a></div>' +
      (pagos.length ? '<table class="t"><tr><th>Pedido</th><th>Cliente</th><th>Canal</th><th>Total</th><th>Quando</th></tr>' + pagos.slice(0, 8).map(function (p) {
        return '<tr><td>' + p.codigo + '</td><td>' + esc(p.cliente_nome || '—') + '</td><td>' + (CANAL[p.canal] || p.canal) + '</td><td>' + money(p.total_centavos) + '</td><td class="small muted">' + Clic.data(p.pago_em) + '</td></tr>';
      }).join('') + '</table>' : vazio('receipt', 'Nenhuma venda ainda.')) + '</div>';
    $('#copiar').onclick = function () { navigator.clipboard.writeText(link); Clic.toast('Link copiado'); };
  };

  // ================================================================ EVENTOS
  PAGINAS.eventos = async function (p) {
    if (p[0] === 'novo') return formEvento(null);
    if (p[0]) return detalheEvento(p[0], p[1] || 'lotes');
    titulo('Eventos e ingressos');
    var filtro = sessionStorage.getItem('ev_filtro') || 'proximos';
    var ev = await q(sb.from('eventos').select('*, lotes(quantidade,vendidos)').eq('org_id', ORG.id).order('inicio', { ascending: filtro !== 'encerrados' }));
    var agora = Date.now() - 12 * 36e5;
    var lista = ev.filter(function (e) {
      var fim = new Date(e.fim || e.inicio).getTime();
      return filtro === 'todos' || (filtro === 'proximos' ? fim >= agora : fim < agora);
    });
    C.innerHTML = '<div class="topo" style="margin:0 0 12px"><div class="abas" style="margin:0">' +
      [['proximos', 'Próximos'], ['encerrados', 'Encerrados'], ['todos', 'Todos']].map(function (a) { return '<button data-f="' + a[0] + '" class="' + (filtro === a[0] ? 'on' : '') + '">' + a[1] + '</button>'; }).join('') +
      '</div><a class="btn prim" href="#eventos/novo"><i class="ti ti-plus"></i> Novo evento</a></div><div class="card">' +
      (lista.length ? lista.map(function (e) {
        var cap = e.lotes.reduce(function (a, l) { return a + l.quantidade; }, 0), vend = e.lotes.reduce(function (a, l) { return a + l.vendidos; }, 0);
        return '<div class="lista-item"><div style="display:flex;gap:12px;align-items:center">' + (e.capa_url ? '<img class="mini" src="' + esc(e.capa_url) + '">' : '<div class="mini"></div>') +
          '<div><a href="#eventos/' + e.id + '"><b>' + esc(e.nome) + '</b></a> ' + (e.tipo === 'excursao' ? '<span class="pill amarelo">Excursão</span>' : '') +
          '<div class="small muted">' + Clic.data(e.inicio) + ' · ' + vend + '/' + cap + ' vendidos</div></div></div>' +
          '<div class="acoes">' + pill(e.situacao) + '<a class="btn peq" href="#eventos/' + e.id + '">Abrir</a></div></div>';
      }).join('') : vazio('ticket', 'Nenhum evento aqui. Crie o primeiro em "Novo evento".')) + '</div>';
    $$('[data-f]').forEach(function (b) { b.onclick = function () { sessionStorage.setItem('ev_filtro', b.dataset.f); rota(); }; });
  };

  async function formEvento(ev) {
    titulo(ev ? 'Editar evento' : 'Novo evento');
    var espacos = await q(sb.from('espacos').select('id,nome').eq('org_id', ORG.id).eq('ativo', true));
    ev = ev || { tipo: 'evento', situacao: 'rascunho', cancelamento_horas: 48, recorrencia: 'nenhuma' };
    C.innerHTML = '<form class="card" id="f-ev" style="max-width:760px">' +
      '<label>Tipo</label><select name="tipo"><option value="evento">🎟 Evento (show, festa, balada)</option><option value="excursao">🚌 Excursão (ônibus ou van, com poltrona)</option></select>' +
      '<label>Nome do evento</label><input name="nome" required maxlength="100" value="' + esc(ev.nome || '') + '">' +
      '<div class="linha2"><div><label>Começa em</label><input type="datetime-local" name="inicio" required value="' + isoLocal(ev.inicio) + '"></div>' +
      '<div><label>Termina em (opcional)</label><input type="datetime-local" name="fim" value="' + isoLocal(ev.fim) + '"></div></div>' +
      '<div id="campo-volta"><label>Volta (excursão)</label><input type="datetime-local" name="volta" value="' + isoLocal(ev.volta) + '"></div>' +
      '<div class="linha2"><div><label>Local</label><select name="espaco_id"><option value="">Digitar o local</option>' + espacos.map(function (s) { return '<option value="' + s.id + '">' + esc(s.nome) + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Nome do local (se não usar um espaço)</label><input name="local_texto" value="' + esc(ev.local_texto || '') + '"></div></div>' +
      '<label>Endereço</label><input name="endereco" value="' + esc(ev.endereco || '') + '" placeholder="Rua, número, bairro, cidade">' +
      '<label>Descrição</label><textarea name="descricao">' + esc(ev.descricao || '') + '</textarea>' +
      '<div class="linha2"><div><label>Imagem de capa (até 5 MB)</label><input type="file" name="capa" accept="image/*">' + (ev.capa_url ? '<img src="' + esc(ev.capa_url) + '" style="max-width:120px;margin-top:6px;border-radius:8px">' : '') + '</div>' +
      '<div><label>Vídeo de capa (opcional, MP4 até 5 MB)</label><input type="file" name="video" accept="video/mp4,video/webm"></div></div>' +
      '<div class="linha2"><div><label>Situação</label><select name="situacao"><option value="rascunho">Rascunho (não aparece no site)</option><option value="a_venda">À venda no site</option><option value="esgotado">Esgotado</option><option value="encerrado">Encerrado</option><option value="cancelado">Cancelado</option></select></div>' +
      '<div><label>Cliente pode cancelar até (horas antes)</label><input type="number" name="cancelamento_horas" min="0" value="' + ev.cancelamento_horas + '"></div></div>' +
      '<div class="linha2"><div><label>Repetir</label><select name="recorrencia"><option value="nenhuma">Não repete</option><option value="semanal">Toda semana</option></select></div>' +
      '<div><label>Repetir até</label><input type="date" name="recorrencia_ate" value="' + (ev.recorrencia_ate || '') + '"></div></div>' +
      '<div class="acoes" style="margin-top:16px"><button class="btn prim">' + (ev.id ? 'Salvar' : 'Criar evento') + '</button><a class="btn" href="#eventos' + (ev.id ? '/' + ev.id : '') + '">Cancelar</a></div></form>';
    var f = $('#f-ev');
    f.tipo.value = ev.tipo; f.situacao.value = ev.situacao; f.recorrencia.value = ev.recorrencia; f.espaco_id.value = ev.espaco_id || '';
    function volta() { $('#campo-volta').style.display = f.tipo.value === 'excursao' ? '' : 'none'; }
    f.tipo.onchange = volta; volta();
    f.onsubmit = async function (e) {
      e.preventDefault();
      var btn = f.querySelector('button.prim'); Clic.carregando(btn, true, 'Salvando…');
      try {
        var d = form(f);
        var dados = { org_id: ORG.id, tipo: d.tipo, nome: d.nome.trim(), inicio: new Date(d.inicio).toISOString(),
          fim: d.fim ? new Date(d.fim).toISOString() : null, volta: d.volta ? new Date(d.volta).toISOString() : null,
          espaco_id: d.espaco_id || null, local_texto: d.local_texto || null, endereco: d.endereco || null, descricao: d.descricao || null,
          situacao: d.situacao, cancelamento_horas: parseInt(d.cancelamento_horas, 10) || 0, recorrencia: d.recorrencia, recorrencia_ate: d.recorrencia_ate || null };
        if (f.capa.files[0]) dados.capa_url = await Clic.enviarImagem(ORG.id, f.capa.files[0], 'eventos');
        if (f.video.files[0]) dados.video_url = await Clic.enviarImagem(ORG.id, f.video.files[0], 'eventos');
        var r = ev.id ? await q(sb.from('eventos').update(dados).eq('id', ev.id).select().single())
                      : await q(sb.from('eventos').insert(Object.assign(dados, { slug: '' })).select().single());
        if (!ev.id && d.recorrencia === 'semanal' && d.recorrencia_ate) await criarRepeticoes(r, d.recorrencia_ate);
        Clic.toast('Evento salvo'); location.hash = '#eventos/' + r.id;
      } catch (ex) { Clic.toast(Clic.erro(ex), true); Clic.carregando(btn, false); }
    };
  }

  async function criarRepeticoes(ev, ate) {
    var lim = new Date(ate + 'T23:59'), novos = [], i = 1;
    while (i < 60) {
      var ini = new Date(ev.inicio); ini.setDate(ini.getDate() + 7 * i);
      if (ini > lim) break;
      var fim = ev.fim ? new Date(new Date(ev.fim).getTime() + 7 * i * 864e5).toISOString() : null;
      novos.push({ org_id: ORG.id, tipo: ev.tipo, nome: ev.nome, slug: '', inicio: ini.toISOString(), fim: fim, espaco_id: ev.espaco_id,
        local_texto: ev.local_texto, endereco: ev.endereco, descricao: ev.descricao, capa_url: ev.capa_url, video_url: ev.video_url,
        situacao: 'rascunho', cancelamento_horas: ev.cancelamento_horas, evento_pai_id: ev.id });
      i++;
    }
    if (novos.length) { await q(sb.from('eventos').insert(novos)); Clic.toast(novos.length + ' repetições criadas como rascunho'); }
  }

  async function detalheEvento(id, aba) {
    var ev = await q(sb.from('eventos').select('*').eq('id', id).single());
    titulo(ev.nome);
    var abas = [['lotes', 'Lotes'], ['mapa', 'Mapa'], ['dados', 'Dados do evento']];
    if (ev.tipo === 'excursao') abas = [['lotes', 'Lotes / preços'], ['veiculos', 'Veículos'], ['embarque', 'Embarque'], ['passageiros', 'Lista de embarque'], ['dados', 'Dados do evento']];
    C.innerHTML = '<div class="topo" style="margin:0 0 12px"><div class="abas" style="margin:0">' +
      abas.map(function (a) { return '<a href="#eventos/' + id + '/' + a[0] + '" class="' + (aba === a[0] ? 'on' : '') + '">' + a[1] + '</a>'; }).join('') +
      '</div><div class="acoes">' + pill(ev.situacao) + (ev.situacao === 'rascunho' ? '<button class="btn prim peq" id="publicar">Colocar à venda</button>' : '') +
      '<a class="btn peq" target="_blank" href="/' + ORG.slug + '#/e/' + ev.slug + '">Ver no site</a></div></div><div id="aba"></div>';
    if ($('#publicar')) $('#publicar').onclick = async function () { await q(sb.from('eventos').update({ situacao: 'a_venda' }).eq('id', id)); Clic.toast('Evento à venda'); rota(); };
    var A = $('#aba');
    if (aba === 'dados') { C.innerHTML = ''; return formEvento(ev); }
    if (aba === 'lotes') return abaLotes(ev, A);
    if (aba === 'mapa') return abaMapa(ev, A);
    if (aba === 'veiculos') return abaVeiculos(ev, A);
    if (aba === 'embarque') return abaEmbarque(ev, A);
    if (aba === 'passageiros') return abaPassageiros(ev, A);
  }

  var TIPOS_ING = ['homem', 'mulher', 'casal', 'pista', 'camarote', 'vip', 'mesa', 'meia-entrada'];
  var PESSOAS_PADRAO = { casal: 2, mesa: 4 };
  function maiusc(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Ingresso'; }
  function ordinal(n) { return n + 'º lote'; }

  // situação de cada lote dentro do seu tipo (igual ao que o cliente vê no site)
  function situacaoLotes(lista) {
    var agora = Date.now(), achou = false;
    return lista.map(function (l) {
      var aberto = (!l.venda_inicio || new Date(l.venda_inicio) <= agora) && (!l.venda_fim || new Date(l.venda_fim) > agora), tem = l.vendidos < l.quantidade;
      if (!l.ativo) return ['cinza', 'Pausado'];
      if (!tem) return ['vermelho', 'Esgotado'];
      if (!aberto) return ['cinza', l.venda_fim && new Date(l.venda_fim) <= agora ? 'Encerrado' : 'Agendado'];
      if (!l.vira_sozinho) return ['verde', 'À venda'];
      if (achou) return ['amarelo', 'Próximo'];
      achou = true; return ['verde', 'À venda'];
    });
  }

  async function abaLotes(ev, A) {
    var lotes = await q(sb.from('lotes').select('*').eq('evento_id', ev.id).order('area').order('ordem'));
    var areasMapa = ((ev.mapa && ev.mapa.itens) || []).filter(function (i) { return i.t === 'area'; }).map(function (i) { return i.nome.toLowerCase(); });
    var grupos = {}, ordemTipos = [];
    lotes.forEach(function (l) { var k = l.area || ''; if (!grupos[k]) { grupos[k] = []; ordemTipos.push(k); } grupos[k].push(l); });

    var html = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px"><h3 style="margin:0">Ingressos do evento</h3>' +
      '<div class="acoes"><button class="btn prim peq" id="b-montar"><i class="ti ti-table-plus"></i> Montar ingressos</button><button class="btn peq" id="b-avulso"><i class="ti ti-plus"></i> Lote avulso</button></div></div>';
    if (!lotes.length) html += vazio('ticket', 'Nenhum ingresso ainda. Toque em "Montar ingressos" para criar todos os tipos e lotes de uma vez.');
    ordemTipos.forEach(function (k) {
      var lista = grupos[k], sit = situacaoLotes(lista), pess = lista[0].pessoas_por_ingresso || 1;
      var vend = lista.reduce(function (a, l) { return a + l.vendidos; }, 0), tot = lista.reduce(function (a, l) { return a + l.quantidade; }, 0);
      html += '<div style="margin-top:18px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h4 style="margin:0">' + esc(maiusc(k)) + ' <span class="small muted">' + (pess > 1 ? '· ' + pess + ' pessoas por ingresso ' : '') + '· ' + vend + ' de ' + tot + ' vendidos</span></h4>' +
        '<button class="btn peq" data-prox="' + esc(k) + '"><i class="ti ti-plus"></i> Próximo lote</button></div>' +
        '<table class="t" style="margin-top:6px"><tr><th>Lote</th><th>Preço</th><th>Vendidos</th><th>Situação</th><th></th></tr>' + lista.map(function (l, i) {
          var pct = l.quantidade ? Math.min(100, Math.round(l.vendidos / l.quantidade * 100)) : 0;
          return '<tr><td><b>' + esc(l.nome) + '</b>' + (l.venda_fim ? '<div class="small muted">vira em ' + Clic.data(l.venda_fim) + '</div>' : '') + '</td><td>' + money(l.preco_centavos) + '</td>' +
            '<td style="min-width:120px">' + l.vendidos + ' / ' + l.quantidade + '<div class="barra" style="margin-top:4px"><i style="width:' + pct + '%"></i></div></td>' +
            '<td><span class="pill ' + sit[i][0] + '">' + sit[i][1] + '</span></td><td style="text-align:right"><button class="btn peq" data-ed="' + l.id + '">Editar</button></td></tr>';
        }).join('') + '</table></div>';
    });
    html += '<p class="small muted" style="margin-top:14px">Cada tipo tem os seus lotes. Quando um lote esgota (ou chega a data de virada), o próximo do mesmo tipo abre sozinho.</p></div>';
    A.innerHTML = html;

    $('#b-montar').onclick = function () { montador(); };
    $('#b-avulso').onclick = function () { editarLote(null, {}); };
    $$('[data-ed]').forEach(function (b) { b.onclick = function () { editarLote(lotes.find(function (l) { return l.id === b.dataset.ed; })); }; });
    $$('[data-prox]').forEach(function (b) {
      b.onclick = function () {
        var lista = grupos[b.dataset.prox], ult = lista[lista.length - 1];
        editarLote(null, { area: ult.area, pessoas_por_ingresso: ult.pessoas_por_ingresso, ordem: ult.ordem + 1, quantidade: ult.quantidade,
          preco_centavos: ult.preco_centavos, nome: maiusc(ult.area) + ' · ' + ordinal(ult.ordem + 2), max_por_pedido: ult.max_por_pedido });
      };
    });
    if (!lotes.length) montador();

    // ---------- montador: todos os tipos x lotes numa tabela só
    function montador() {
      var escolhidos = ['homem', 'mulher', 'casal'], nLotes = 3, extras = [];
      var opcoes = TIPOS_ING.concat(areasMapa.filter(function (a) { return TIPOS_ING.indexOf(a) < 0; }));
      modal('<div style="max-width:100%"><h3 style="margin-top:0">Montar ingressos</h3><p class="small muted" style="margin-top:0">Marque os tipos, escolha quantos lotes e preencha preço e quantidade. Tudo é criado de uma vez.</p>' +
        '<label>Tipos de ingresso</label><div id="m-tipos" class="abas" style="margin:6px 0 4px"></div>' +
        '<div style="display:flex;gap:8px;margin-bottom:10px"><input id="m-novo" placeholder="Outro tipo (ex.: Área kids, Open bar)" style="flex:1"><button type="button" class="btn peq" id="m-add">Adicionar</button></div>' +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:end"><div><label>Quantos lotes?</label><select id="m-n">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<option' + (n === nLotes ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
        '<label class="check" style="margin:0 0 10px"><input type="checkbox" id="m-vira" checked> Lote seguinte abre sozinho quando o anterior esgotar</label></div>' +
        '<div id="m-grade" style="overflow-x:auto;margin-top:10px"></div>' +
        '<div class="small muted" style="margin-top:6px">Dica: preencha o 1º lote e toque em "Copiar quantidade" para repetir em todos. Data de virada é opcional: se preencher, o lote também fecha nessa data.</div>' +
        '<div class="acoes" style="margin-top:14px"><button class="btn prim" id="m-criar">Criar ingressos</button><button type="button" class="btn" data-fechar>Cancelar</button></div><div class="erro" id="m-erro"></div></div>', function (m) {
        m.querySelector('.modal').style.maxWidth = '980px';
        var valores = {};  // guarda o que já foi digitado ao redesenhar
        function guardar() { [].forEach.call(m.querySelectorAll('#m-grade input'), function (i) { valores[i.name] = i.value; }); }
        function chips() {
          m.querySelector('#m-tipos').innerHTML = opcoes.concat(extras).map(function (t) { return '<button type="button" data-t="' + esc(t) + '" class="' + (escolhidos.indexOf(t) >= 0 ? 'on' : '') + '">' + esc(maiusc(t)) + '</button>'; }).join('');
          [].forEach.call(m.querySelectorAll('[data-t]'), function (b) {
            b.onclick = function () { guardar(); var t = b.dataset.t, i = escolhidos.indexOf(t); if (i >= 0) escolhidos.splice(i, 1); else escolhidos.push(t); chips(); grade(); };
          });
        }
        function grade() {
          var cab = '<tr><th style="min-width:110px">Tipo</th><th>Pessoas</th>';
          for (var j = 0; j < nLotes; j++) cab += '<th style="min-width:170px">' + ordinal(j + 1) + ' <span class="small muted">· preço e quantidade</span><div class="small muted" style="margin-top:4px">vira em (opcional)</div><input name="fim_' + j + '" type="datetime-local" style="font-size:12px;padding:6px"></th>';
          cab += '</tr>';
          var linhas = escolhidos.map(function (t) {
            var r = '<tr><td><b>' + esc(maiusc(t)) + '</b>' + (grupos[t] ? '<div class="small muted">já tem ' + grupos[t].length + ' lote(s): os novos continuam a contagem</div>' : '') + '</td>' +
              '<td><input name="p_' + esc(t) + '" type="number" min="1" max="10" value="' + (grupos[t] ? grupos[t][0].pessoas_por_ingresso : (PESSOAS_PADRAO[t] || 1)) + '" style="width:64px"></td>';
            for (var j = 0; j < nLotes; j++) r += '<td><div style="display:flex;gap:4px"><input name="v_' + esc(t) + '_' + j + '" inputmode="decimal" placeholder="R$" style="width:80px"><input name="q_' + esc(t) + '_' + j + '" type="number" min="0" placeholder="qtd" style="width:72px"></div></td>';
            return r + '</tr>';
          }).join('');
          m.querySelector('#m-grade').innerHTML = escolhidos.length ? '<table class="t">' + cab + linhas + '</table><button type="button" class="btn peq" id="m-copiar" style="margin-top:8px"><i class="ti ti-copy"></i> Copiar quantidade do 1º lote para os outros</button>' : '<p class="muted">Marque pelo menos um tipo acima.</p>';
          [].forEach.call(m.querySelectorAll('#m-grade input'), function (i) { if (valores[i.name] != null) i.value = valores[i.name]; });
          var cp = m.querySelector('#m-copiar');
          if (cp) cp.onclick = function () { escolhidos.forEach(function (t) { var q0 = m.querySelector('[name="q_' + t + '_0"]').value; for (var j = 1; j < nLotes; j++) m.querySelector('[name="q_' + t + '_' + j + '"]').value = q0; }); };
        }
        m.querySelector('#m-n').onchange = function () { guardar(); nLotes = +this.value; grade(); };
        m.querySelector('#m-add').onclick = function () { var v = m.querySelector('#m-novo').value.trim().toLowerCase(); if (!v) return; guardar(); if (opcoes.concat(extras).indexOf(v) < 0) extras.push(v); if (escolhidos.indexOf(v) < 0) escolhidos.push(v); m.querySelector('#m-novo').value = ''; chips(); grade(); };
        chips(); grade();
        m.querySelector('#m-criar').onclick = async function () {
          var er = m.querySelector('#m-erro'), novos = []; er.textContent = '';
          var vira = m.querySelector('#m-vira').checked;
          for (var a = 0; a < escolhidos.length; a++) {
            var t = escolhidos[a], base = grupos[t] ? grupos[t][grupos[t].length - 1].ordem + 1 : 0;
            var pess = Math.min(10, Math.max(1, parseInt(m.querySelector('[name="p_' + t + '"]').value, 10) || 1));
            for (var j = 0; j < nLotes; j++) {
              var vTxt = m.querySelector('[name="v_' + t + '_' + j + '"]').value.trim(), qTxt = m.querySelector('[name="q_' + t + '_' + j + '"]').value.trim();
              if (!vTxt && !qTxt) continue;
              if (!vTxt || !qTxt) { er.textContent = 'Preencha preço e quantidade de ' + maiusc(t) + ' · ' + ordinal(j + 1) + ' (ou deixe os dois vazios).'; return; }
              var fim = m.querySelector('[name="fim_' + j + '"]').value;
              novos.push({ org_id: ORG.id, evento_id: ev.id, area: t, pessoas_por_ingresso: pess, ordem: base + j, nome: maiusc(t) + ' · ' + ordinal(base + j + 1),
                preco_centavos: Clic.centavos(vTxt), quantidade: parseInt(qTxt, 10) || 0, vira_sozinho: vira, venda_fim: fim ? new Date(fim).toISOString() : null, max_por_pedido: 10, ativo: true });
            }
          }
          if (!novos.length) { er.textContent = 'Preencha pelo menos um lote.'; return; }
          var b = this; Clic.carregando(b, true, 'Criando…');
          var r = await sb.from('lotes').insert(novos);
          Clic.carregando(b, false);
          if (r.error) { er.textContent = Clic.erro(r.error); return; }
          m.remove(); Clic.toast(novos.length + ' lote(s) criados'); rota();
        };
      });
    }

    // ---------- editar um lote (ou criar avulso / próximo lote)
    function editarLote(l, pre) {
      var d = l || pre || {};
      var opcoes = TIPOS_ING.concat(areasMapa).concat(Object.keys(grupos)).filter(function (v, i, s) { return v && s.indexOf(v) === i; });
      modal('<form id="f-lote"><h3 style="margin-top:0">' + (l ? 'Editar lote' : 'Novo lote') + '</h3>' +
        '<label>Nome</label><input name="nome" required value="' + esc(d.nome || '') + '" placeholder="Homem · 1º lote">' +
        '<label>Descrição (opcional)</label><input name="descricao" value="' + esc(d.descricao || '') + '">' +
        '<div class="linha2"><div><label>Tipo de ingresso</label><select name="tipo">' + opcoes.map(function (t) { return '<option value="' + esc(t) + '"' + (t === (d.area || '') ? ' selected' : '') + '>' + esc(maiusc(t)) + '</option>'; }).join('') + '<option value=""' + (l && !d.area ? ' selected' : '') + '>Sem tipo</option><option value="__outro">Outro (digitar)…</option></select><input name="area" placeholder="Digite o tipo" style="display:none;margin-top:6px"></div>' +
        '<div><label>Pessoas por ingresso</label><input name="pessoas" type="number" min="1" max="10" value="' + (d.pessoas_por_ingresso || 1) + '"></div></div>' +
        '<div class="linha2"><div><label>Preço (R$)</label><input name="preco" required inputmode="decimal" value="' + (d.preco_centavos != null ? (d.preco_centavos / 100).toFixed(2).replace('.', ',') : '') + '"></div><div><label>Quantidade</label><input name="quantidade" type="number" min="0" required value="' + (d.quantidade != null ? d.quantidade : '') + '"></div></div>' +
        '<div class="linha2"><div><label>Ordem (1º, 2º lote…)</label><input name="ordem" type="number" min="1" value="' + ((d.ordem || 0) + 1) + '"></div><div><label>Máximo por pedido</label><input name="max_por_pedido" type="number" min="1" value="' + (d.max_por_pedido || 10) + '"></div></div>' +
        '<div class="linha2"><div><label>Começa a vender</label><input type="datetime-local" name="venda_inicio" value="' + isoLocal(d.venda_inicio) + '"></div><div><label>Vira / para de vender em</label><input type="datetime-local" name="venda_fim" value="' + isoLocal(d.venda_fim) + '"></div></div>' +
        '<label class="check"><input type="checkbox" name="vira_sozinho"' + (d.vira_sozinho === false ? '' : ' checked') + '> Só abre quando o lote anterior do mesmo tipo acabar</label>' +
        '<label class="check"><input type="checkbox" name="ativo"' + (d.ativo === false ? '' : ' checked') + '> Ativo (desmarque para pausar a venda)</label>' +
        (l ? '<p class="small muted">Vendidos: ' + l.vendidos + '. A quantidade não pode ficar menor que isso.</p>' : '') +
        '<div class="acoes" style="margin-top:12px"><button class="btn prim">Salvar</button><button type="button" class="btn" data-fechar>Cancelar</button>' + (l && !l.vendidos ? '<button type="button" class="btn perigo" id="lote-apagar">Apagar</button>' : '') + '</div></form>', function (m) {
        var f = m.querySelector('#f-lote');
        f.tipo.onchange = function () { f.area.style.display = this.value === '__outro' ? '' : 'none'; if (PESSOAS_PADRAO[this.value]) f.pessoas.value = PESSOAS_PADRAO[this.value]; };
        if (m.querySelector('#lote-apagar')) m.querySelector('#lote-apagar').onclick = async function () { if (!confirm('Apagar este lote?')) return; await q(sb.from('lotes').delete().eq('id', l.id)); m.remove(); Clic.toast('Lote apagado'); rota(); };
        f.onsubmit = async function (e) {
          e.preventDefault();
          var qtd = parseInt(f.quantidade.value, 10);
          if (l && qtd < l.vendidos) return Clic.toast('A quantidade não pode ser menor que os ' + l.vendidos + ' já vendidos.', true);
          var dados = { org_id: ORG.id, evento_id: ev.id, nome: f.nome.value.trim(), descricao: f.descricao.value || null, preco_centavos: Clic.centavos(f.preco.value),
            quantidade: qtd, area: (f.tipo.value === '__outro' ? f.area.value : f.tipo.value).trim().toLowerCase() || null,
            pessoas_por_ingresso: Math.min(10, Math.max(1, parseInt(f.pessoas.value, 10) || 1)), ordem: Math.max(0, (parseInt(f.ordem.value, 10) || 1) - 1),
            venda_inicio: f.venda_inicio.value ? new Date(f.venda_inicio.value).toISOString() : null, venda_fim: f.venda_fim.value ? new Date(f.venda_fim.value).toISOString() : null,
            max_por_pedido: parseInt(f.max_por_pedido.value, 10) || 10, vira_sozinho: f.vira_sozinho.checked, ativo: f.ativo.checked };
          if (l) await q(sb.from('lotes').update(dados).eq('id', l.id)); else await q(sb.from('lotes').insert(dados));
          m.remove(); Clic.toast('Lote salvo'); rota();
        };
      });
    }
  }

  // ---- mapa do evento (prancheta 100 x 70)
  var CORES_MAPA = { area: '#FF5A1F', stage: '#2a2a2a', bar: '#c2410c', shop: '#b45309', wc: '#475569', entry: '#0f766e' };
  var NOMES_MAPA = { area: 'Área de venda', stage: 'Palco', bar: 'Bar', shop: 'Loja', wc: 'Banheiros', entry: 'Entrada' };
  function svgMapa(itens) {
    return '<svg class="mapa-svg" viewBox="0 0 100 70">' + itens.map(function (i, k) {
      var cor = i.cor || CORES_MAPA[i.t] || '#555', nome = i.nome || NOMES_MAPA[i.t];
      return '<g data-k="' + k + '"><rect x="' + i.x + '" y="' + i.y + '" width="' + i.w + '" height="' + i.h + '" rx="1.4" fill="' + cor + '" fill-opacity="' + (i.t === 'area' ? .85 : 1) + '"/>' +
        '<text x="' + (i.x + i.w / 2) + '" y="' + (i.y + i.h / 2 + 1) + '" font-size="' + Math.min(3.2, i.w / 6) + '" text-anchor="middle" fill="#fff" font-family="Archivo" font-weight="700">' + esc(nome) + '</text></g>';
    }).join('') + '</svg>';
  }
  async function abaMapa(ev, A) {
    var itens = (ev.mapa && ev.mapa.itens) || [];
    function desenhar() {
      A.innerHTML = '<div class="duas"><div class="card"><h3>Prévia do mapa</h3>' + svgMapa(itens) + '<p class="small muted" style="margin-top:8px">A prancheta tem 100 de largura por 70 de altura. O nome de cada área de venda precisa ser igual à "Área do mapa" dos lotes.</p>' +
        '<div class="acoes"><button class="btn" id="m-padrao">Usar modelo pronto</button><button class="btn prim" id="m-salvar">Salvar mapa</button>' + (itens.length ? '<button class="btn perigo" id="m-limpar">Sem mapa</button>' : '') + '</div></div>' +
        '<div class="card"><h3>Itens</h3>' + itens.map(function (i, k) {
          return '<div class="lista-item" style="flex-wrap:wrap"><select data-c="t" data-k="' + k + '" style="width:130px">' + Object.keys(NOMES_MAPA).map(function (t) { return '<option value="' + t + '"' + (t === i.t ? ' selected' : '') + '>' + NOMES_MAPA[t] + '</option>'; }).join('') + '</select>' +
            '<input data-c="nome" data-k="' + k + '" value="' + esc(i.nome || '') + '" placeholder="Nome" style="width:120px">' +
            ['x', 'y', 'w', 'h'].map(function (c) { return '<input data-c="' + c + '" data-k="' + k + '" type="number" value="' + i[c] + '" style="width:58px" title="' + c + '">'; }).join('') +
            '<input data-c="cor" data-k="' + k + '" type="color" value="' + (i.cor || CORES_MAPA[i.t]) + '" style="width:44px;padding:2px"><button class="btn peq perigo" data-del="' + k + '"><i class="ti ti-trash"></i></button></div>';
        }).join('') + '<button class="btn peq" id="m-add" style="margin-top:10px"><i class="ti ti-plus"></i> Adicionar item</button></div></div>';
      $$('[data-c]').forEach(function (inp) {
        inp.oninput = function () { var it = itens[inp.dataset.k], c = inp.dataset.c; it[c] = ['x', 'y', 'w', 'h'].indexOf(c) >= 0 ? Math.max(0, parseFloat(inp.value) || 0) : inp.value; $('.mapa-svg').outerHTML = svgMapa(itens); };
        inp.onchange = desenhar;
      });
      $$('[data-del]').forEach(function (b) { b.onclick = function () { itens.splice(+b.dataset.del, 1); desenhar(); }; });
      $('#m-add').onclick = function () { itens.push({ t: 'area', nome: 'Nova área', x: 30, y: 30, w: 20, h: 12 }); desenhar(); };
      $('#m-padrao').onclick = function () {
        itens = [{ t: 'stage', nome: 'Palco', x: 30, y: 2, w: 40, h: 9 }, { t: 'area', nome: 'Pista', x: 26, y: 15, w: 48, h: 30 },
          { t: 'area', nome: 'Camarote', x: 77, y: 15, w: 20, h: 30 }, { t: 'area', nome: 'VIP', x: 3, y: 15, w: 20, h: 18 },
          { t: 'bar', nome: 'Bar', x: 3, y: 36, w: 20, h: 10 }, { t: 'wc', nome: 'Banheiros', x: 77, y: 50, w: 20, h: 10 }, { t: 'entry', nome: 'Entrada', x: 40, y: 60, w: 20, h: 7 }];
        desenhar();
      };
      $('#m-salvar').onclick = async function () { await q(sb.from('eventos').update({ mapa: itens.length ? { itens: itens } : null }).eq('id', ev.id)); ev.mapa = { itens: itens }; Clic.toast('Mapa salvo'); };
      if ($('#m-limpar')) $('#m-limpar').onclick = function () { itens = []; desenhar(); };
    }
    desenhar();
  }

  // ---- excursões: modelos de veículo
  var MODELOS = {
    van15: { nome: 'Van 15 lugares', andares: [{ nome: 'Van', fileiras: 5, padrao: 'AA_A', classe: 'conv' }] },
    micro28: { nome: 'Micro-ônibus 28 lugares', andares: [{ nome: 'Micro', fileiras: 7, padrao: 'AA_AA', classe: 'conv' }] },
    conv44: { nome: 'Ônibus convencional 44 lugares', andares: [{ nome: 'Ônibus', fileiras: 11, padrao: 'AA_AA', classe: 'conv' }] },
    exec46: { nome: 'Executivo 46 lugares', andares: [{ nome: 'Ônibus', fileiras: 11, padrao: 'AA_AA', classe: 'exec', extra: 'AA' }] },
    semi42: { nome: 'Semi-leito 42 lugares', andares: [{ nome: 'Ônibus', fileiras: 10, padrao: 'AA_AA', classe: 'semi', extra: 'AA' }] },
    leito28: { nome: 'Leito 28 lugares', andares: [{ nome: 'Ônibus', fileiras: 9, padrao: 'AA_A', classe: 'leito', extra: 'A' }] },
    dd60: { nome: '2 andares 60 lugares', andares: [{ nome: 'Andar de cima', fileiras: 12, padrao: 'AA_AA', classe: 'semi' }, { nome: 'Andar de baixo', fileiras: 4, padrao: 'AA_A', classe: 'cama' }] }
  };
  var CLASSES = { conv: ['Convencional', '#3b82f6'], exec: ['Executivo', '#14b8a6'], semi: ['Semi-leito', '#8b5cf6'], leito: ['Leito', '#e11d48'], cama: ['Leito-cama', '#e8590c'] };
  function gerarAndares(modelo) {
    var n = 0;
    return MODELOS[modelo].andares.map(function (a, ai) {
      var linhas = [ai === MODELOS[modelo].andares.length - 1 || MODELOS[modelo].andares.length === 1 ? [{ f: 'motorista', w: 2 }, null, { f: 'porta', w: 2 }] : [{ f: 'vista', w: 5 }]];
      function linha(p) { return p.split('').map(function (ch) { if (ch === '_') return null; n++; return { s: String(n), c: a.classe, w: 1 }; }); }
      for (var i = 0; i < a.fileiras; i++) linhas.push(linha(a.padrao));
      if (a.extra) linhas.push(linha(a.extra));
      return { nome: a.nome, fileiras: linhas };
    });
  }
  async function abaVeiculos(ev, A) {
    var r = await Promise.all([sb.from('veiculos').select('*, classes_poltrona(*)').eq('evento_id', ev.id).order('ordem'), sb.from('lotes').select('id,nome,preco_centavos').eq('evento_id', ev.id)]);
    var veics = r[0].data || [], lotes = r[1].data || [];
    A.innerHTML = '<div class="duas"><div class="card"><h3>Veículos</h3>' + (veics.length ? veics.map(function (v) {
      var cap = 0; v.andares.forEach(function (a) { a.fileiras.forEach(function (l) { l.forEach(function (c) { if (c && c.s) cap++; }); }); });
      return '<div class="lista-item" style="align-items:flex-start;flex-direction:column"><div style="display:flex;justify-content:space-between;width:100%"><b>' + esc(v.nome) + '</b><span class="muted small">' + esc(MODELOS[v.modelo] ? MODELOS[v.modelo].nome : v.modelo) + ' · ' + cap + ' lugares</span></div>' +
        v.classes_poltrona.map(function (c) {
          return '<div style="display:flex;gap:8px;align-items:center;width:100%;margin-top:6px"><span class="pill" style="background:' + c.cor + '33;color:' + c.cor + '">' + esc(c.nome) + '</span><select data-classe="' + c.id + '" style="flex:1"><option value="">Escolha o lote (preço)…</option>' +
            lotes.map(function (l) { return '<option value="' + l.id + '"' + (l.id === c.lote_id ? ' selected' : '') + '>' + esc(l.nome) + ' · ' + money(l.preco_centavos) + '</option>'; }).join('') + '</select></div>';
        }).join('') + '<label style="margin-top:8px">Poltronas bloqueadas (separe por vírgula)</label><div style="display:flex;gap:6px;width:100%"><input data-bloq="' + v.id + '" value="' + esc(v.bloqueadas.join(', ')) + '"><button class="btn peq" data-salvabloq="' + v.id + '">Salvar</button><button class="btn peq perigo" data-delv="' + v.id + '"><i class="ti ti-trash"></i></button></div></div>';
    }).join('') : vazio('bus', 'Adicione o primeiro veículo.')) + '<p class="small muted">Cada tipo de poltrona usa o preço de um lote. Crie os lotes antes (ex.: "Poltrona semi-leito" R$ 189,00).</p></div>' +
      '<form class="card" id="f-v"><h3>Adicionar veículo</h3><label>Nome</label><input name="nome" required placeholder="Ônibus 1"><label>Modelo</label><select name="modelo">' +
      Object.keys(MODELOS).map(function (k) { return '<option value="' + k + '">' + MODELOS[k].nome + '</option>'; }).join('') + '</select><label>Descrição (opcional)</label><input name="descricao" placeholder="ar-condicionado · banheiro · USB">' +
      '<button class="btn prim" style="margin-top:14px">Adicionar</button></form></div>';
    $('#f-v').onsubmit = async function (e) {
      e.preventDefault(); var f = this;
      var v = await q(sb.from('veiculos').insert({ org_id: ORG.id, evento_id: ev.id, nome: f.nome.value, modelo: f.modelo.value, descricao: f.descricao.value || null, andares: gerarAndares(f.modelo.value), ordem: veics.length }).select().single());
      var cls = {}; MODELOS[f.modelo.value].andares.forEach(function (a) { cls[a.classe] = 1; });
      await q(sb.from('classes_poltrona').insert(Object.keys(cls).map(function (c) { return { org_id: ORG.id, veiculo_id: v.id, codigo: c, nome: CLASSES[c][0], cor: CLASSES[c][1] }; })));
      Clic.toast('Veículo adicionado'); rota();
    };
    $$('[data-classe]').forEach(function (s) { s.onchange = async function () { await q(sb.from('classes_poltrona').update({ lote_id: s.value || null }).eq('id', s.dataset.classe)); Clic.toast('Preço ligado'); }; });
    $$('[data-salvabloq]').forEach(function (b) { b.onclick = async function () { var v = $('[data-bloq="' + b.dataset.salvabloq + '"]').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean); await q(sb.from('veiculos').update({ bloqueadas: v }).eq('id', b.dataset.salvabloq)); Clic.toast('Salvo'); }; });
    $$('[data-delv]').forEach(function (b) { b.onclick = async function () { if (!confirm('Remover este veículo?')) return; await q(sb.from('veiculos').delete().eq('id', b.dataset.delv)); rota(); }; });
  }
  async function abaEmbarque(ev, A) {
    var pts = await q(sb.from('pontos_embarque').select('*').eq('evento_id', ev.id).order('quando'));
    A.innerHTML = '<div class="duas"><div class="card"><h3>Pontos de embarque</h3>' + (pts.length ? pts.map(function (p) {
      return '<div class="lista-item"><div><b>' + esc(p.local) + '</b><div class="small muted">' + Clic.data(p.quando) + '</div></div><button class="btn peq perigo" data-del="' + p.id + '"><i class="ti ti-trash"></i></button></div>';
    }).join('') : vazio('map-pin', 'Nenhum ponto ainda.')) + '</div><form class="card" id="f-pe"><h3>Novo ponto</h3><label>Local</label><input name="local" required placeholder="Rodoviária — plataforma 3"><label>Data e hora</label><input type="datetime-local" name="quando" required value="' + isoLocal(ev.inicio) + '"><button class="btn prim" style="margin-top:14px">Adicionar</button></form></div>';
    $('#f-pe').onsubmit = async function (e) { e.preventDefault(); await q(sb.from('pontos_embarque').insert({ org_id: ORG.id, evento_id: ev.id, local: this.local.value, quando: new Date(this.quando.value).toISOString(), ordem: pts.length })); rota(); };
    $$('[data-del]').forEach(function (b) { b.onclick = async function () { await q(sb.from('pontos_embarque').delete().eq('id', b.dataset.del)); rota(); }; });
  }
  async function abaPassageiros(ev, A) {
    var r = await Promise.all([sb.from('ingressos').select('*, pedidos(codigo,cliente_nome,cliente_whatsapp)').eq('evento_id', ev.id).neq('situacao', 'cancelado'),
      sb.from('veiculos').select('id,nome').eq('evento_id', ev.id), sb.from('pontos_embarque').select('id,local,quando').eq('evento_id', ev.id)]);
    var ing = r[0].data || [], vs = {}, ps = {};
    (r[1].data || []).forEach(function (v) { vs[v.id] = v.nome; }); (r[2].data || []).forEach(function (p) { ps[p.id] = p.local; });
    ing.sort(function (a, b) { return (vs[a.veiculo_id] || '').localeCompare(vs[b.veiculo_id] || '') || (parseInt(a.poltrona, 10) - parseInt(b.poltrona, 10)); });
    var linhas = ing.map(function (i) { return [vs[i.veiculo_id] || '', i.poltrona || '', i.passageiro_nome || '', i.passageiro_doc || '', ps[i.embarque_id] || '', i.pedidos ? i.pedidos.codigo : '', i.pedidos ? i.pedidos.cliente_whatsapp : '', i.situacao === 'usado' ? 'embarcou' : '']; });
    A.innerHTML = '<div class="card"><div class="acoes" style="margin-bottom:10px"><button class="btn" id="b-csv"><i class="ti ti-download"></i> Baixar planilha</button><button class="btn" onclick="window.print()"><i class="ti ti-printer"></i> Imprimir</button></div>' +
      (ing.length ? '<table class="t"><tr><th>Veículo</th><th>Poltrona</th><th>Passageiro</th><th>Documento</th><th>Embarque</th><th>Pedido</th><th></th></tr>' + linhas.map(function (l) {
        return '<tr><td>' + esc(l[0]) + '</td><td><b>' + esc(l[1]) + '</b></td><td>' + esc(l[2]) + '</td><td>' + esc(l[3]) + '</td><td>' + esc(l[4]) + '</td><td>' + esc(l[5]) + '</td><td>' + (l[7] ? '<span class="pill verde">embarcou</span>' : '') + '</td></tr>';
      }).join('') + '</table>' : vazio('users', 'Nenhum passageiro ainda.')) + '</div>';
    $('#b-csv').onclick = function () { csv('embarque-' + ev.slug + '.csv', [['Veículo', 'Poltrona', 'Passageiro', 'Documento', 'Embarque', 'Pedido', 'WhatsApp', 'Situação']].concat(linhas)); };
  }

  // ================================================================ VENDAS
  PAGINAS.vendas = async function () {
    titulo('Vendas');
    var f = JSON.parse(sessionStorage.getItem('vendas_f') || '{}');
    var qy = sb.from('pedidos').select('*').eq('org_id', ORG.id).order('criado_em', { ascending: false }).limit(300);
    if (f.canal) qy = qy.eq('canal', f.canal);
    if (f.situacao) qy = qy.eq('situacao', f.situacao);
    if (f.busca) f.busca = f.busca.replace(/[,()%*]/g, ' ').trim();
    if (f.busca) qy = qy.or('codigo.ilike.%' + f.busca + '%,cliente_nome.ilike.%' + f.busca + '%,cliente_email.ilike.%' + f.busca + '%,cliente_whatsapp.ilike.%' + f.busca.replace(/\D/g, '') + '%');
    var ps = await q(qy);
    C.innerHTML = '<form class="card" id="f-busca" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:14px;align-items:end">' +
      '<div><label>Buscar</label><input name="busca" value="' + esc(f.busca || '') + '" placeholder="Código, nome, e-mail ou WhatsApp"></div>' +
      '<div><label>Canal</label><select name="canal"><option value="">Todos</option>' + Object.keys(CANAL).map(function (k) { return '<option value="' + k + '"' + (f.canal === k ? ' selected' : '') + '>' + CANAL[k] + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Situação</label><select name="situacao"><option value="">Todas</option>' + ['pago', 'aguardando', 'em_analise', 'cancelado', 'expirado', 'estornado'].map(function (k) { return '<option value="' + k + '"' + (f.situacao === k ? ' selected' : '') + '>' + k.replace('_', ' ') + '</option>'; }).join('') + '</select></div>' +
      '<button class="btn prim">Filtrar</button></form><div class="card">' +
      (ps.length ? '<table class="t"><tr><th>Pedido</th><th>Cliente</th><th>Canal</th><th>Forma</th><th>Total</th><th>Situação</th><th>Quando</th></tr>' + ps.map(function (p) {
        return '<tr data-p="' + p.id + '" style="cursor:pointer"><td><b>' + p.codigo + '</b></td><td>' + esc(p.cliente_nome || '—') + '</td><td>' + (CANAL[p.canal] || '') + '</td><td>' + (FORMA[p.forma] || '—') + '</td><td>' + money(p.total_centavos) + '</td><td>' + pill(p.situacao) + '</td><td class="small muted">' + Clic.data(p.criado_em) + '</td></tr>';
      }).join('') + '</table>' : vazio('receipt', 'Nenhuma venda encontrada.')) + '</div>';
    $('#f-busca').onsubmit = function (e) { e.preventDefault(); sessionStorage.setItem('vendas_f', JSON.stringify(form(this))); rota(); };
    $$('[data-p]').forEach(function (tr) { tr.onclick = function () { verPedido(ps.find(function (p) { return p.id === tr.dataset.p; })); }; });
  };
  async function verPedido(p) {
    var r = await Promise.all([sb.from('itens_pedido').select('*').eq('pedido_id', p.id), sb.from('ingressos').select('descricao,situacao,usado_em,poltrona,passageiro_nome').eq('pedido_id', p.id)]);
    modal('<div style="display:flex;justify-content:space-between"><h3>Pedido ' + p.codigo + '</h3><button class="btn peq" data-fechar>Fechar</button></div>' + pill(p.situacao) +
      '<p style="margin-top:10px">' + esc(p.cliente_nome || '') + '<br><span class="small muted">' + esc(p.cliente_email || '') + ' · ' + esc(p.cliente_whatsapp || '') + (p.cliente_cpf ? ' · CPF ' + esc(p.cliente_cpf) : '') + '</span></p>' +
      '<table class="t">' + (r[0].data || []).map(function (i) { return '<tr><td>' + i.quantidade + '× ' + esc(i.descricao) + (i.poltrona ? ' · poltrona ' + esc(i.poltrona) : '') + '</td><td style="text-align:right">' + money(i.quantidade * i.preco_unit_centavos) + '</td></tr>'; }).join('') +
      '<tr><td>Taxa de serviço</td><td style="text-align:right">' + money(p.taxa_conveniencia_centavos + p.taxa_pagamento_centavos) + '</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>' + money(p.total_centavos) + '</b></td></tr></table>' +
      '<p class="small muted" style="margin-top:10px">' + (CANAL[p.canal] || '') + ' · ' + (FORMA[p.forma] || 'sem forma') + ' · criado ' + Clic.data(p.criado_em) + (p.pago_em ? ' · pago ' + Clic.data(p.pago_em) : '') + (p.codigo_retirada ? ' · retirada <b>' + p.codigo_retirada + '</b>' + (p.retirado_em ? ' (entregue)' : '') : '') + '</p>' +
      ((r[1].data || []).length ? '<h3 style="margin-top:12px">Ingressos</h3>' + r[1].data.map(function (i) { return '<div class="small">' + esc(i.descricao) + (i.passageiro_nome ? ' · ' + esc(i.passageiro_nome) : '') + ' — ' + (i.situacao === 'usado' ? '<span class="ok">entrou ' + Clic.data(i.usado_em) + '</span>' : i.situacao) + '</div>'; }).join('') : '') +
      (['aguardando', 'em_analise'].indexOf(p.situacao) >= 0 ? '<div class="card" style="margin-top:14px"><b>Confirmar pagamento recebido por fora</b><div style="display:flex;gap:8px;margin-top:8px"><select id="forma-man"><option value="pix_balcao">Pix (direto na conta)</option><option value="dinheiro">Dinheiro</option><option value="cartao_balcao">Cartão no balcão</option><option value="point">Maquininha</option></select><button class="btn prim" id="confirmar-man">Confirmar</button></div><p class="small muted" style="margin-top:6px">Gera os ingressos e conta a taxa da Clic no repasse semanal.</p></div>' : ''),
      function (m) {
        var b = m.querySelector('#confirmar-man');
        if (b) b.onclick = async function () { await q(sb.rpc('confirmar_pedido_manual', { p_pedido: p.id, p_forma: m.querySelector('#forma-man').value })); Clic.toast('Pagamento confirmado'); m.remove(); rota(); };
      });
  }

  // ================================================================ PORTARIAS
  PAGINAS.portarias = async function () {
    titulo('Portarias');
    var r = await Promise.all([sb.from('portarias').select('*, eventos(nome,inicio)').eq('org_id', ORG.id).order('criado_em', { ascending: false }),
      sb.from('eventos').select('id,nome,inicio').eq('org_id', ORG.id).neq('situacao', 'cancelado').gte('inicio', new Date(Date.now() - 2 * 864e5).toISOString()).order('inicio')]);
    var pts = r[0].data || [], evs = r[1].data || [];
    C.innerHTML = '<div class="duas"><div class="card"><h3>Portarias e aparelhos</h3><p class="small muted">Cada portaria fica presa a um evento. No celular de quem vai validar, leia o QR Code (ou abra o link). Pronto: o aparelho vira leitor de ingressos.</p>' +
      (pts.length ? pts.map(function (p) {
        var url = Clic.cfg.SITE + '/portaria/?t=' + p.token_pareamento;
        return '<div class="lista-item"><div><b>' + esc(p.nome) + '</b> ' + (p.ativo ? '<span class="pill verde">ativa</span>' : '<span class="pill cinza">desligada</span>') + '<div class="small muted">' + esc(p.eventos ? p.eventos.nome : '') + ' · ' + Clic.data(p.eventos && p.eventos.inicio) + '</div></div>' +
          '<div class="acoes"><button class="btn peq" data-qr="' + esc(url) + '" data-n="' + esc(p.nome) + '"><i class="ti ti-qrcode"></i> Parear</button><button class="btn peq" data-tg="' + p.id + '" data-a="' + p.ativo + '">' + (p.ativo ? 'Desligar' : 'Ligar') + '</button><button class="btn peq perigo" data-del="' + p.id + '"><i class="ti ti-trash"></i></button></div></div>';
      }).join('') : vazio('qrcode', 'Nenhuma portaria criada.')) + '</div>' +
      '<form class="card" id="f-pt"><h3>Nova portaria</h3>' + (evs.length ? '<label>Nome</label><input name="nome" required placeholder="Portão principal"><label>Evento</label><select name="evento_id">' +
        evs.map(function (e) { return '<option value="' + e.id + '">' + esc(e.nome) + ' · ' + Clic.data(e.inicio, { day: '2-digit', month: '2-digit' }) + '</option>'; }).join('') + '</select><button class="btn prim" style="margin-top:14px">Criar portaria</button>' : '<p class="muted">Crie um evento antes.</p>') + '</form></div>';
    if ($('#f-pt') && evs.length) $('#f-pt').onsubmit = async function (e) { e.preventDefault(); await q(sb.from('portarias').insert({ org_id: ORG.id, evento_id: this.evento_id.value, nome: this.nome.value })); rota(); };
    $$('[data-tg]').forEach(function (b) { b.onclick = async function () { await q(sb.from('portarias').update({ ativo: b.dataset.a !== 'true' }).eq('id', b.dataset.tg)); rota(); }; });
    $$('[data-del]').forEach(function (b) { b.onclick = async function () { if (!confirm('Apagar esta portaria? O aparelho pareado para de funcionar.')) return; await q(sb.from('portarias').delete().eq('id', b.dataset.del)); rota(); }; });
    $$('[data-qr]').forEach(function (b) {
      b.onclick = function () {
        var qr = qrcode(0, 'M'); qr.addData(b.dataset.qr); qr.make();
        modal('<h3>Parear: ' + esc(b.dataset.n) + '</h3><p class="small muted">Aponte a câmera do celular da portaria para este código.</p><div style="background:#fff;padding:14px;border-radius:12px;width:fit-content;margin:0 auto">' + qr.createSvgTag(6, 0) + '</div>' +
          '<div class="link-box" style="margin-top:12px"><span style="flex:1">' + esc(b.dataset.qr) + '</span></div><p class="small" style="color:var(--amarelo)">Quem tiver este link consegue validar ingressos deste evento. Não divulgue.</p><button class="btn" data-fechar>Fechar</button>');
      };
    });
  };

  // ================================================================ BRINDES E RETIRADAS
  PAGINAS.brindes = async function () {
    titulo('Brindes e retiradas');
    var r = await Promise.all([
      sb.from('promocoes').select('*, produtos(nome), eventos(nome)').eq('org_id', ORG.id).order('criado_em', { ascending: false }),
      sb.from('brindes').select('*, produtos(nome), pedidos(codigo,cliente_nome,codigo_retirada)').eq('org_id', ORG.id).order('criado_em', { ascending: false }).limit(200),
      sb.from('pedidos').select('id,codigo,cliente_nome,codigo_retirada,retirado_em,pago_em').eq('org_id', ORG.id).eq('situacao', 'pago').not('codigo_retirada', 'is', null).order('pago_em', { ascending: false }).limit(200),
      sb.from('produtos').select('id,nome').eq('org_id', ORG.id).eq('categoria', 'loja').eq('ativo', true),
      sb.from('eventos').select('id,nome').eq('org_id', ORG.id).neq('situacao', 'cancelado').order('inicio', { ascending: false }).limit(50)
    ]);
    var promos = r[0].data || [], brindes = r[1].data || [], ret = r[2].data || [], prods = r[3].data || [], evs = r[4].data || [];
    C.innerHTML = '<div class="grid g4" style="margin-bottom:16px"><div class="metric"><span>Promoções ativas</span><b>' + promos.filter(function (p) { return p.ativa; }).length + '</b></div>' +
      '<div class="metric" style="border-left-color:var(--rosa)"><span>Brindes gerados</span><b>' + brindes.reduce(function (a, b) { return a + b.quantidade; }, 0) + '</b></div>' +
      '<div class="metric" style="border-left-color:var(--verde)"><span>Já entregues</span><b>' + brindes.filter(function (b) { return b.situacao === 'entregue'; }).length + '</b></div>' +
      '<div class="metric" style="border-left-color:var(--amarelo)"><span>A retirar</span><b>' + ret.filter(function (p) { return !p.retirado_em; }).length + '</b></div></div>' +
      '<div class="duas"><div><form class="card" id="f-baixa" style="margin-bottom:16px"><h3>Entregar brinde ou produtos comprados</h3><p class="small muted">Digite o código que o cliente mostra no celular. Um código libera o pedido inteiro.</p><div style="display:flex;gap:8px"><input name="cod" required placeholder="ABC123" style="text-transform:uppercase"><button class="btn prim">Dar baixa</button></div><div id="baixa-res" style="margin-top:10px"></div></form>' +
      '<div class="card"><h3>Retiradas</h3>' + (ret.length ? '<table class="t"><tr><th>Código</th><th>Cliente</th><th>Pedido</th><th></th></tr>' + ret.map(function (p) { return '<tr><td><b>' + p.codigo_retirada + '</b></td><td>' + esc(p.cliente_nome || '') + '</td><td>' + p.codigo + '</td><td>' + (p.retirado_em ? '<span class="pill verde">entregue</span>' : '<span class="pill amarelo">a retirar</span>') + '</td></tr>'; }).join('') + '</table>' : vazio('package', 'Nenhuma retirada ainda.')) + '</div></div>' +
      '<div><div class="card" style="margin-bottom:16px"><h3>Promoções</h3>' + (promos.length ? promos.map(function (p) {
        return '<div class="lista-item"><div><b>' + esc(p.nome) + '</b><div class="small muted">A cada ' + p.a_cada + ' ingressos → 1 ' + esc(p.produtos ? p.produtos.nome : '') + ' · ' + esc(p.eventos ? p.eventos.nome : 'todos os eventos') + '</div></div><div class="acoes"><button class="btn peq" data-tg="' + p.id + '" data-a="' + p.ativa + '">' + (p.ativa ? 'Pausar' : 'Ativar') + '</button><button class="btn peq perigo" data-del="' + p.id + '"><i class="ti ti-trash"></i></button></div></div>';
      }).join('') : vazio('gift', 'Nenhuma promoção ainda.')) + '</div>' +
      '<form class="card" id="f-promo"><h3>Nova promoção</h3>' + (prods.length ? '<label>Nome</label><input name="nome" required placeholder="Compre 4 e ganhe um copo"><div class="linha2"><div><label>A cada (ingressos)</label><input name="a_cada" type="number" min="1" value="4" required></div><div><label>Brinde</label><select name="produto_id">' + prods.map(function (p) { return '<option value="' + p.id + '">' + esc(p.nome) + '</option>'; }).join('') + '</select></div></div>' +
        '<label>Evento</label><select name="evento_id"><option value="">Todos os eventos</option>' + evs.map(function (e) { return '<option value="' + e.id + '">' + esc(e.nome) + '</option>'; }).join('') + '</select><button class="btn prim" style="margin-top:14px">Criar promoção</button>' : '<p class="muted">Cadastre primeiro o produto do brinde em Produtos › Loja.</p>') + '</form></div></div>';
    $('#f-baixa').onsubmit = async function (e) {
      e.preventDefault();
      var res = await q(sb.rpc('dar_baixa_retirada', { p_org: ORG.id, p_codigo: this.cod.value }));
      $('#baixa-res').innerHTML = res.ok ? '<div class="card" style="border-color:var(--verde)"><b class="ok">Liberado para ' + esc(res.cliente || '') + '</b>' + res.itens.concat(res.brindes.map(function (b) { return { descricao: '🎁 ' + b.produto, qtd: b.qtd }; })).map(function (i) { return '<div>' + i.qtd + '× ' + esc(i.descricao) + '</div>'; }).join('') + '</div>' : '<div class="erro">' + esc(res.motivo) + '</div>';
      this.cod.value = '';
    };
    if (prods.length) $('#f-promo').onsubmit = async function (e) { e.preventDefault(); var d = form(this); await q(sb.from('promocoes').insert({ org_id: ORG.id, nome: d.nome, a_cada: +d.a_cada, produto_id: d.produto_id, evento_id: d.evento_id || null })); rota(); };
    $$('[data-tg]').forEach(function (b) { b.onclick = async function () { await q(sb.from('promocoes').update({ ativa: b.dataset.a !== 'true' }).eq('id', b.dataset.tg)); rota(); }; });
    $$('[data-del]').forEach(function (b) { b.onclick = async function () { if (!confirm('Apagar promoção?')) return; await q(sb.from('promocoes').delete().eq('id', b.dataset.del)); rota(); }; });
  };

  // ================================================================ PRODUTOS
  PAGINAS.produtos = async function (p) {
    titulo('Produtos');
    var cat = p[0] || 'bar';
    var ps = await q(sb.from('produtos').select('*').eq('org_id', ORG.id).eq('categoria', cat).order('nome'));
    var dica = { bar: 'Aparecem só no PDV do bar.', cozinha: 'Aparecem só no PDV da cozinha.', loja: 'Aparecem no PDV da loja e também no site/app para compra online.' };
    C.innerHTML = '<div class="abas">' + ['bar', 'cozinha', 'loja'].map(function (c) { return '<a href="#produtos/' + c + '" class="' + (c === cat ? 'on' : '') + '">' + c[0].toUpperCase() + c.slice(1) + '</a>'; }).join('') + '</div>' +
      '<div class="duas"><div class="card"><h3>' + ps.length + ' produto(s)</h3><p class="small muted">' + dica[cat] + '</p>' + (ps.length ? ps.map(function (x) {
        return '<div class="lista-item" style="' + (x.ativo ? '' : 'opacity:.5') + '"><div style="display:flex;gap:10px;align-items:center">' + (x.foto_url ? '<img class="mini" src="' + esc(x.foto_url) + '">' : '<div class="mini"></div>') +
          '<div><b>' + esc(x.nome) + '</b><div class="small muted">' + money(x.preco_centavos) + ' · estoque ' + x.estoque + (x.tamanhos.length ? ' · ' + x.tamanhos.join('/') : '') + '</div></div></div><button class="btn peq" data-ed="' + x.id + '">Editar</button></div>';
      }).join('') : vazio('beer', 'Cadastre ao lado. Ele aparece na hora no PDV.')) + '</div>' +
      '<form class="card" id="f-prod"><h3 id="fp-t">Novo produto</h3><input type="hidden" name="id"><label>Nome</label><input name="nome" required><div class="linha2"><div><label>Preço (R$)</label><input name="preco" required inputmode="decimal"></div><div><label>Estoque</label><input name="estoque" type="number" min="0" value="0"></div></div>' +
      '<label>Descrição (opcional)</label><input name="descricao">' + (cat === 'loja' ? '<label>Tamanhos (separe por vírgula; vazio se não tiver)</label><input name="tamanhos" placeholder="P, M, G, GG"><label class="check"><input type="checkbox" name="compre_junto"> Mostrar no "Compre junto" ao comprar ingresso</label>' : '') +
      '<label>Estoque mínimo (aviso)</label><input name="estoque_minimo" type="number" min="0" value="5"><label>Foto</label><input type="file" name="foto" accept="image/*"><label class="check"><input type="checkbox" name="ativo" checked> Ativo</label>' +
      '<div class="acoes"><button class="btn prim">Salvar</button><button type="button" class="btn" id="fp-novo">Novo</button><button type="button" class="btn perigo" id="fp-del" style="display:none">Apagar</button></div></form></div>';
    var f = $('#f-prod');
    function preencher(x) {
      f.reset(); f.id.value = x ? x.id : ''; $('#fp-t').textContent = x ? 'Editar produto' : 'Novo produto'; $('#fp-del').style.display = x ? '' : 'none';
      if (!x) return;
      f.nome.value = x.nome; f.preco.value = (x.preco_centavos / 100).toFixed(2).replace('.', ','); f.estoque.value = x.estoque; f.descricao.value = x.descricao || '';
      f.estoque_minimo.value = x.estoque_minimo; f.ativo.checked = x.ativo;
      if (f.tamanhos) { f.tamanhos.value = x.tamanhos.join(', '); f.compre_junto.checked = x.compre_junto; }
    }
    $$('[data-ed]').forEach(function (b) { b.onclick = function () { preencher(ps.find(function (x) { return x.id === b.dataset.ed; })); }; });
    $('#fp-novo').onclick = function () { preencher(null); };
    $('#fp-del').onclick = async function () { if (!confirm('Apagar produto? Se já foi vendido, prefira desmarcar "Ativo".')) return; await q(sb.from('produtos').delete().eq('id', f.id.value)); rota(); };
    f.onsubmit = async function (e) {
      e.preventDefault(); var btn = f.querySelector('.prim'); Clic.carregando(btn, true);
      try {
        var d = { org_id: ORG.id, categoria: cat, nome: f.nome.value.trim(), preco_centavos: Clic.centavos(f.preco.value), estoque: parseInt(f.estoque.value, 10) || 0,
          descricao: f.descricao.value || null, estoque_minimo: parseInt(f.estoque_minimo.value, 10) || 0, ativo: f.ativo.checked };
        if (f.tamanhos) { d.tamanhos = f.tamanhos.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean); d.compre_junto = f.compre_junto.checked; }
        if (f.foto.files[0]) d.foto_url = await Clic.enviarImagem(ORG.id, f.foto.files[0], 'produtos');
        if (f.id.value) await q(sb.from('produtos').update(d).eq('id', f.id.value)); else await q(sb.from('produtos').insert(d));
        Clic.toast('Produto salvo'); rota();
      } catch (ex) { Clic.carregando(btn, false); }
    };
  };

  // ================================================================ ESTOQUE
  PAGINAS.estoque = async function () {
    titulo('Estoque');
    var r = await Promise.all([sb.from('produtos').select('*').eq('org_id', ORG.id).eq('ativo', true).order('nome'),
      sb.from('movimentos_estoque').select('*, produtos(nome)').eq('org_id', ORG.id).order('criado_em', { ascending: false }).limit(150)]);
    var ps = r[0].data || [], mv = r[1].data || [];
    var baixo = ps.filter(function (p) { return p.estoque <= p.estoque_minimo; });
    C.innerHTML = '<div class="duas"><div class="card"><h3>Movimentações</h3>' + (mv.length ? '<table class="t"><tr><th>Quando</th><th>Produto</th><th>Tipo</th><th>Qtd</th></tr>' + mv.map(function (m) {
      return '<tr><td class="small muted">' + Clic.data(m.criado_em) + '</td><td>' + esc(m.produtos ? m.produtos.nome : '') + '</td><td>' + m.tipo + '</td><td style="color:' + (m.quantidade < 0 ? 'var(--erro)' : 'var(--verde)') + '">' + (m.quantidade > 0 ? '+' : '') + m.quantidade + '</td></tr>';
    }).join('') + '</table>' : vazio('packages', 'Nenhuma movimentação ainda.')) + '</div><div>' +
      '<form class="card" id="f-aj" style="margin-bottom:16px"><h3>Ajustar estoque</h3>' + (ps.length ? '<label>Produto</label><select name="id">' + ps.map(function (p) { return '<option value="' + p.id + '">' + esc(p.nome) + ' (' + p.categoria + ') · atual ' + p.estoque + '</option>'; }).join('') + '</select>' +
        '<div class="linha2"><div><label>Operação</label><select name="op"><option value="+">Entrada (+)</option><option value="-">Saída / perda (−)</option><option value="=">Contagem (=)</option></select></div><div><label>Quantidade</label><input name="qtd" type="number" min="0" required></div></div><button class="btn prim" style="margin-top:14px">Aplicar</button>' : '<p class="muted">Cadastre produtos primeiro.</p>') + '</form>' +
      '<div class="card"><h3>Estoque baixo</h3>' + (baixo.length ? baixo.map(function (p) { return '<div class="lista-item"><span>' + esc(p.nome) + '</span><span class="pill vermelho">' + p.estoque + '</span></div>'; }).join('') : '<p class="ok">Tudo certo por aqui.</p>') + '</div></div></div>';
    if (ps.length) $('#f-aj').onsubmit = async function (e) {
      e.preventDefault(); var p = ps.find(function (x) { return x.id === this.id.value; }.bind(this)), n = parseInt(this.qtd.value, 10) || 0;
      var novo = this.op.value === '+' ? p.estoque + n : this.op.value === '-' ? Math.max(0, p.estoque - n) : n;
      await q(sb.from('produtos').update({ estoque: novo }).eq('id', p.id)); Clic.toast('Estoque ajustado'); rota();
    };
  };

  // ================================================================ ESPAÇOS E LOCAÇÕES
  PAGINAS.locacoes = async function (p) {
    titulo('Espaços e locações');
    var aba = p[0] || 'pedidos';
    var abas = '<div class="abas"><a href="#locacoes/pedidos" class="' + (aba === 'pedidos' ? 'on' : '') + '">Pedidos de locação</a><a href="#locacoes/espacos" class="' + (aba === 'espacos' ? 'on' : '') + '">Espaços</a></div>';
    if (aba === 'pedidos') {
      var pl = await q(sb.from('pedidos_locacao').select('*, espacos(nome)').eq('org_id', ORG.id).order('criado_em', { ascending: false }));
      C.innerHTML = abas + '<div class="card">' + (pl.length ? pl.map(function (x) {
        return '<div class="lista-item" style="align-items:flex-start"><div><b>' + esc(x.nome) + '</b> · ' + esc(x.espacos ? x.espacos.nome : 'qualquer espaço') + '<div class="small muted">' + (x.data_desejada || 'sem data') + ' · ' + (x.convidados || '?') + ' convidados · ' + esc(x.whatsapp || '') + ' ' + esc(x.email || '') + '</div><div class="small">' + esc(x.mensagem || '') + '</div></div>' +
          '<div class="acoes">' + (x.whatsapp ? '<a class="btn peq" target="_blank" href="https://wa.me/55' + x.whatsapp + '"><i class="ti ti-brand-whatsapp"></i></a>' : '') + '<select data-sit="' + x.id + '" style="width:140px">' + ['novo', 'em_conversa', 'fechado', 'recusado'].map(function (s) { return '<option value="' + s + '"' + (s === x.situacao ? ' selected' : '') + '>' + s.replace('_', ' ') + '</option>'; }).join('') + '</select></div></div>';
      }).join('') : vazio('building', 'Os pedidos feitos na página Locações do site aparecem aqui.')) + '</div>';
      $$('[data-sit]').forEach(function (s) { s.onchange = async function () { await q(sb.from('pedidos_locacao').update({ situacao: s.value }).eq('id', s.dataset.sit)); Clic.toast('Atualizado'); }; });
      return;
    }
    var es = await q(sb.from('espacos').select('*').eq('org_id', ORG.id).order('nome'));
    C.innerHTML = abas + '<div class="duas"><div class="card">' + (es.length ? es.map(function (x) {
      return '<div class="lista-item"><div style="display:flex;gap:10px;align-items:center">' + (x.foto_url ? '<img class="mini" src="' + esc(x.foto_url) + '">' : '<div class="mini"></div>') + '<div><b>' + esc(x.nome) + '</b><div class="small muted">' + esc(x.cidade || '') + ' · ' + (x.capacidade || '?') + ' pessoas' + (x.valor_base_centavos ? ' · a partir de ' + money(x.valor_base_centavos) : '') + '</div></div></div><button class="btn peq" data-ed="' + x.id + '">Editar</button></div>';
    }).join('') : vazio('building', 'Espaços ativos aparecem na página Locações do site e podem ser o local dos eventos.')) + '</div>' +
      '<form class="card" id="f-esp"><h3>Espaço</h3><input type="hidden" name="id"><label>Nome</label><input name="nome" required><label>Endereço</label><input name="endereco"><div class="linha2"><div><label>Cidade</label><input name="cidade"></div><div><label>Capacidade</label><input name="capacidade" type="number" min="0"></div></div>' +
      '<label>Valor base de locação (R$)</label><input name="valor" inputmode="decimal"><label>Descrição</label><textarea name="descricao"></textarea><label>Foto</label><input type="file" name="foto" accept="image/*"><label class="check"><input type="checkbox" name="ativo" checked> Ativo</label>' +
      '<div class="acoes"><button class="btn prim">Salvar</button><button type="button" class="btn" onclick="this.form.reset();this.form.id.value=\'\'">Novo</button></div></form></div>';
    var f = $('#f-esp');
    $$('[data-ed]').forEach(function (b) { b.onclick = function () { var x = es.find(function (e) { return e.id === b.dataset.ed; }); f.id.value = x.id; f.nome.value = x.nome; f.endereco.value = x.endereco || ''; f.cidade.value = x.cidade || ''; f.capacidade.value = x.capacidade || ''; f.valor.value = x.valor_base_centavos ? (x.valor_base_centavos / 100).toFixed(2).replace('.', ',') : ''; f.descricao.value = x.descricao || ''; f.ativo.checked = x.ativo; }; });
    f.onsubmit = async function (e) {
      e.preventDefault();
      var d = { org_id: ORG.id, nome: f.nome.value, endereco: f.endereco.value || null, cidade: f.cidade.value || null, capacidade: parseInt(f.capacidade.value, 10) || null,
        valor_base_centavos: f.valor.value ? Clic.centavos(f.valor.value) : null, descricao: f.descricao.value || null, ativo: f.ativo.checked };
      if (f.foto.files[0]) d.foto_url = await Clic.enviarImagem(ORG.id, f.foto.files[0], 'espacos');
      if (f.id.value) await q(sb.from('espacos').update(d).eq('id', f.id.value)); else await q(sb.from('espacos').insert(d));
      Clic.toast('Espaço salvo'); rota();
    };
  };

  // ================================================================ CONTATOS
  PAGINAS.contatos = async function () {
    titulo('Contatos');
    var r = await Promise.all([sb.from('contatos').select('*').eq('org_id', ORG.id).order('criado_em', { ascending: false }),
      sb.from('pedidos').select('cliente_nome,cliente_email,cliente_whatsapp,pago_em').eq('org_id', ORG.id).eq('situacao', 'pago').limit(5000)]);
    var ct = r[0].data || [], comp = {};
    (r[1].data || []).forEach(function (p) { var k = p.cliente_email || p.cliente_whatsapp; if (k && !comp[k]) comp[k] = p; });
    var compradores = Object.keys(comp).map(function (k) { return comp[k]; });
    C.innerHTML = '<div class="grid g2" style="margin-bottom:16px"><div class="metric"><span>Cadastros de novidades</span><b>' + ct.length + '</b><span>formulário do site</span></div><div class="metric" style="border-left-color:var(--verde)"><span>Compradores</span><b>' + compradores.length + '</b><span>pedidos pagos</span></div></div>' +
      '<div class="card"><div class="acoes" style="margin-bottom:10px"><button class="btn" id="b1"><i class="ti ti-download"></i> Baixar novidades (CSV)</button><button class="btn" id="b2"><i class="ti ti-download"></i> Baixar compradores (CSV)</button></div>' +
      (ct.length ? '<table class="t"><tr><th>Nome</th><th>E-mail</th><th>Quando</th></tr>' + ct.slice(0, 200).map(function (c) { return '<tr><td>' + esc(c.nome || '') + '</td><td>' + esc(c.email) + '</td><td class="small muted">' + Clic.data(c.criado_em) + '</td></tr>'; }).join('') + '</table>' : vazio('address-book', 'Nenhum cadastro ainda. Ative a seção "Cadastro de e-mail" em Site e identidade.')) + '</div>';
    $('#b1').onclick = function () { csv('novidades.csv', [['Nome', 'E-mail', 'Data']].concat(ct.map(function (c) { return [c.nome, c.email, Clic.data(c.criado_em)]; }))); };
    $('#b2').onclick = function () { csv('compradores.csv', [['Nome', 'E-mail', 'WhatsApp', 'Última compra']].concat(compradores.map(function (c) { return [c.cliente_nome, c.cliente_email, c.cliente_whatsapp, Clic.data(c.pago_em)]; }))); };
  };

  // ================================================================ FINANCEIRO
  PAGINAS.financeiro = async function () {
    titulo('Financeiro e caixas');
    var f = JSON.parse(sessionStorage.getItem('fin_f') || 'null') || { de: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), ate: new Date().toISOString().slice(0, 10) };
    var de = new Date(f.de + 'T00:00').toISOString(), ate = new Date(f.ate + 'T23:59:59').toISOString();
    var r = await Promise.all([
      sb.from('pedidos').select('id,total_centavos,subtotal_centavos,comissao_centavos,forma,situacao,canal,pago_em,cancelado_em').eq('org_id', ORG.id).gte('criado_em', de).lte('criado_em', ate).limit(10000),
      sb.from('itens_pedido').select('quantidade,preco_unit_centavos,lote_id,produto_id,lotes(area),produtos(categoria),pedidos!inner(situacao,criado_em,org_id)').eq('org_id', ORG.id).eq('pedidos.situacao', 'pago').gte('pedidos.criado_em', de).lte('pedidos.criado_em', ate).limit(20000),
      sb.from('caixas').select('*').eq('org_id', ORG.id).gte('aberto_em', de).lte('aberto_em', ate).order('aberto_em', { ascending: false })
    ]);
    var ps = r[0].data || [], itens = r[1].data || [], cx = r[2].data || [];
    var pagos = ps.filter(function (p) { return p.situacao === 'pago'; }), canc = ps.filter(function (p) { return ['cancelado', 'estornado'].indexOf(p.situacao) >= 0; });
    var rec = pagos.reduce(function (a, p) { return a + p.total_centavos; }, 0), com = pagos.reduce(function (a, p) { return a + p.comissao_centavos; }, 0);
    var porForma = {}, porArea = {};
    pagos.forEach(function (p) { porForma[p.forma] = (porForma[p.forma] || 0) + p.total_centavos; });
    itens.forEach(function (i) { var k = i.lote_id ? 'Ingressos · ' + ((i.lotes && i.lotes.area) || 'geral') : (i.produtos ? i.produtos.categoria : 'outros'); porArea[k] = (porArea[k] || 0) + i.quantidade * i.preco_unit_centavos; });
    function tabela(o) { var ks = Object.keys(o); return ks.length ? ks.sort(function (a, b) { return o[b] - o[a]; }).map(function (k) { return '<div class="lista-item"><span>' + esc(FORMA[k] || k) + '</span><b>' + money(o[k]) + '</b></div>'; }).join('') : '<p class="muted">Sem vendas no período.</p>'; }
    C.innerHTML = '<form class="card" id="f-per" style="display:flex;gap:8px;align-items:end;margin-bottom:16px;flex-wrap:wrap"><div><label>De</label><input type="date" name="de" value="' + f.de + '"></div><div><label>Até</label><input type="date" name="ate" value="' + f.ate + '"></div><button class="btn prim">Aplicar período</button></form>' +
      '<div class="grid g4" style="margin-bottom:16px"><div class="metric"><span>Receita no período</span><b>' + money(rec) + '</b><span>' + pagos.length + ' pedidos pagos</span></div>' +
      '<div class="metric" style="border-left-color:var(--verde)"><span>Ticket médio</span><b>' + money(pagos.length ? Math.round(rec / pagos.length) : 0) + '</b></div>' +
      '<div class="metric" style="border-left-color:var(--erro)"><span>Cancelamentos</span><b>' + money(canc.reduce(function (a, p) { return a + p.total_centavos; }, 0)) + '</b><span>' + canc.length + ' pedido(s)</span></div>' +
      '<div class="metric" style="border-left-color:var(--amarelo)"><span>Taxa da plataforma</span><b>' + money(com) + '</b></div></div>' +
      '<div class="grid g2" style="margin-bottom:16px"><div class="card"><h3>Por forma de pagamento</h3>' + tabela(porForma) + '</div><div class="card"><h3>Por área</h3>' + tabela(porArea) + '</div></div>' +
      '<div class="card"><h3>Caixas do PDV</h3>' + (cx.length ? '<table class="t"><tr><th>Área</th><th>Aberto</th><th>Fundo</th><th>Esperado</th><th>Contado</th><th>Diferença</th></tr>' + cx.map(function (c) {
        return '<tr><td>' + c.area + '</td><td class="small">' + Clic.data(c.aberto_em) + (c.situacao === 'aberto' ? ' <span class="pill verde">aberto</span>' : '') + '</td><td>' + money(c.fundo_troco_centavos) + '</td><td>' + (c.esperado_centavos != null ? money(c.esperado_centavos) : '—') + '</td><td>' + (c.contado_centavos != null ? money(c.contado_centavos) : '—') + '</td><td style="color:' + ((c.diferenca_centavos || 0) < 0 ? 'var(--erro)' : 'inherit') + '">' + (c.diferenca_centavos != null ? money(c.diferenca_centavos) : '—') + '</td></tr>';
      }).join('') + '</table>' : '<p class="muted">Nenhum caixa no período.</p>') + '</div>';
    $('#f-per').onsubmit = function (e) { e.preventDefault(); sessionStorage.setItem('fin_f', JSON.stringify(form(this))); rota(); };
  };

  // ================================================================ REPASSES
  PAGINAS.repasses = async function () {
    titulo('Repasses Clic');
    var r = await Promise.all([sb.from('lancamentos_repasse').select('*, pedidos(codigo,forma,canal)').eq('org_id', ORG.id).order('criado_em', { ascending: false }).limit(1000),
      sb.from('repasses').select('*').eq('org_id', ORG.id).order('criado_em', { ascending: false }),
      sb.from('pedidos').select('comissao_centavos,pago_em').eq('org_id', ORG.id).eq('situacao', 'pago').eq('com_split', true).limit(10000)]);
    var ls = r[0].data || [], rp = r[1].data || [], split = r[2].data || [];
    var abertos = ls.filter(function (l) { return !l.pago; }), hoje = new Date().toISOString().slice(0, 10);
    var vencidos = abertos.filter(function (l) { return l.vencimento <= hoje; }), devedor = abertos.reduce(function (a, l) { return a + l.taxa_centavos; }, 0);
    var semanas = {}; abertos.forEach(function (l) { (semanas[l.semana_inicio] = semanas[l.semana_inicio] || { v: 0, venc: l.vencimento, n: 0 }); semanas[l.semana_inicio].v += l.taxa_centavos; semanas[l.semana_inicio].n++; });
    var mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
    C.innerHTML = '<div class="grid g4" style="margin-bottom:16px"><div class="metric" style="border-left-color:var(--verde)"><span>Pago automático (split)</span><b>' + money(split.filter(function (p) { return new Date(p.pago_em) >= mes; }).reduce(function (a, p) { return a + p.comissao_centavos; }, 0)) + '</b><span>neste mês</span></div>' +
      '<div class="metric" style="border-left-color:var(--erro)"><span>Vencido / vence agora</span><b>' + money(vencidos.reduce(function (a, l) { return a + l.taxa_centavos; }, 0)) + '</b></div>' +
      '<div class="metric"><span>Saldo devedor total</span><b>' + money(devedor) + '</b><span>inclui a semana atual</span></div>' +
      '<div class="metric" style="border-left-color:var(--amarelo)"><span>Já pago por Pix</span><b>' + money(rp.filter(function (x) { return x.situacao === 'pago'; }).reduce(function (a, x) { return a + x.valor_centavos; }, 0)) + '</b></div></div>' +
      '<div class="duas"><div class="card"><h3>Por semana (vendas sem split)</h3><p class="small muted">Vendas no balcão (dinheiro, Pix ou cartão direto, maquininha) e pedidos confirmados à mão geram a taxa de ' + ORG.comissao_pct + '%. A semana vai de segunda a domingo e vence na quarta seguinte.</p>' +
      (Object.keys(semanas).length ? Object.keys(semanas).sort().map(function (s) { return '<div class="lista-item"><div>Semana de ' + s.split('-').reverse().join('/') + '<div class="small muted">' + semanas[s].n + ' venda(s) · vence ' + semanas[s].venc.split('-').reverse().join('/') + '</div></div><b>' + money(semanas[s].v) + '</b></div>'; }).join('') : '<p class="ok">Nada em aberto.</p>') + '</div>' +
      '<div class="card"><h3>Pagar à Clic</h3>' + (devedor ? '<p>Gere o Pix e pague no app do banco. A baixa é automática.</p><button class="btn prim" id="gerar-pix">Gerar Pix de ' + money(vencidos.reduce(function (a, l) { return a + l.taxa_centavos; }, 0) || devedor) + '</button><div id="pix-res"></div>' : '<p class="ok">Em dia ✓</p>') +
      '<h3 style="margin-top:16px">Histórico</h3>' + (rp.length ? rp.map(function (x) { return '<div class="lista-item"><span>' + Clic.data(x.criado_em) + '</span><span>' + money(x.valor_centavos) + ' ' + pill(x.situacao === 'pago' ? 'pago' : 'aguardando') + '</span></div>'; }).join('') : '<p class="muted">Nenhum Pix gerado ainda.</p>') + '</div></div>';
    if ($('#gerar-pix')) $('#gerar-pix').onclick = async function () {
      var r2 = await sb.functions.invoke('repasse-pix', { body: { org_id: ORG.id } });
      $('#pix-res').innerHTML = r2.error ? '<p class="erro">O Pix de repasse ainda não foi ativado. Fale com a Clic.</p>' : '<div class="link-box" style="margin-top:10px"><span style="flex:1">' + esc(r2.data.copia_cola) + '</span><button class="btn peq" onclick="navigator.clipboard.writeText(\'' + esc(r2.data.copia_cola) + '\')">Copiar</button></div>';
    };
  };

  // ================================================================ EQUIPE
  PAGINAS.equipe = async function () {
    titulo('Equipe');
    var ms = await q(sb.from('membros').select('*').eq('org_id', ORG.id).order('criado_em'));
    var AREAS = ['bilheteria', 'bar', 'cozinha', 'loja'], FUN = { admin: 'Administrador', gestor: 'Gestor', operador: 'Operador de PDV' };
    C.innerHTML = '<div class="duas"><div class="card"><h3>Equipe · ' + ms.length + ' pessoa(s)</h3>' + ms.map(function (m) {
      var eu = m.user_id === EU.id;
      return '<form class="lista-item" data-m="' + m.id + '" style="flex-wrap:wrap;align-items:flex-start"><div style="flex:1;min-width:200px"><b>' + esc(m.nome) + (eu ? ' (você)' : '') + '</b><div class="small muted">' + esc(m.email) + '</div>' +
        '<div style="margin-top:6px">' + AREAS.map(function (a) { return '<label class="check" style="display:inline-flex;margin:4px 10px 0 0"><input type="checkbox" name="areas" value="' + a + '"' + (m.areas.indexOf(a) >= 0 ? ' checked' : '') + (eu ? ' disabled' : '') + '> ' + a + '</label>'; }).join('') + '</div></div>' +
        '<div class="acoes"><select name="funcao"' + (eu ? ' disabled' : '') + '>' + Object.keys(FUN).map(function (f) { return '<option value="' + f + '"' + (f === m.funcao ? ' selected' : '') + '>' + FUN[f] + '</option>'; }).join('') + '</select>' +
        (eu ? '' : '<label class="check" style="margin:0"><input type="checkbox" name="ativo"' + (m.ativo ? ' checked' : '') + '> ativo</label><button class="btn peq">Salvar</button><button type="button" class="btn peq" data-senha="' + m.id + '" data-nome="' + esc(m.nome) + '"><i class="ti ti-key"></i> Trocar senha</button>') + '</div></form>';
    }).join('') + '<p class="small muted" style="margin-top:10px"><b>Administrador:</b> tudo, inclusive equipe e pagamentos. <b>Gestor:</b> eventos, vendas, produtos, portarias e site. <b>Operador:</b> só o PDV das áreas marcadas.</p></div>' +
      '<form class="card" id="f-conv"><h3>Adicionar membro</h3><label>Nome</label><input name="nome" required><label>E-mail de acesso</label><input name="email" type="email" required><label>Telefone</label><input name="telefone"><label>Função</label><select name="funcao"><option value="operador">Operador de PDV</option><option value="gestor">Gestor</option><option value="admin">Administrador</option></select>' +
      '<label>Senha inicial (mínimo 8 caracteres)</label><div style="display:flex;gap:6px"><input name="senha" required minlength="8" maxlength="72" autocomplete="new-password" style="flex:1"><button type="button" class="btn peq" id="gerar-senha"><i class="ti ti-refresh"></i> Gerar</button></div>' +
      '<label>Áreas que pode vender</label>' + AREAS.map(function (a) { return '<label class="check" style="display:inline-flex;margin:4px 10px 0 0"><input type="checkbox" name="areas" value="' + a + '"> ' + a + '</label>'; }).join('') +
      '<button class="btn prim" style="margin-top:14px">Adicionar à equipe</button><p class="small muted" style="margin-top:8px">Passe o e-mail e a senha para a pessoa. Ela entra em <b>clicreservas.com.br</b> › Entrar. Operador de PDV cai direto no PDV.</p><div id="conv-res"></div></form></div>';
    $$('[data-m]').forEach(function (fm) {
      fm.onsubmit = async function (e) {
        e.preventDefault();
        await q(sb.from('membros').update({ funcao: fm.funcao.value, ativo: fm.ativo.checked, areas: $$('input[name=areas]:checked', fm).map(function (i) { return i.value; }) }).eq('id', fm.dataset.m));
        Clic.toast('Salvo');
      };
    });
    $('#f-conv').onsubmit = async function (e) {
      e.preventDefault(); var f = this, btn = f.querySelector('.prim'); Clic.carregando(btn, true, 'Enviando…');
      var dados = { org_id: ORG.id, acao: 'criar', nome: f.nome.value, email: f.email.value.trim(), telefone: f.telefone.value, funcao: f.funcao.value, senha: f.senha.value, areas: $$('input[name=areas]:checked', f).map(function (i) { return i.value; }) };
      var r = await chamarFuncao('convidar-membro', dados);
      Clic.carregando(btn, false);
      if (r.erro) return Clic.toast(r.erro, true);
      Clic.toast('Adicionado à equipe');
      modal('<h3>' + esc(dados.nome) + ' já faz parte da equipe</h3>' + (r.data.ja_tinha_login
        ? '<p>Este e-mail já tinha login no Clic. A pessoa entra com a senha que já usa.</p>'
        : '<p>Envie estes dados para a pessoa:</p><div class="link-box" style="display:block;line-height:1.7">Site: clicreservas.com.br › Entrar<br>E-mail: <b>' + esc(dados.email) + '</b><br>Senha: <b>' + esc(dados.senha) + '</b></div>') +
        '<button class="btn prim full" data-fechar style="margin-top:14px">Ok</button>');
      rota();
    };
    $('#gerar-senha').onclick = function () { $('#f-conv').senha.value = senhaAleatoria(); };
    $$('[data-senha]').forEach(function (b) {
      b.onclick = function () {
        modal('<h3>Nova senha para ' + esc(b.dataset.nome) + '</h3><form id="f-ts"><label>Nova senha (mínimo 8 caracteres)</label><div style="display:flex;gap:6px"><input name="senha" required minlength="8" maxlength="72" value="' + senhaAleatoria() + '" style="flex:1"></div><div class="acoes" style="margin-top:14px"><button class="btn prim">Salvar nova senha</button><button type="button" class="btn" data-fechar>Cancelar</button></div></form>', function (m) {
          m.querySelector('#f-ts').onsubmit = async function (e) {
            e.preventDefault(); var bt = this.querySelector('.prim'); Clic.carregando(bt, true, 'Salvando…');
            var r = await chamarFuncao('convidar-membro', { org_id: ORG.id, acao: 'senha', membro_id: b.dataset.senha, senha: this.senha.value });
            Clic.carregando(bt, false);
            if (r.erro) return Clic.toast(r.erro, true);
            Clic.toast('Senha trocada. Passe a nova senha para a pessoa.'); m.remove();
          };
        });
      };
    });
  };


  // ================================================================ PROMOTERS
  var TIPO_COM = { percentual: '% do valor vendido', por_ingresso: 'R$ por ingresso vendido', por_entrada: 'R$ por pessoa que entrou', nenhuma: 'Sem comissão' };
  function textoComissao(p) {
    if (p.comissao_tipo === 'percentual') return Number(p.comissao_pct).toLocaleString('pt-BR') + '% das vendas';
    if (p.comissao_tipo === 'por_ingresso') return money(p.comissao_fixa_centavos) + ' por ingresso';
    if (p.comissao_tipo === 'por_entrada') return money(p.comissao_fixa_centavos) + ' por entrada';
    return 'sem comissão';
  }
  PAGINAS.promoters = async function () {
    titulo('Promoters');
    var evs = await q(sb.from('eventos').select('id,nome,inicio').eq('org_id', ORG.id).order('inicio', { ascending: false }).limit(60));
    var filtro = sessionStorage.getItem('clic_prom_ev') || '';
    var lista = await q(sb.rpc('relatorio_promoters', { p_org: ORG.id, p_evento: filtro || null }));
    var ativos = lista.filter(function (p) { return p.ativo; });
    var aPagar = lista.reduce(function (a, p) { return a + Math.max(p.total.comissao_centavos - p.pago_centavos, 0); }, 0);
    C.innerHTML = '<div class="grid g4" style="margin-bottom:16px"><div class="metric"><span>Promoters ativos</span><b>' + ativos.length + '</b></div>' +
      '<div class="metric"><span>Ingressos vendidos' + (filtro ? ' no evento' : '') + '</span><b>' + lista.reduce(function (a, p) { return a + p.ingressos; }, 0) + '</b></div>' +
      '<div class="metric"><span>Entradas pela lista' + (filtro ? ' no evento' : '') + '</span><b>' + lista.reduce(function (a, p) { return a + p.lista_entraram; }, 0) + '</b></div>' +
      '<div class="metric"><span>Comissões a pagar</span><b>' + money(aPagar) + '</b></div></div>' +
      '<div class="duas"><div class="card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><h3 style="margin:0">Promoters</h3>' +
      '<select id="f-ev" style="max-width:260px"><option value="">Todos os eventos</option>' + evs.map(function (e) { return '<option value="' + e.id + '"' + (e.id === filtro ? ' selected' : '') + '>' + esc(e.nome) + ' · ' + new Date(e.inicio).toLocaleDateString('pt-BR') + '</option>'; }).join('') + '</select></div>' +
      (lista.length ? lista.map(function (p) {
        var saldo = Math.max(p.total.comissao_centavos - p.pago_centavos, 0);
        return '<div class="lista-item" style="flex-wrap:wrap;align-items:flex-start' + (p.ativo ? '' : ';opacity:.5') + '"><div style="flex:1;min-width:220px"><b>' + esc(p.nome) + '</b> <span class="pill cinza">' + esc(p.codigo.toUpperCase()) + '</span>' + (p.ativo ? '' : ' <span class="pill cinza">inativo</span>') +
          '<div class="small muted">' + esc(textoComissao(p)) + (p.desconto_pct > 0 ? ' · cupom dá ' + Number(p.desconto_pct).toLocaleString('pt-BR') + '% off' : '') + (p.pode_lista ? ' · lista liberada' + (p.limite_lista ? ' (' + p.limite_lista + ' por evento)' : '') : '') + '</div>' +
          '<div class="small" style="margin-top:4px">' + p.ingressos + ' ingresso(s) · ' + money(p.valor_centavos) + ' · entraram ' + p.entraram + ' · lista ' + p.lista_entraram + '/' + p.lista_pessoas + ' · comissão <b>' + money(p.comissao_centavos) + '</b></div>' +
          '<div class="small muted">Total: ' + money(p.total.comissao_centavos) + ' · pago ' + money(p.pago_centavos) + ' · <b class="laranja">a pagar ' + money(saldo) + '</b></div></div>' +
          '<div class="acoes"><button class="btn peq" data-link="' + p.id + '"><i class="ti ti-share"></i> Links</button><button class="btn peq" data-ed="' + p.id + '"><i class="ti ti-pencil"></i> Editar</button>' + (admin() && saldo ? '<button class="btn peq prim" data-pg="' + p.id + '"><i class="ti ti-cash"></i> Pagar</button>' : '') + '</div></div>';
      }).join('') : vazio('speakerphone', 'Nenhum promoter ainda. Cadastre ao lado.')) + '</div>' +
      '<form class="card" id="f-promo-p"></form></div>';
    $('#f-ev').onchange = function () { sessionStorage.setItem('clic_prom_ev', this.value); rota(); };
    function formulario(p) {
      var f = $('#f-promo-p'); p = p || { comissao_tipo: 'percentual', comissao_pct: 10, comissao_fixa_centavos: 0, desconto_pct: 0, pode_lista: true, ativo: true };
      f.innerHTML = '<h3>' + (p.id ? 'Editar ' + esc(p.nome) : 'Novo promoter') + '</h3><label>Nome</label><input name="nome" required value="' + esc(p.nome || '') + '">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>WhatsApp</label><input name="whatsapp" inputmode="tel" value="' + esc(p.whatsapp || '') + '"></div><div><label>Chave Pix (para pagar a comissão)</label><input name="pix" value="' + esc(p.pix || '') + '"></div></div>' +
        '<label>Código do link e do cupom</label><input name="codigo" required pattern="[a-zA-Z0-9][a-zA-Z0-9-]{1,29}" value="' + esc(p.codigo || '') + '" placeholder="ex.: fabi" style="text-transform:lowercase"><div class="small muted">Link: clicreservas.com.br/' + esc(ORG.slug) + '?p=<b id="cod-prev">' + esc(p.codigo || 'codigo') + '</b></div>' +
        '<label>Como ganha comissão</label><select name="tipo">' + Object.keys(TIPO_COM).map(function (k) { return '<option value="' + k + '"' + (k === p.comissao_tipo ? ' selected' : '') + '>' + TIPO_COM[k] + '</option>'; }).join('') + '</select>' +
        '<div id="c-pct"><label>Percentual (%)</label><input name="pct" inputmode="decimal" value="' + String(p.comissao_pct).replace('.', ',') + '"></div><div id="c-fixo"><label>Valor (R$)</label><input name="fixo" inputmode="decimal" value="' + (p.comissao_fixa_centavos / 100).toFixed(2).replace('.', ',') + '"></div>' +
        '<label>Desconto do cupom para o cliente (%)</label><input name="desc" inputmode="decimal" value="' + String(p.desconto_pct).replace('.', ',') + '"><div class="small muted">0 = o código só marca a venda, sem desconto.</div>' +
        '<label class="check" style="margin-top:10px"><input type="checkbox" name="lista"' + (p.pode_lista ? ' checked' : '') + '> Pode colocar nomes na lista</label><label>Limite de pessoas na lista por evento (vazio = sem limite)</label><input name="limite" type="number" min="1" value="' + (p.limite_lista || '') + '">' +
        (p.id ? '<label class="check" style="margin-top:10px"><input type="checkbox" name="ativo"' + (p.ativo ? ' checked' : '') + '> Ativo (desmarque para desligar link, cupom e lista)</label>' : '') +
        '<div class="acoes" style="margin-top:14px"><button class="btn prim">' + (p.id ? 'Salvar' : 'Cadastrar promoter') + '</button>' + (p.id ? '<button type="button" class="btn" id="p-novo">Cancelar</button>' : '') + '</div>';
      function tipo() { var t = f.tipo.value; $('#c-pct').style.display = t === 'percentual' ? '' : 'none'; $('#c-fixo').style.display = (t === 'por_ingresso' || t === 'por_entrada') ? '' : 'none'; }
      f.tipo.onchange = tipo; tipo();
      f.codigo.oninput = function () { $('#cod-prev').textContent = this.value.toLowerCase() || 'codigo'; };
      if ($('#p-novo')) $('#p-novo').onclick = function () { formulario(); };
      f.onsubmit = async function (e) {
        e.preventDefault();
        var num = function (v) { return parseFloat(String(v || '0').replace(',', '.')) || 0; };
        var d = { org_id: ORG.id, nome: f.nome.value.trim(), whatsapp: f.whatsapp.value.replace(/\D/g, '') || null, pix: f.pix.value.trim() || null,
          codigo: f.codigo.value.trim().toLowerCase(), comissao_tipo: f.tipo.value, comissao_pct: num(f.pct.value), comissao_fixa_centavos: Clic.centavos(f.fixo.value || '0'),
          desconto_pct: num(f.desc.value), pode_lista: f.lista.checked, limite_lista: parseInt(f.limite.value, 10) || null };
        if (p.id) d.ativo = f.ativo.checked;
        var r = p.id ? await sb.from('promoters').update(d).eq('id', p.id) : await sb.from('promoters').insert(d);
        if (r.error) return Clic.toast(/duplicate|unique/i.test(r.error.message) ? 'Este código já é usado por outro promoter.' : /check/i.test(r.error.message) ? 'Confira o código (só letras, números e hífen) e os percentuais.' : Clic.erro(r.error), true);
        Clic.toast(p.id ? 'Promoter salvo' : 'Promoter cadastrado'); rota();
      };
    }
    formulario();
    $$('[data-ed]').forEach(function (b) { b.onclick = function () { formulario(lista.find(function (x) { return x.id === b.dataset.ed; })); $('#f-promo-p').scrollIntoView({ behavior: 'smooth' }); }; });
    $$('[data-link]').forEach(function (b) {
      b.onclick = function () {
        var p = lista.find(function (x) { return x.id === b.dataset.link; });
        var venda = 'https://clicreservas.com.br/' + ORG.slug + '?p=' + p.codigo, area = 'https://clicreservas.com.br/promoter/?t=' + p.token_acesso;
        var msg = 'Olá, ' + p.nome.split(' ')[0] + '! Seus links da ' + ORG.nome + ':\n\nLink de vendas (divulgue): ' + venda + '\nCupom: ' + p.codigo.toUpperCase() + '\n\nSua área de promoter (lista e comissões, não compartilhe): ' + area;
        modal('<h3>Links de ' + esc(p.nome) + '</h3><label>Link de vendas (para divulgar)</label><div class="link-box"><span style="flex:1">' + esc(venda) + '</span></div>' +
          '<label>Área do promoter (lista e comissões, só para ele)</label><div class="link-box"><span style="flex:1">' + esc(area) + '</span></div>' +
          '<div class="acoes" style="margin-top:14px">' + (p.whatsapp ? '<a class="btn prim" target="_blank" href="https://wa.me/55' + esc(p.whatsapp) + '?text=' + encodeURIComponent(msg) + '"><i class="ti ti-brand-whatsapp"></i> Enviar para ' + esc(p.nome.split(' ')[0]) + '</a>' : '') +
          '<button class="btn" id="cp-msg"><i class="ti ti-copy"></i> Copiar mensagem</button><button class="btn" id="novo-tok"><i class="ti ti-refresh"></i> Gerar novo link da área</button><button class="btn" data-fechar>Fechar</button></div>' +
          '<p class="small muted" style="margin-top:10px">"Gerar novo link" desliga o link antigo da área (use se o promoter perder o celular ou sair).</p>', function (m) {
          m.querySelector('#cp-msg').onclick = function () { navigator.clipboard.writeText(msg).then(function () { Clic.toast('Mensagem copiada'); }); };
          m.querySelector('#novo-tok').onclick = async function () {
            if (!confirm('Desligar o link atual da área do promoter e gerar outro?')) return;
            var t = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
            await q(sb.from('promoters').update({ token_acesso: t }).eq('id', p.id)); m.remove(); Clic.toast('Novo link gerado'); rota();
          };
        });
      };
    });
    $$('[data-pg]').forEach(function (b) {
      b.onclick = function () {
        var p = lista.find(function (x) { return x.id === b.dataset.pg; }), saldo = Math.max(p.total.comissao_centavos - p.pago_centavos, 0);
        modal('<h3>Pagar comissão de ' + esc(p.nome) + '</h3><p>Saldo a pagar: <b>' + money(saldo) + '</b>' + (p.pix ? '<br>Pix: <b>' + esc(p.pix) + '</b>' : '') + '</p><form id="f-pg"><label>Valor pago (R$)</label><input name="v" inputmode="decimal" required value="' + (saldo / 100).toFixed(2).replace('.', ',') + '"><label>Observação</label><input name="obs" placeholder="ex.: Pix dia 20/11"><div class="acoes" style="margin-top:14px"><button class="btn prim">Registrar pagamento</button><button type="button" class="btn" data-fechar>Cancelar</button></div></form>', function (m) {
          m.querySelector('#f-pg').onsubmit = async function (e) {
            e.preventDefault(); var v = Clic.centavos(this.v.value);
            if (!(v > 0)) return Clic.toast('Informe o valor', true);
            await q(sb.from('promoter_pagamentos').insert({ org_id: ORG.id, promoter_id: p.id, valor_centavos: v, observacao: this.obs.value || null }));
            m.remove(); Clic.toast('Pagamento registrado'); rota();
          };
        });
      };
    });
  };

  // ================================================================ LISTA DE NOMES
  PAGINAS.lista = async function () {
    titulo('Lista de nomes');
    var evs = await q(sb.from('eventos').select('id,nome,inicio,lista_ativa,lista_fecha_em').eq('org_id', ORG.id).order('inicio', { ascending: false }).limit(60));
    if (!evs.length) { C.innerHTML = vazio('list-check', 'Crie um evento primeiro.'); return; }
    var agora = Date.now(), padrao = evs.slice().reverse().find(function (e) { return new Date(e.inicio) > agora - 12 * 36e5; }) || evs[0];
    var evId = sessionStorage.getItem('clic_lista_ev') || padrao.id, ev = evs.find(function (e) { return e.id === evId; }) || padrao;
    var r = await Promise.all([
      sb.from('lista_nomes').select('*, promoters(nome)').eq('evento_id', ev.id).order('nome').limit(3000),
      sb.from('promoters').select('id,nome').eq('org_id', ORG.id).eq('ativo', true).order('nome')
    ]);
    var nomes = r[0].data || [], proms = r[1].data || [];
    var pessoas = nomes.reduce(function (a, l) { return a + l.pessoas; }, 0), entraram = nomes.reduce(function (a, l) { return a + l.entradas; }, 0);
    var TIPOS = { lista: 'Lista', vip: 'VIP', cortesia: 'Cortesia', aniversariante: 'Aniversariante' };
    C.innerHTML = '<div class="card" style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:end"><div style="flex:1;min-width:220px"><label>Evento</label><select id="l-ev">' + evs.map(function (e) { return '<option value="' + e.id + '"' + (e.id === ev.id ? ' selected' : '') + '>' + esc(e.nome) + ' · ' + new Date(e.inicio).toLocaleDateString('pt-BR') + '</option>'; }).join('') + '</select></div>' +
      '<form id="f-cfg" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><label class="check" style="margin:0 0 10px"><input type="checkbox" name="ativa"' + (ev.lista_ativa ? ' checked' : '') + '> Promoters podem colocar nomes</label><div><label>Lista fecha em</label><input type="datetime-local" name="fecha" value="' + isoLocal(ev.lista_fecha_em || ev.inicio) + '"></div><button class="btn">Salvar</button></form></div>' +
      '<div class="grid g4" style="margin-bottom:16px"><div class="metric"><span>Nomes</span><b>' + nomes.length + '</b></div><div class="metric"><span>Pessoas</span><b>' + pessoas + '</b></div><div class="metric"><span>Já entraram</span><b>' + entraram + '</b></div><div class="metric"><span>Faltam</span><b>' + (pessoas - entraram) + '</b></div></div>' +
      '<div class="duas"><div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><input id="l-busca" placeholder="Buscar nome…" style="flex:1;min-width:160px"><button class="btn peq" id="l-csv"><i class="ti ti-download"></i> Planilha</button><button class="btn peq" onclick="window.print()"><i class="ti ti-printer"></i> Imprimir</button></div><div id="l-itens"></div></div>' +
      '<form class="card" id="f-nome"><h3>Colocar nome</h3><label>Nome completo</label><input name="nome" required minlength="3"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>Pessoas</label><input name="pessoas" type="number" min="1" max="50" value="1"></div><div><label>Tipo</label><select name="tipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '">' + TIPOS[k] + '</option>'; }).join('') + '</select></div></div>' +
      '<label>Promoter (opcional)</label><select name="prom"><option value="">Da casa</option>' + proms.map(function (p) { return '<option value="' + p.id + '">' + esc(p.nome) + '</option>'; }).join('') + '</select><label>Observação</label><input name="obs" placeholder="ex.: mesa 4, entra até 1h"><button class="btn prim" style="margin-top:12px">Colocar na lista</button></form></div>';
    function desenhar(filtro) {
      var b = (filtro || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      var vis = nomes.filter(function (l) { return !b || l.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().indexOf(b) >= 0; });
      $('#l-itens').innerHTML = vis.length ? vis.map(function (l) {
        return '<div class="lista-item"><div style="flex:1"><b>' + esc(l.nome) + '</b> ' + (l.tipo !== 'lista' ? '<span class="pill amarelo">' + TIPOS[l.tipo] + '</span>' : '') + '<div class="small muted">' + l.pessoas + ' pessoa(s) · ' + (l.promoters ? 'promoter ' + esc(l.promoters.nome) : 'da casa') + (l.observacao ? ' · ' + esc(l.observacao) : '') + '</div></div>' +
          '<span class="pill ' + (l.entradas >= l.pessoas ? 'verde' : l.entradas ? 'amarelo' : 'cinza') + '">' + l.entradas + '/' + l.pessoas + '</span>' + (l.entradas ? '' : '<button class="btn peq" data-del="' + l.id + '" aria-label="Tirar da lista"><i class="ti ti-trash"></i></button>') + '</div>';
      }).join('') : vazio('list-check', nomes.length ? 'Nenhum nome encontrado.' : 'Lista vazia. Os promoters colocam nomes pela área deles, e você pode colocar aqui ao lado.');
      $$('[data-del]').forEach(function (bt) { bt.onclick = async function () { if (!confirm('Tirar este nome da lista?')) return; await q(sb.from('lista_nomes').delete().eq('id', bt.dataset.del)); Clic.toast('Nome retirado'); rota(); }; });
    }
    desenhar('');
    $('#l-busca').oninput = function () { desenhar(this.value); };
    $('#l-ev').onchange = function () { sessionStorage.setItem('clic_lista_ev', this.value); rota(); };
    $('#f-cfg').onsubmit = async function (e) { e.preventDefault(); await q(sb.from('eventos').update({ lista_ativa: this.ativa.checked, lista_fecha_em: this.fecha.value ? new Date(this.fecha.value).toISOString() : null }).eq('id', ev.id)); Clic.toast('Lista atualizada'); };
    $('#l-csv').onclick = function () { csv('lista-' + ev.nome + '.csv', [['Nome', 'Pessoas', 'Tipo', 'Promoter', 'Entraram', 'Observação']].concat(nomes.map(function (l) { return [l.nome, l.pessoas, TIPOS[l.tipo], l.promoters ? l.promoters.nome : 'Casa', l.entradas, l.observacao || '']; }))); };
    $('#f-nome').onsubmit = async function (e) {
      e.preventDefault(); var f = this;
      var r2 = await sb.from('lista_nomes').insert({ org_id: ORG.id, evento_id: ev.id, nome: f.nome.value.trim().replace(/\s+/g, ' '), pessoas: parseInt(f.pessoas.value, 10) || 1, tipo: f.tipo.value, promoter_id: f.prom.value || null, observacao: f.obs.value || null });
      if (r2.error) return Clic.toast(Clic.erro(r2.error), true);
      Clic.toast('Nome colocado na lista'); rota();
    };
  };

  // ================================================================ PAGAMENTOS ONLINE
  PAGINAS.pagamentos = async function () {
    titulo('Pagamentos online');
    var o = ORG;
    function st(ok, txt) { return ok ? '<span class="pill verde">' + (txt || 'Ativo') + '</span>' : '<span class="pill amarelo">' + (txt || 'Pendente') + '</span>'; }
    C.innerHTML = '<div class="grid g4" style="margin-bottom:16px"><div class="metric"><span>Pix online</span><b>' + st(o.asaas_conectado) + '</b><span>pelo Asaas</span></div><div class="metric"><span>Cartão online</span><b>' + st(o.asaas_conectado) + '</b><span>pelo Asaas</span></div>' +
      '<div class="metric"><span>Venda online</span><b>' + st(o.venda_online_liberada, o.venda_online_liberada ? 'Liberada' : 'Aguardando Clic') + '</b><span>liberação da Clic</span></div><div class="metric"><span>Comissão</span><b>' + o.comissao_pct + '%</b><span>separada no split</span></div></div>' +
      '<div class="duas"><div>' +
      '<form class="card" id="f-quem" style="margin-bottom:16px"><h3>Quem paga a comissão de ' + o.comissao_pct + '%?</h3><label class="check"><input type="radio" name="quem" value="comprador"' + (o.comissao_quem_paga === 'comprador' ? ' checked' : '') + '> <span>O comprador (vai na taxa de serviço). Ingresso de R$ 100: você recebe R$ 100.</span></label>' +
      '<label class="check"><input type="radio" name="quem" value="produtor"' + (o.comissao_quem_paga === 'produtor' ? ' checked' : '') + '> <span>Eu. Ingresso de R$ 100: você recebe R$ ' + (100 - o.comissao_pct) + '.</span></label><button class="btn prim">Salvar</button></form>' +
      '<form class="card" id="f-parc"><h3>Parcelamento no cartão</h3><label>Parcelar em até</label><select name="parcelas">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) { return '<option value="' + n + '"' + (n === o.parcelas_max ? ' selected' : '') + '>' + (n === 1 ? 'Só à vista' : n + 'x') + '</option>'; }).join('') + '</select>' +
      '<label class="check"><input type="radio" name="juros" value="1"' + (o.juros_comprador ? ' checked' : '') + '> Juros por conta do comprador</label><label class="check"><input type="radio" name="juros" value="0"' + (o.juros_comprador ? '' : ' checked') + '> Sem juros para o comprador (as taxas saem do seu valor)</label><button class="btn prim">Salvar parcelamento</button></form></div>' +
      '<div><form class="card" id="f-asaas" style="margin-bottom:16px"><h3>Conta Asaas ' + st(o.asaas_conectado, o.asaas_conectado ? 'Conectada' : 'Não conectada') + '</h3><p class="small muted">O dinheiro das vendas cai direto na sua conta Asaas. A chave fica guardada criptografada e ninguém consegue ver depois de salva.</p>' +
      '<label>Ambiente</label><select name="ambiente"><option value="sandbox"' + (o.asaas_ambiente === 'sandbox' ? ' selected' : '') + '>Sandbox (testes)</option><option value="producao"' + (o.asaas_ambiente === 'producao' ? ' selected' : '') + '>Produção (vendas reais)</option></select>' +
      '<label>Chave de API do Asaas</label><input name="chave" type="password" autocomplete="off" placeholder="' + (o.asaas_conectado ? '•••••• (já salva — cole outra para trocar)' : '$aact_...') + '"><button class="btn prim" style="margin-top:12px">Salvar e conectar</button>' +
      '<p class="small muted" style="margin-top:10px">No Asaas: Integrações › Chave de API. O webhook é configurado sozinho quando você salva.</p></form>' +
      '<form class="card" id="f-wa"><h3>WhatsApp automático</h3><p class="small muted">Quando o pagamento é aprovado, o cliente recebe no WhatsApp a imagem de cada ingresso com o QR Code.</p><label>Provedor</label><select name="provedor"><option value="">Desligado</option><option value="zapi">Z-API</option><option value="evolution">Evolution API (v2)</option></select>' +
      '<label>Endereço do servidor (Evolution)</label><input name="url"><label>Instância</label><input name="instancia"><label>Token</label><input name="token" type="password" autocomplete="off"><label>Client-Token (Z-API)</label><input name="client_token" type="password" autocomplete="off">' +
      '<div class="acoes" style="margin-top:12px"><button class="btn prim">Salvar WhatsApp</button><button type="button" class="btn" id="wa-teste">Enviar teste</button></div></form></div></div>';
    $('#f-quem').onsubmit = async function (e) { e.preventDefault(); await q(sb.from('organizacoes').update({ comissao_quem_paga: this.quem.value }).eq('id', o.id)); o.comissao_quem_paga = this.quem.value; Clic.toast('Salvo'); };
    $('#f-parc').onsubmit = async function (e) { e.preventDefault(); await q(sb.from('organizacoes').update({ parcelas_max: +this.parcelas.value, juros_comprador: this.juros.value === '1' }).eq('id', o.id)); Clic.toast('Parcelamento salvo'); };
    $('#f-asaas').onsubmit = async function (e) {
      e.preventDefault(); var f = this, btn = f.querySelector('.prim');
      if (!f.chave.value && !o.asaas_conectado) return Clic.toast('Cole a chave de API do Asaas', true);
      Clic.carregando(btn, true, 'Conectando…');
      var r = await sb.functions.invoke('asaas-conectar', { body: { org_id: o.id, ambiente: f.ambiente.value, chave: f.chave.value || null } });
      Clic.carregando(btn, false); f.chave.value = '';
      if (r.error) return Clic.toast('Não foi possível conectar: ' + Clic.erro(r.error), true);
      Clic.toast('Asaas conectado'); ORG.asaas_conectado = true; rota();
    };
    $('#f-wa').onsubmit = async function (e) {
      e.preventDefault(); var d = form(this);
      var r = await sb.functions.invoke('whatsapp-config', { body: Object.assign({ org_id: o.id }, d) });
      this.token.value = ''; this.client_token.value = '';
      Clic.toast(r.error ? 'Não foi possível salvar: ' + Clic.erro(r.error) : 'WhatsApp salvo', !!r.error);
    };
    $('#wa-teste').onclick = async function () {
      var tel = prompt('Número para o teste (com DDD):'); if (!tel) return;
      var r = await sb.functions.invoke('whatsapp-teste', { body: { org_id: o.id, telefone: tel } });
      Clic.toast(r.error ? 'Falhou: ' + Clic.erro(r.error) : 'Teste enviado', !!r.error);
    };
  };

  // ================================================================ SITE E IDENTIDADE
  PAGINAS.site = async function () {
    titulo('Site e identidade');
    var o = ORG, t = o.textos || {};
    var SECOES = [['banner', 'Banner com contagem regressiva'], ['grupo', 'Grupo oficial (WhatsApp)'], ['momentos', 'Três momentos'], ['eventos', 'Próximos eventos'], ['locacoes', 'Espaços e locações'],
      ['loja', 'Loja oficial'], ['galeria', 'Galeria de fotos'], ['depoimentos', 'Depoimentos'], ['vip', 'Chamada VIP'], ['newsletter', 'Cadastro de e-mail']];
    function campo(k, rot, tipo, ph) { return '<label>' + rot + '</label>' + (tipo === 'area' ? '<textarea name="t_' + k + '" placeholder="' + esc(ph || '') + '">' + esc(t[k] || '') + '</textarea>' : '<input name="t_' + k + '" value="' + esc(t[k] || '') + '" placeholder="' + esc(ph || '') + '">'); }
    C.innerHTML = '<form id="f-site"><div class="duas"><div>' +
      '<div class="card" style="margin-bottom:16px"><h3>Marca</h3><div class="linha2"><div><label>Nome exibido</label><input name="nome" required value="' + esc(o.nome) + '"></div><div><label>Nome da loja</label><input name="nome_loja" value="' + esc(o.nome_loja || '') + '" placeholder="Loja oficial"></div></div>' +
      '<div class="linha2"><div><label>Cor de destaque</label><input type="color" name="cor_destaque" value="' + o.cor_destaque + '" style="height:44px"></div><div><label>Cor de fundo</label><input type="color" name="cor_secundaria" value="' + o.cor_secundaria + '" style="height:44px"></div></div>' +
      '<label>Logo (PNG transparente; GIF ou WEBP animado também funciona)</label><input type="file" name="logo" accept="image/*">' + (o.logo_url ? '<img src="' + esc(o.logo_url) + '" style="height:50px;margin-top:6px">' : '') +
      '<label>Animação da logo</label><select name="logo_animacao">' + [['nenhuma', 'Sem animação'], ['brilho', 'Brilho passando'], ['pulsar', 'Pulsar'], ['flutuar', 'Flutuar'], ['balancar', 'Balançar'], ['girar', 'Girar (moeda)'], ['neon', 'Neon piscando']].map(function (a) { return '<option value="' + a[0] + '"' + (o.logo_animacao === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select>' +
      campo('slogan', 'Frase abaixo do nome', '', 'Eventos oficiais') + '</div>' +
      '<div class="card" style="margin-bottom:16px"><h3>Banner principal</h3>' + campo('hero_chamada', 'Frase pequena acima do título', '', 'Música • Experiências • Eventos') + campo('hero_titulo', 'Título', '', 'Viva noites que merecem ser lembradas.') +
      campo('hero_destaque', 'Parte do título em destaque', '', 'noites') + campo('hero_texto', 'Texto', 'area') + campo('hero_botao', 'Texto do botão', '', 'Garantir meu ingresso') + campo('contador_texto', 'Texto da contagem regressiva', '', 'para a próxima noite!') +
      '<label>Imagem de fundo do banner</label><input type="file" name="img_hero" accept="image/*"></div>' +
      '<div class="card" style="margin-bottom:16px"><h3>Grupo oficial</h3>' + campo('grupo_titulo', 'Título', '', 'Entre no grupo VIP') + campo('grupo_texto', 'Texto', 'area') + campo('grupo_beneficios', 'Benefícios (um por linha)', 'area') + campo('grupo_link', 'Link do grupo', '', 'https://chat.whatsapp.com/...') + '</div>' +
      '<div class="card" style="margin-bottom:16px"><h3>Três momentos</h3>' + campo('momentos_titulo', 'Título') + [1, 2, 3].map(function (n) { return '<div class="linha2"><div>' + campo('m' + n + '_titulo', 'Momento ' + n + ' · título') + '</div><div>' + campo('m' + n + '_texto', 'Texto') + '</div></div><input type="file" name="img_m' + n + '" accept="image/*">'; }).join('') + '</div>' +
      '<div class="card" style="margin-bottom:16px"><h3>Galeria, depoimentos e VIP</h3><label>Adicionar fotos à galeria (até 18 no total)</label><input type="file" name="galeria" accept="image/*" multiple><div class="small muted">' + ((t.galeria || []).length) + ' foto(s) na galeria. <a href="#" id="limpar-gal">Limpar galeria</a></div>' +
      campo('depoimentos', 'Depoimentos (um por linha: Nome | Cidade | Texto)', 'area') + campo('vip_titulo', 'Chamada VIP · título') + campo('vip_texto', 'Texto', 'area') + campo('vip_botao', 'Texto do botão') + campo('vip_link', 'Link do botão VIP') + campo('vip_beneficios', 'Benefícios (um por linha)', 'area') + '<label>Imagem VIP</label><input type="file" name="img_vip" accept="image/*"></div>' +
      '<div class="card"><h3>Contatos e redes</h3>' + campo('whatsapp', 'WhatsApp de atendimento (com DDD, só números)') + campo('email', 'E-mail de contato') + campo('instagram', 'Instagram (link)') + campo('tiktok', 'TikTok (link)') + campo('youtube', 'YouTube (link)') + campo('rodape', 'Texto do rodapé') + '</div>' +
      '</div><div><div class="card" style="position:sticky;top:16px"><h3>Seções visíveis</h3>' + SECOES.map(function (s) { return '<label class="check"><input type="checkbox" name="secoes" value="' + s[0] + '"' + (o.secoes.indexOf(s[0]) >= 0 ? ' checked' : '') + '> ' + s[1] + '</label>'; }).join('') +
      '<p class="small muted">Seções sem conteúdo (ex.: loja sem produtos) ficam ocultas sozinhas.</p><button class="btn prim full">Salvar site</button><a class="btn full" style="margin-top:8px" target="_blank" href="/' + o.slug + '">Ver site</a></div></div></div></form>';
    $('#limpar-gal').onclick = async function (e) { e.preventDefault(); if (!confirm('Tirar todas as fotos da galeria?')) return; t.galeria = []; await q(sb.from('organizacoes').update({ textos: t }).eq('id', o.id)); rota(); };
    $('#f-site').onsubmit = async function (e) {
      e.preventDefault(); var f = this, btn = f.querySelector('.prim'); Clic.carregando(btn, true, 'Salvando…');
      try {
        var novo = Object.assign({}, t);
        $$('[name^="t_"]', f).forEach(function (i) { novo[i.name.slice(2)] = i.value.trim(); });
        var imgs = { img_hero: 'hero_img', img_m1: 'm1_img', img_m2: 'm2_img', img_m3: 'm3_img', img_vip: 'vip_img' };
        for (var k in imgs) if (f[k].files[0]) novo[imgs[k]] = await Clic.enviarImagem(o.id, f[k].files[0], 'site');
        var gal = (novo.galeria || []).slice();
        for (var g = 0; g < f.galeria.files.length && gal.length < 18; g++) gal.push(await Clic.enviarImagem(o.id, f.galeria.files[g], 'galeria'));
        novo.galeria = gal;
        var d = { nome: f.nome.value.trim(), nome_loja: f.nome_loja.value || null, cor_destaque: f.cor_destaque.value, cor_secundaria: f.cor_secundaria.value,
          logo_animacao: f.logo_animacao.value, textos: novo, secoes: $$('input[name=secoes]:checked', f).map(function (i) { return i.value; }) };
        if (f.logo.files[0]) d.logo_url = await Clic.enviarImagem(o.id, f.logo.files[0], 'logo');
        var r = await q(sb.from('organizacoes').update(d).eq('id', o.id).select().single());
        ORG = r; $('#nome-casa').textContent = r.nome; Clic.toast('Site salvo'); rota();
      } catch (ex) { Clic.carregando(btn, false); if (!ex || !ex.code) Clic.toast('Não salvou: ' + Clic.erro(ex), true); }
    };
  };

  iniciar();
})();
