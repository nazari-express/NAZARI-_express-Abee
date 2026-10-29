/* Nazari Express — espace administrateur : commandes, détail, tableau de bord, menu. */
(function (NZ) {
  'use strict';
  const U = NZ.ui, V = NZ.v;
  const { html, raw, str, ic, btn, field, fcfa, fnum, fwhen, ftime, empty, row, statusChip, SERVICE, STATUS } = U;
  const ROLES = { client: 'Client', driver: 'Livreur', admin: 'Administrateur' };
  NZ.ROLES = ROLES;
  const A = { roles: ['admin'] };

  /* =====================================================================
     Liste des commandes
     ===================================================================== */
  const AO = { status: 'open', service: '', q: '', items: [], total: 0 };
  const STATUS_CHIPS = [['open', 'Ouvertes'], ['received', 'Nouvelles'], ['delivered', 'Livrées'], ['cancelled', 'Annulées'], ['', 'Toutes']];
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
  NZ.route('/admin', async (ctx) => {
    ctx.shell({ title: 'Commandes', tab: 'orders' });
    aoCtx = ctx;
    await NZ.refreshMe();
    ctx.main(html`${!NZ.company().whatsapp ? html`<div style="margin-bottom:12px"><a href="#/admin/config" style="display:block">${V.notice('Votre numéro WhatsApp n\'est pas encore renseigné : les clients ne peuvent pas vous écrire. Touchez ici pour le configurer.', 'warn')}</a></div>` : ''}
      <div id="ao-chips">${chipsHtml()}</div>
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
     Détail d'une commande
     ===================================================================== */
  let AR = null, arCtx = null, AF = {};
  const sumFees = (f) => ['fee_base', 'fee_express', 'fee_far', 'fee_adjust', 'items_amount'].reduce((t, k) => t + (parseInt(String(f[k] || '0').replace(/\s/g, ''), 10) || 0), 0);
  const NEXT = (o) => ({
    received: [['accepted', 'Valider la commande', 'check', 'primary']],
    accepted: o.service === 'pharmacy' ? [['preparing', 'Pharmacie : en préparation', 'clock', 'primary'], ['in_delivery', 'Mettre en livraison', 'truck', 'ghost']] : [['in_delivery', 'Mettre en livraison', 'truck', 'primary']],
    preparing: [['in_delivery', 'Mettre en livraison', 'truck', 'primary']],
    in_delivery: [['delivered', 'Marquer comme livrée', 'dcheck', 'primary']],
    delivered: [], cancelled: [],
  }[o.status] || []);

  function aoDetail(R) {
    const o = R.order, s = SERVICE[o.service] || SERVICE.parcel, c = o.customer, drivers = R.drivers || [];
    const dims = o.dims ? [o.dims.l, o.dims.w, o.dims.h].filter(Boolean).join(' × ') + ' cm' : '';
    const flags = [o.express ? 'Express' : '', o.far ? 'Zone éloignée' : '', o.zone_unknown ? 'Quartier hors liste' : '', o.quote ? 'Sur devis' : ''].filter(Boolean);
    const next = NEXT(o);
    return html`<div class="stack">
      <div class="card"><div class="code-card" style="justify-content:space-between"><div style="display:flex;gap:12px;align-items:center"><span class="disc sm solid">${ic(s.icon, 20)}</span><div><div class="muted small">${s.long}</div><div class="h2 num">${o.code}</div></div></div>${statusChip(o.status)}</div>
        ${V.kv([['Client', c.name], ['Téléphone', '+227 ' + U.fphone(c.phone)], ['Reçue', fwhen(o.created_at)], ['Paiement', V.payText(o) + ' · payé par ' + (o.payer === 'sender' ? 'l\'expéditeur' : 'le destinataire')], ['Livreur', o.driver ? o.driver.name + ' · ' + U.fphone(o.driver.phone) : 'Pas encore assigné'], o.status === 'delivered' && o.collected != null ? ['Encaissé', fcfa(o.collected)] : null, o.variance ? ['Écart de caisse', gap(o.variance) + (o.variance < 0 ? ' (il manque de l\'argent)' : ' (trop perçu)')] : null, o.cancel_reason ? ['Motif', o.cancel_reason] : null])}
        ${o.variance ? html`<div style="margin-top:10px">${V.notice('Le livreur a encaissé ' + fcfa(o.collected) + ' au lieu de ' + fcfa(o.fees.total) + '. Son explication figure dans l\'historique plus bas.', 'warn')}</div>` : ''}
        ${flags.length ? html`<div class="actions" style="margin-top:10px">${flags.map((f) => html`<span class="chip warn">${f}</span>`)}</div>` : ''}
        ${V.callRow(c.phone, 'Bonjour ' + c.name + ', ' + NZ.company().name + ' au sujet de votre commande ' + o.code + ' : ', 'Appeler le client')}</div>

      ${next.length || !['delivered', 'cancelled'].includes(o.status) ? html`<div class="card"><div class="h2" style="margin-bottom:10px">Étape suivante</div>
        <div class="stack">${next.map(([st, label, icon, kind]) => btn({ label, kind, full: true, size: 'lg', icon, act: 'ao-status', data: { st } }))}
        ${!['delivered', 'cancelled'].includes(o.status) ? btn({ label: 'Annuler la commande', kind: 'danger', full: true, act: 'ao-cancel' }) : ''}</div></div>` : ''}

      <div class="card"><div class="h2" style="margin-bottom:10px">Livreur</div>
        <form data-submit="ao-driver" novalidate>
          ${field({ label: 'Assigner à', kind: 'select', name: 'driver_id', value: o.driver ? o.driver.id : '', options: [{ v: '', t: 'Personne (les livreurs choisissent)' }].concat(drivers.map((d) => ({ v: d.id, t: d.name + (d.role === 'admin' ? ' (admin)' : '') }))) })}
          <div style="margin-top:12px">${btn({ label: 'Enregistrer le livreur', type: 'submit', kind: 'ghost', full: true })}</div></form></div>

      <div class="card"><div class="h2" style="margin-bottom:10px">Montants (FCFA)</div>
        <form data-submit="ao-amounts" novalidate>
          <div class="grid2">${field({ label: 'Livraison', bind: 'fee_base', name: 'fee_base', value: AF.fee_base, inputmode: 'numeric' })}${field({ label: 'Express', bind: 'fee_express', name: 'fee_express', value: AF.fee_express, inputmode: 'numeric' })}</div>
          <div class="grid2" style="margin-top:14px">${field({ label: 'Zone éloignée', bind: 'fee_far', name: 'fee_far', value: AF.fee_far, inputmode: 'numeric' })}${field({ label: 'Ajustement (+ ou −)', bind: 'fee_adjust', name: 'fee_adjust', value: AF.fee_adjust, inputmode: 'text', placeholder: 'ex. -200' })}</div>
          ${o.service === 'pharmacy' ? html`<div style="margin-top:14px">${field({ label: 'Médicaments / produits', bind: 'items_amount', name: 'items_amount', value: AF.items_amount, inputmode: 'numeric', hint: 'Montant confirmé avec la pharmacie : le client est prévenu.' })}</div>` : html`<input type="hidden" name="items_amount" value="${AF.items_amount}">`}
          <label class="check${AF.quote ? ' on' : ''}" style="margin-top:14px"><input type="checkbox" name="quote" data-bind="quote"${AF.quote ? raw(' checked') : ''}><div><div class="t">Prix sur devis</div><div class="s">Cochez tant que le prix n'est pas confirmé au client.</div></div></label>
          <div class="price-box" style="margin-top:14px"><div class="line tot" style="border:0;margin:0;padding:0"><span>Total à encaisser</span><span class="num" id="ao-total">${fcfa(sumFees(AF))}</span></div></div>
          <div style="margin-top:12px">${btn({ label: 'Enregistrer les montants', type: 'submit', full: true })}</div></form></div>

      <div class="card"><div class="h2" style="margin-bottom:12px">Adresses</div>${V.routeBlock(o)}
        ${V.kv([[o.service === 'pharmacy' ? 'Liste du client' : 'Contenu', o.desc], o.service !== 'pharmacy' ? ['Poids', Number(o.weight_kg).toString().replace('.', ',') + ' kg'] : null, ['Dimensions', dims], ['Message du client', o.note]])}</div>

      <div class="card"><div class="h2" style="margin-bottom:10px">Note interne</div>
        <form data-submit="ao-note" novalidate>${field({ label: 'Visible par l\'équipe seulement', kind: 'textarea', name: 'admin_note', value: o.admin_note || '', rows: 2, maxlength: 500 })}
        <div style="margin-top:12px">${btn({ label: 'Enregistrer la note', type: 'submit', kind: 'ghost', full: true })}</div></form></div>

      <div class="card"><div class="h2" style="margin-bottom:10px">Historique</div><ul class="hist">${(R.events || []).slice().reverse().map((e) => html`<li><b>${STATUS[e.status] || e.status}</b><span class="muted"> · ${fwhen(e.at)}</span>${e.note ? html`<div class="small muted">${e.note}</div>` : ''}</li>`)}</ul>
        <details style="margin-top:12px"><summary class="link-btn" style="cursor:pointer">Corriger l'état de la commande…</summary>
          <form data-submit="ao-fixstate" novalidate style="margin-top:10px">${field({ label: 'Nouvel état', kind: 'select', name: 'status', value: o.status, options: Object.keys(STATUS).map((k) => ({ v: k, t: STATUS[k] })) })}
          <div style="margin-top:10px">${btn({ label: 'Appliquer', type: 'submit', kind: 'ghost', full: true })}</div></form></details></div>
    </div>`;
  }
  const resetAF = (o) => { const f = o.fees; AF = { fee_base: String(f.base), fee_express: String(f.express), fee_far: String(f.far), fee_adjust: String(f.adjust), items_amount: String(f.items), quote: !!o.quote }; };
  function paintAR() {
    NZ.scrollKeep(() => { arCtx.main(aoDetail(AR)); });
    NZ.bindTarget = AF;
    NZ.onBind = (path, el, v) => {
      if (path === 'quote') { const c = el.closest('.check'); if (c) c.classList.toggle('on', !!v); return; }
      const t = document.getElementById('ao-total'); if (t) t.textContent = fcfa(sumFees(AF));
    };
  }
  NZ.route('/admin/order/:id', async (ctx) => {
    ctx.shell({ title: 'Commande', back: '#/admin', tab: 'orders' });
    arCtx = ctx;
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
  NZ.submit('ao-driver', (f) => aoUpdate({ driver_id: U.formData(f).driver_id || null }, f.querySelector('button[type=submit]'), 'Livreur enregistré'));
  NZ.submit('ao-note', (f) => aoUpdate({ admin_note: U.formData(f).admin_note }, f.querySelector('button[type=submit]'), 'Note enregistrée'));
  NZ.submit('ao-fixstate', (f) => aoUpdate({ status: U.formData(f).status }, f.querySelector('button[type=submit]'), 'État corrigé'));
  NZ.submit('ao-amounts', (f) => {
    const d = U.formData(f);
    const clean = (v) => String(v == null ? '' : v).replace(/[\s ]/g, '');
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
     Tableau de bord
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
    ctx.shell({ title: 'Tableau de bord', tab: 'stats' });
    stCtx = ctx;
    const load = async () => { stData = await NZ.api('admin.stats', { period: ST.period }); NZ.scrollKeep(() => ctx.main(statsView(stData))); };
    NZ.statsLoad = load;
    try { await load(); } catch (e) { return ctx.fail(e); }
    ctx.poll(30000, load);
  }, A);
  NZ.act('st-period', async (el) => { ST.period = el.dataset.v; try { await NZ.statsLoad(); } catch (e) { U.toast(e.message, 'err'); } });
  NZ.act('noop', () => {});

  /* =====================================================================
     Menu « Plus »
     ===================================================================== */
  NZ.route('/admin/more', async (ctx) => {
    ctx.shell({ title: 'Plus', tab: 'more', skeleton: false });
    await NZ.refreshMe();
    ctx.main(html`<div class="stack">
      ${!NZ.company().whatsapp ? html`<a href="#/admin/config" style="display:block">${V.notice('Numéro WhatsApp à renseigner dans « Tarifs et réglages ».', 'warn')}</a>` : ''}
      <div class="list">
        ${row({ icon: 'sliders', title: 'Tarifs et réglages', sub: 'Prix, WhatsApp, maintenance', href: '#/admin/config' })}
        ${row({ icon: 'map', title: 'Quartiers', sub: 'Zones et suppléments', href: '#/admin/zones' })}
        ${row({ icon: 'bus', title: 'Agences et pharmacies', sub: 'Partenaires de livraison', href: '#/admin/partners' })}
      </div>
      <div class="list">
        ${row({ icon: 'users', title: 'Équipe et clients', sub: 'Comptes, rôles, codes PIN', href: '#/admin/users' })}
        ${row({ icon: 'key', title: 'Invitations', sub: 'Codes pour livreurs et administrateurs', href: '#/admin/invites' })}
        ${row({ icon: 'mega', title: 'Annonces', sub: 'Envoyer un message à tous', href: '#/admin/announce' })}
        ${row({ icon: 'list', title: 'Journal d\'activité', sub: 'Qui a changé quoi, et quand', href: '#/admin/log' })}
      </div>
      <div class="list">
        ${row({ icon: 'plus', title: 'Passer une commande', sub: 'Créer une commande pour un client', href: '#/new' })}
        ${row({ icon: 'user', title: 'Mon compte', sub: NZ.user().name, href: '#/account' })}
      </div></div>`);
  }, A);
})((window.NZ = window.NZ || {}));
