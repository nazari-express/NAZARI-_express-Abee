/* Nazari Express — espace administrateur : accueil, commandes, détail, chiffres, menu « Plus ».
   Principe : l'écran montre l'essentiel en gros ; tout le reste reste à portée de main (sections repliées, menu « Plus »). */
(function (NZ) {
  'use strict';
  const U = NZ.ui, V = NZ.v;
  const { html, raw, str, ic, btn, field, fcfa, fnum, fwhen, ftime, empty, row, statusChip, SERVICE, STATUS } = U;
  const ROLES = { client: 'Client', driver: 'Livreur', admin: 'Administrateur' };
  NZ.ROLES = ROLES;
  const A = { roles: ['admin'] };
  const plural = (n, one, many) => (n > 1 ? many : one);

  /* =====================================================================
     Accueil : trois grosses cartes
     ===================================================================== */
  const bigCard = (cls, href, icon, title, sub, n, vid) => html`<a class="ah-card ${cls}" href="${href}" data-vid="${vid}"><span class="ah-ic">${ic(icon, 26)}</span><span class="ah-tx"><b>${title}</b><small>${sub}</small></span><span class="ah-n${n ? '' : ' zero'}">${n}</span></a>`;
  function homeView(r) {
    const open = r.open || {}, t = r.today || {};
    const first = String((NZ.user() && NZ.user().name) || '').trim().split(/\s+/)[0];
    const nNew = open.received || 0, nRoad = open.in_delivery || 0, nChat = NZ.chatUnread || 0;
    const nFree = (NZ.me && NZ.me.counts && NZ.me.counts.available) || 0;
    return html`<div class="ah">
      <h1 class="ah-hello">Bonjour${first ? ' ' + first : ''}</h1>
      <p class="ah-sub">Voici où en est ${NZ.company().name}.</p>
      ${bigCard('g', '#/admin/orders?s=received', 'box', 'Nouvelles commandes', nNew ? 'à valider' : 'Rien à valider', nNew, 'ah-new')}
      ${bigCard('b', '#/admin/chats', 'chat', 'Discussions', nChat ? 'à répondre' : 'Aucun message en attente', nChat, 'ah-chat')}
      ${bigCard('o', '#/admin/orders?s=in_delivery', 'truck', 'En livraison', nRoad ? 'en route chez les clients' : 'Aucune livraison en route', nRoad, 'ah-road')}
      ${nFree ? html`<a class="ah-free" href="#/admin/orders?s=accepted" data-vid="ah-free">${ic('clock', 20)}<span><b>${nFree} commande${plural(nFree, '', 's')} validée${plural(nFree, '', 's')}</b> en attente d'un livreur</span>${ic('chev', 18)}</a>` : ''}
      <div class="ah-row">${btn({ label: 'Toutes les commandes', kind: 'ghost', href: '#/admin/orders?s=', icon: 'list' })}${btn({ label: 'Passer une commande', kind: 'ghost', href: '#/new', icon: 'plus' })}</div>
      <a class="ah-today" href="#/admin/stats" data-vid="ah-today"><span>Aujourd'hui</span><span><b>${fnum(t.orders || 0)}</b> commande${plural(t.orders || 0, '', 's')} · <b>${fnum(t.delivered || 0)}</b> livrée${plural(t.delivered || 0, '', 's')} · <b>${fcfa(t.revenue || 0)}</b></span>${ic('chev', 18)}</a>
    </div>`;
  }
  NZ.route('/admin', async (ctx) => {
    ctx.shell({ brand: true, tab: 'home' });
    const load = async () => {
      await NZ.refreshMe();
      const r = await NZ.api('admin.stats', { period: 'today' });
      NZ.scrollKeep(() => ctx.main(homeView(r)));
      NZ.paintBadges();
    };
    try { await load(); } catch (e) { return ctx.fail(e); }
    ctx.poll(12000, load);
  }, A);

  /* =====================================================================
     Liste des commandes
     ===================================================================== */
  const AO = { status: 'open', service: '', q: '', items: [], total: 0 };
  const STATUS_CHIPS = [['open', 'Ouvertes'], ['received', 'Nouvelles'], ['accepted', 'Validées'], ['in_delivery', 'En livraison'], ['delivered', 'Livrées'], ['cancelled', 'Annulées'], ['', 'Toutes']];
  const chipsHtml = () => html`<div class="filters">${STATUS_CHIPS.map(([v, t]) => html`<button type="button" class="fchip${AO.status === v ? ' on' : ''}" data-act="ao-status-filter" data-v="${v}">${t}${v === 'received' && NZ.me && NZ.me.counts && NZ.me.counts.new ? ' (' + NZ.me.counts.new + ')' : ''}</button>`)}</div>`;
  const gap = (v) => (v < 0 ? '− ' + fcfa(-v) : '+ ' + fcfa(v));
  const aoCard = (o) => V.orderCard(o, '#/admin/order/' + o.id, {
    extra: html`<div class="meta" style="margin-top:2px">Client : ${o.customer.name} · +227 ${U.fphone(o.customer.phone)}${o.driver ? html` · Livreur : ${o.driver.name}` : ''}</div>
      ${o.variance ? html`<div style="margin-top:6px"><span class="chip warn">Écart de caisse ${gap(o.variance)}</span></div>` : ''}`,
  });
  const listHtml = () => html`${AO.items.length ? AO.items.map(aoCard) : empty('list', 'Aucune commande', AO.q ? 'Aucun résultat pour cette recherche.' : 'Les commandes apparaissent ici dès qu\'un client en passe une.')}
    ${AO.items.length < AO.total ? html`<div style="margin-top:12px">${btn({ label: 'Charger plus (' + (AO.total - AO.items.length) + ')', kind: 'ghost', full: true, act: 'ao-more' })}</div>` : ''}`;
  const aoArgs = (limit, offset) => {
    const a = { limit, offset };
    if (AO.status) a.status = AO.status;
    if (AO.service) a.service = AO.service;
    if (AO.q.trim()) a.q = AO.q.trim();
    return a;
  };
  let aoSig = '', aoCtx = null, aoTimer = null;
  async function aoLoad(force) {
    const r = await NZ.api('admin.orders', aoArgs(Math.min(100, Math.max(30, AO.items.length)), 0));
    AO.items = r.items; AO.total = r.total;
    const s = AO.status + AO.service + AO.q + JSON.stringify(r.items) + r.total;
    if (force || s !== aoSig) {
      aoSig = s;
      const l = document.getElementById('ao-list'); if (l) NZ.scrollKeep(() => { l.innerHTML = str(listHtml()); });
    }
    const c = document.getElementById('ao-chips'); if (c) c.innerHTML = str(chipsHtml());
  }
  NZ.route('/admin/orders', async (ctx) => {
    ctx.shell({ title: 'Commandes', tab: 'orders' });
    aoCtx = ctx;
    if (ctx.query && 's' in ctx.query) AO.status = STATUS_CHIPS.some(([v]) => v === ctx.query.s) ? ctx.query.s : 'open';
    await NZ.refreshMe();
    ctx.main(html`<div id="ao-chips">${chipsHtml()}</div>
      <div class="grid2" style="margin-bottom:14px"><input class="input" type="search" data-bind="q" value="${AO.q}" placeholder="N°, nom, téléphone" aria-label="Rechercher une commande" autocomplete="off">
        <select class="input" data-bind="service" aria-label="Type de service">${[['', 'Tous les services'], ['parcel', 'Colis'], ['agency_drop', 'Dépôt agence'], ['agency_pickup', 'Retrait agence'], ['pharmacy', 'Pharmacie']].map(([v, t]) => html`<option value="${v}"${AO.service === v ? raw(' selected') : ''}>${t}</option>`)}</select></div>
      <div id="ao-list">${U.skeleton(3)}</div>`);
    NZ.bindTarget = AO;
    NZ.onBind = (path) => {
      clearTimeout(aoTimer);
      aoTimer = setTimeout(() => { aoLoad(true).catch((e) => U.toast(e.message, 'err')); }, path === 'q' ? 350 : 0);
    };
    try { await aoLoad(true); } catch (e) { return ctx.fail(e); }
    ctx.poll(12000, async () => { await NZ.refreshMe(); await aoLoad(false); });
  }, A);
  NZ.act('ao-status-filter', async (el) => {
    AO.status = el.dataset.v;
    const c = document.getElementById('ao-chips'); if (c) c.innerHTML = str(chipsHtml());
    try { await aoLoad(true); } catch (e) { U.toast(e.message, 'err'); }
  });
  NZ.act('ao-more', async (el) => {
    await U.busy(el, async () => {
      try {
        const r = await NZ.api('admin.orders', aoArgs(30, AO.items.length));
        AO.items = AO.items.concat(r.items); AO.total = r.total;
        const l = document.getElementById('ao-list'); if (l) l.innerHTML = str(listHtml());
      } catch (e) { U.toast(e.message, 'err'); }
    });
  });

  /* =====================================================================
     Détail d'une commande : un seul gros bouton « étape suivante »
     ===================================================================== */
  let AR = null, arCtx = null, AF = {};
  const FOLD = {};   // sections ouvertes à la main par l'administrateur (gardées quand l'écran se rafraîchit)
  const sumFees = (f) => ['fee_base', 'fee_express', 'fee_far', 'fee_adjust', 'items_amount'].reduce((t, k) => t + (parseInt(String(f[k] || '0').replace(/\s/g, ''), 10) || 0), 0);
  /* L'étape qui vient ensuite : valider, donner à un livreur, mettre en livraison, marquer livrée. */
  function mainStep(o) {
    if (o.status === 'received') return { st: 'accepted', label: 'Valider la commande', icon: 'check' };
    if (o.status === 'accepted' || o.status === 'preparing') {
      return o.driver ? { st: 'in_delivery', label: 'Mettre en livraison', icon: 'truck' } : { pick: true, label: 'Donner à un livreur', icon: 'truck' };
    }
    if (o.status === 'in_delivery') return { st: 'delivered', label: 'Marquer comme livrée', icon: 'dcheck' };
    return null;
  }
  const foldBox = (key, title, end, open, body) => html`<details class="fold" data-k="${key}"${open ? raw(' open') : ''}><summary><span>${title}</span>${end ? html`<b class="num fe">${end}</b>` : ''}</summary><div class="fold-b">${body}</div></details>`;

  function aoDetail(R) {
    const o = R.order, s = SERVICE[o.service] || SERVICE.parcel, c = o.customer;
    const dims = o.dims ? [o.dims.l, o.dims.w, o.dims.h].filter(Boolean).join(' × ') + ' cm' : '';
    const flags = [o.express ? 'Express' : '', o.far ? 'Zone éloignée' : '', o.zone_unknown ? 'Quartier hors liste' : '', o.quote ? 'Sur devis' : ''].filter(Boolean);
    const step = mainStep(o);
    const closed = ['delivered', 'cancelled'].includes(o.status);
    const isOpen = (k, dflt) => (k in FOLD ? FOLD[k] : dflt);
    return html`<div class="stack">
      <div class="card"><div class="code-card" style="justify-content:space-between"><div style="display:flex;gap:12px;align-items:center"><span class="disc sm solid">${ic(s.icon, 20)}</span><div><div class="muted small">${s.long}</div><div class="h2 num">${o.code}</div></div></div>${statusChip(o.status)}</div>
        ${V.kv([['Client', c.name], ['Téléphone', '+227 ' + U.fphone(c.phone)], ['Reçue', fwhen(o.created_at)], ['Paiement', V.payText(o) + ' · payé par ' + (o.payer === 'sender' ? 'l\'expéditeur' : 'le destinataire')], o.status === 'delivered' && o.collected != null ? ['Encaissé', fcfa(o.collected)] : null, o.variance ? ['Écart de caisse', gap(o.variance) + (o.variance < 0 ? ' (il manque de l\'argent)' : ' (trop perçu)')] : null, o.cancel_reason ? ['Motif', o.cancel_reason] : null])}
        ${o.variance ? html`<div style="margin-top:10px">${V.notice('Le livreur a encaissé ' + fcfa(o.collected) + ' au lieu de ' + fcfa(o.fees.total) + '. Son explication figure dans l\'historique plus bas.', 'warn')}</div>` : ''}
        ${flags.length ? html`<div class="actions" style="margin-top:10px">${flags.map((f) => html`<span class="chip warn">${f}</span>`)}</div>` : ''}
        ${V.callRow(c.phone, 'Bonjour ' + c.name + ', ' + NZ.company().name + ' au sujet de votre commande ' + o.code + ' : ', 'Appeler le client')}</div>

      ${!closed ? html`<div class="ao-next" data-vid="ao-next">
        ${step ? (step.pick
          ? btn({ label: step.label, kind: 'primary', full: true, size: 'lg', icon: step.icon, act: 'ao-driver-open' })
          : btn({ label: step.label, kind: 'primary', full: true, size: 'lg', icon: step.icon, act: 'ao-status', data: { st: step.st } })) : ''}
        <div class="ao-more">
          ${o.status === 'accepted' && o.service === 'pharmacy' ? btn({ label: 'Pharmacie : en préparation', kind: 'ghost', size: 'sm', icon: 'clock', act: 'ao-status', data: { st: 'preparing' } }) : ''}
          ${step && step.pick ? btn({ label: 'Mettre en livraison', kind: 'ghost', size: 'sm', icon: 'truck', act: 'ao-status', data: { st: 'in_delivery' } }) : ''}
          ${btn({ label: 'Annuler la commande', kind: 'danger', size: 'sm', act: 'ao-cancel' })}</div></div>` : ''}

      ${V.idCardBox(o, { can: true, note: 'Chaque consultation est notée dans le journal d\'activité.' })}

      <div class="card"><div class="h2" style="margin-bottom:12px">Adresses</div>${V.routeBlock(o)}
        ${V.kv([[o.service === 'pharmacy' ? 'Liste du client' : 'Contenu', o.desc], o.service !== 'pharmacy' ? ['Poids', Number(o.weight_kg).toString().replace('.', ',') + ' kg'] : null, ['Dimensions', dims], ['Message du client', o.note]])}</div>

      <div class="card ao-drv"><div style="flex:1;min-width:0"><div class="muted small">Livreur</div><div class="ao-dn">${o.driver ? o.driver.name : 'Pas encore assigné'}</div>${o.driver ? html`<div class="small muted">+227 ${U.fphone(o.driver.phone)}</div>` : ''}</div>
        ${closed ? '' : btn({ label: o.driver ? 'Changer' : 'Choisir', kind: 'ghost', size: 'sm', act: 'ao-driver-open' })}</div>

      ${foldBox('amounts', 'Montants', fcfa(o.fees.total), isOpen('amounts', !!o.quote), html`<form data-submit="ao-amounts" novalidate>
          <div class="grid2">${field({ label: 'Livraison', bind: 'fee_base', name: 'fee_base', value: AF.fee_base, inputmode: 'numeric' })}${field({ label: 'Express', bind: 'fee_express', name: 'fee_express', value: AF.fee_express, inputmode: 'numeric' })}</div>
          <div class="grid2" style="margin-top:14px">${field({ label: 'Zone éloignée', bind: 'fee_far', name: 'fee_far', value: AF.fee_far, inputmode: 'numeric' })}${field({ label: 'Ajustement (+ ou −)', bind: 'fee_adjust', name: 'fee_adjust', value: AF.fee_adjust, inputmode: 'text', placeholder: 'ex. -200' })}</div>
          ${o.service === 'pharmacy' ? html`<div style="margin-top:14px">${field({ label: 'Médicaments / produits', bind: 'items_amount', name: 'items_amount', value: AF.items_amount, inputmode: 'numeric', hint: 'Montant confirmé avec la pharmacie : le client est prévenu.' })}</div>` : html`<input type="hidden" name="items_amount" value="${AF.items_amount}">`}
          <label class="check${AF.quote ? ' on' : ''}" style="margin-top:14px"><input type="checkbox" name="quote" data-bind="quote"${AF.quote ? raw(' checked') : ''}><div><div class="t">Prix sur devis</div><div class="s">Cochez tant que le prix n'est pas confirmé au client.</div></div></label>
          <div class="price-box" style="margin-top:14px"><div class="line tot" style="border:0;margin:0;padding:0"><span>Total à encaisser</span><span class="num" id="ao-total">${fcfa(sumFees(AF))}</span></div></div>
          <div style="margin-top:12px">${btn({ label: 'Enregistrer les montants', type: 'submit', full: true })}</div></form>`)}

      ${foldBox('note', 'Note interne', '', isOpen('note', false), html`<form data-submit="ao-note" novalidate>${field({ label: 'Visible par l\'équipe seulement', kind: 'textarea', name: 'admin_note', value: o.admin_note || '', rows: 2, maxlength: 500 })}
        <div style="margin-top:12px">${btn({ label: 'Enregistrer la note', type: 'submit', kind: 'ghost', full: true })}</div></form>`)}

      ${foldBox('hist', 'Historique', '', isOpen('hist', false), html`<ul class="hist">${(R.events || []).slice().reverse().map((e) => html`<li><b>${STATUS[e.status] || e.status}</b><span class="muted"> · ${fwhen(e.at)}</span>${e.note ? html`<div class="small muted">${e.note}</div>` : ''}</li>`)}</ul>
        <details style="margin-top:12px"><summary class="link-btn" style="cursor:pointer">Corriger l'état de la commande…</summary>
          <form data-submit="ao-fixstate" novalidate style="margin-top:10px">${field({ label: 'Nouvel état', kind: 'select', name: 'status', value: o.status, options: Object.keys(STATUS).map((k) => ({ v: k, t: STATUS[k] })) })}
          <div style="margin-top:10px">${btn({ label: 'Appliquer', type: 'submit', kind: 'ghost', full: true })}</div></form></details>`)}
    </div>`;
  }
  const resetAF = (o) => { const f = o.fees; AF = { fee_base: String(f.base), fee_express: String(f.express), fee_far: String(f.far), fee_adjust: String(f.adjust), items_amount: String(f.items), quote: !!o.quote }; };
  const keepFolds = () => document.querySelectorAll('#main details.fold[data-k]').forEach((d) => { FOLD[d.dataset.k] = d.open; });
  function paintAR() {
    keepFolds();
    NZ.scrollKeep(() => { arCtx.main(aoDetail(AR)); });
    NZ.bindTarget = AF;
    NZ.onBind = (path, el, v) => {
      if (path === 'quote') { const c = el.closest('.check'); if (c) c.classList.toggle('on', !!v); return; }
      const t = document.getElementById('ao-total'); if (t) t.textContent = fcfa(sumFees(AF));
    };
  }
  NZ.route('/admin/order/:id', async (ctx) => {
    ctx.shell({ title: 'Commande', back: '#/admin/orders', tab: 'orders' });
    arCtx = ctx;
    Object.keys(FOLD).forEach((k) => { delete FOLD[k]; });
    try {
      AR = await NZ.api('admin.order.get', { id: ctx.params.id });
      resetAF(AR.order); paintAR();
    } catch (e) { return ctx.fail(e); }
    // rafraîchissement discret : on ne touche pas à l'écran si un formulaire est en cours de saisie
    ctx.poll(15000, async () => {
      if (document.querySelector('#main input:focus, #main textarea:focus, #main select:focus')) return;
      const r = await NZ.api('admin.order.get', { id: ctx.params.id });
      if (JSON.stringify(r) !== JSON.stringify(AR)) { AR = r; resetAF(AR.order); paintAR(); }
    });
  }, A);

  async function aoUpdate(patch, el, msg) {
    await U.busy(el, async () => {
      try {
        const r = await NZ.api('admin.order.update', Object.assign({ id: AR.order.id }, patch));
        AR = Object.assign({}, AR, r); resetAF(AR.order); paintAR();
        U.toast(msg || 'Enregistré', 'ok'); NZ.refreshMe();
      } catch (e) { U.toast(e.message, 'err'); }
    });
  }
  NZ.act('ao-status', (el) => aoUpdate({ status: el.dataset.st }, el, 'Commande mise à jour. Le client est prévenu.'));
  NZ.act('ao-cancel', async () => {
    const ok = await U.confirmBox({ title: 'Annuler cette commande ?', text: 'Le client et le livreur seront prévenus.', reason: 'Motif (affiché au client)', ok: 'Annuler la commande', cancel: 'Retour', danger: true });
    if (ok) aoUpdate({ status: 'cancelled', cancel_reason: ok.reason }, null, 'Commande annulée');
  });
  /* choix du livreur : une liste de gros boutons */
  NZ.act('ao-driver-open', () => {
    const drivers = (AR && AR.drivers) || [];
    const cur = AR && AR.order.driver ? AR.order.driver.id : '';
    U.openOverlay(html`<h2>Quel livreur ?</h2><p class="muted small" style="margin-bottom:12px">Il reçoit tout de suite la course sur son téléphone.</p>
      <div class="stack">${drivers.length ? drivers.map((d) => html`<button type="button" class="pick${cur === d.id ? ' on' : ''}" data-act="ao-driver-set" data-id="${d.id}" data-vid="drv-${d.id}"><span class="av">${U.initials(d.name)}</span><span class="pt"><b>${d.name}</b><small>${d.role === 'admin' ? 'Administrateur' : 'Livreur'}</small></span>${cur === d.id ? ic('check', 22) : ''}</button>`)
        : html`<div class="notice">${ic('info', 20)}<div>Aucun livreur pour le moment. Invitez-en un : « Plus » → « Invitations ».</div></div>`}
        <button type="button" class="pick none" data-act="ao-driver-set" data-id="" data-vid="drv-none"><span class="pt"><b>${cur ? 'Retirer le livreur' : 'Laisser les livreurs choisir'}</b><small>${cur ? 'La course redevient libre' : 'La course reste libre pour tous les livreurs'}</small></span></button>
        ${btn({ label: 'Fermer', kind: 'ghost', full: true, act: 'overlay-close' })}</div>`);
  });
  NZ.act('ao-driver-set', (el) => {
    const id = el.dataset.id || '';
    const cur = AR && AR.order.driver ? AR.order.driver.id : '';
    U.closeOverlay();
    if (id === cur) return;
    aoUpdate({ driver_id: id || null }, null, id ? 'Livreur prévenu' : 'Livreur retiré');
  });
  NZ.submit('ao-note', (f) => aoUpdate({ admin_note: U.formData(f).admin_note }, f.querySelector('button[type=submit]'), 'Note enregistrée'));
  NZ.submit('ao-fixstate', (f) => aoUpdate({ status: U.formData(f).status }, f.querySelector('button[type=submit]'), 'État corrigé'));
  NZ.submit('ao-amounts', (f) => {
    const d = U.formData(f);
    const clean = (v) => String(v == null ? '' : v).replace(/[\s ]/g, '');
    const patch = { quote: !!d.quote };
    for (const k of ['fee_base', 'fee_express', 'fee_far', 'items_amount']) {
      const v = clean(d[k]); if (v === '') continue;
      if (!/^\d{1,9}$/.test(v)) return U.toast('Les montants sont des nombres entiers (FCFA).', 'err');
      patch[k] = v;
    }
    const adj = clean(d.fee_adjust).replace('−', '-');
    if (adj !== '') { if (!/^-?\d{1,9}$/.test(adj)) return U.toast('L\'ajustement est un nombre, par exemple -200.', 'err'); patch.fee_adjust = adj; }
    return aoUpdate(patch, f.querySelector('button[type=submit]'), 'Montants enregistrés');
  });

  /* =====================================================================
     Chiffres (tableau de bord)
     ===================================================================== */
  const ST = { period: 'today' };
  function statsView(r) {
    const p = r[ST.period];
    const chip = (v, t) => html`<button type="button" class="fchip${ST.period === v ? ' on' : ''}" data-act="st-period" data-v="${v}">${t}</button>`;
    const open = r.open || {};
    const stat = (v, l, hot) => html`<div class="stat${hot ? ' hot' : ''}"><div class="v num">${v}</div><div class="l">${l}</div></div>`;
    return html`<div class="filters">${chip('today', 'Aujourd\'hui')}${chip('week', '7 jours')}${chip('month', '30 jours')}</div>
      <div class="grid2">${stat(fnum(p.orders), 'Commandes reçues')}${stat(fnum(p.delivered), 'Livrées')}
        ${stat(fcfa(p.revenue), 'Revenus de livraison', true)}${stat(fcfa(p.collected), 'Total encaissé')}
        ${p.items ? stat(fcfa(p.items), 'Dont médicaments') : ''}${stat(fnum(p.cancelled), 'Annulées')}</div>
      ${p.variance_count ? html`<div style="margin-top:12px">${V.notice('Écart de caisse : ' + gap(p.variance) + ' sur ' + p.variance_count + ' livraison' + (p.variance_count > 1 ? 's' : '') + ' (montant encaissé différent du montant demandé). Détail dans « Commandes » → « Livrées ».', 'warn')}</div>` : ''}
      <div class="h-sec">En ce moment</div>
      <div class="card"><div class="grid2">${['received', 'accepted', 'preparing', 'in_delivery'].map((k) => html`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>${STATUS[k]}</span><span class="chip ${k}">${open[k] || 0}</span></div>`)}</div></div>
      <div class="h-sec">Livreurs · ${ST.period === 'today' ? 'aujourd\'hui' : ST.period === 'week' ? '7 derniers jours' : '30 derniers jours'}</div>
      ${r.drivers.length ? html`<div class="list">${r.drivers.map((d) => row({ icon: 'truck', title: d.name, sub: d.delivered + ' livraison' + (d.delivered > 1 ? 's' : '') + ' · ' + fcfa(d.collected) + ' encaissés' + (d.variance ? ' · écart ' + gap(d.variance) : ''), noArrow: true, wrap: true, act: 'noop' }))}</div>`
        : empty('truck', 'Aucun livreur', 'Invitez vos livreurs depuis « Plus » → « Invitations ».')}`;
  }
  let stCtx = null, stData = null;
  NZ.route('/admin/stats', async (ctx) => {
    ctx.shell({ title: 'Mes chiffres', back: '#/admin/more', tab: 'more' });
    stCtx = ctx;
    const load = async () => { stData = await NZ.api('admin.stats', { period: ST.period }); NZ.scrollKeep(() => ctx.main(statsView(stData))); };
    NZ.statsLoad = load;
    try { await load(); } catch (e) { return ctx.fail(e); }
    ctx.poll(30000, load);
  }, A);
  NZ.act('st-period', async (el) => { ST.period = el.dataset.v; try { await NZ.statsLoad(); } catch (e) { U.toast(e.message, 'err'); } });
  NZ.act('noop', () => {});

  /* =====================================================================
     Menu « Plus » : de grosses tuiles, rien n'est caché
     ===================================================================== */
  const tile = (href, icon, title, sub, tone, vid, n) => html`<a class="mt ${tone || ''}" href="${href}" data-vid="${vid}"><span class="mi">${ic(icon, 22)}</span><b>${title}</b><small>${sub}</small>${n ? html`<span class="badge">${n}</span>` : ''}</a>`;
  NZ.route('/admin/more', async (ctx) => {
    ctx.shell({ title: 'Plus', tab: 'more', skeleton: false });
    await NZ.refreshMe();
    const unread = (NZ.me && NZ.me.unread) || 0;
    ctx.main(html`<div class="mt-wrap">
      <div class="h-sec" style="margin-top:2px">Chaque jour</div>
      <div class="mt-grid">
        ${tile('#/admin/stats', 'chart', 'Mes chiffres', 'Commandes et argent', '', 'mt-stats')}
        ${tile('#/new', 'plus', 'Passer une commande', 'Pour un client', 't2', 'mt-new')}
        ${tile('#/admin/announce', 'mega', 'Annonces', 'Un message à tous', 't1', 'mt-announce')}
        ${tile('#/messages', 'bell', 'Notifications', unread ? unread + ' non lue' + plural(unread, '', 's') : 'Rien de nouveau', 't3', 'mt-notif')}
      </div>
      <div class="h-sec">Réglages</div>
      <div class="mt-grid">
        ${tile('#/admin/config', 'sliders', 'Prix et réglages', 'Tarifs, WhatsApp', '', 'mt-config')}
        ${tile('#/admin/zones', 'map', 'Quartiers', 'Zones et suppléments', 't1', 'mt-zones')}
        ${tile('#/admin/partners', 'bus', 'Agences et pharmacies', 'La liste des clients', 't2', 'mt-partners')}
        ${tile('#/admin/push', 'bell', 'Alertes du téléphone', 'Message du jour', 't3', 'mt-push')}
      </div>
      <div class="h-sec">Équipe</div>
      <div class="mt-grid">
        ${tile('#/admin/users', 'users', 'Équipe et clients', 'Comptes et codes PIN', '', 'mt-users')}
        ${tile('#/admin/invites', 'key', 'Invitations', 'Ajouter un livreur', 't1', 'mt-invites')}
        ${tile('#/admin/log', 'list', 'Journal', 'Qui a changé quoi', 't2', 'mt-log')}
      </div>
      <div class="h-sec">Autres</div>
      <div class="mt-grid">
        ${tile('#/share', 'share', 'Partager l\'application', 'Code QR et lien', 't1', 'mt-share')}
        ${tile('#/account', 'user', 'Mon compte', NZ.user().name, 't3', 'mt-account')}
      </div></div>`);
  }, A);
})((window.NZ = window.NZ || {}));
