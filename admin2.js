/* Nazari Express — administration : comptes, invitations, réglages, quartiers, partenaires, annonces. */
(function (NZ) {
  'use strict';
  const U = NZ.ui, V = NZ.v;
  const { html, raw, str, ic, btn, field, fcfa, fwhen, fdate, empty, row, STATUS } = U;
  const ROLES = NZ.ROLES;
  const A = { roles: ['admin'] };
  const setMain = (h) => { const m = document.getElementById('main'); if (m) m.innerHTML = str(h); };
  const switchRow = (name, title, sub, on) => html`<div style="display:flex;align-items:center;gap:14px;margin-top:16px"><div style="flex:1"><div style="font-weight:700">${title}</div><div class="small muted">${sub}</div></div><label class="switch"><input type="checkbox" name="${name}"${on ? raw(' checked') : ''} aria-label="${title}"><i></i></label></div>`;

  /* =====================================================================
     Comptes : équipe et clients
     ===================================================================== */
  const US = { role: '', q: '', items: [] };
  let usTimer = null;
  const usChips = () => html`<div class="filters">${[['', 'Tous'], ['client', 'Clients'], ['driver', 'Livreurs'], ['admin', 'Admins']].map(([v, t]) => html`<button type="button" class="fchip${US.role === v ? ' on' : ''}" data-act="us-role" data-v="${v}">${t}</button>`)}</div>`;
  const usList = () => (US.items.length ? html`<div class="list">${US.items.map((u) => row({
    icon: u.role === 'client' ? 'user' : u.role === 'driver' ? 'truck' : 'shield', tone: u.active ? '' : 'red',
    title: u.name, chip: u.role !== 'client' ? html`<span class="chip plain">${ROLES[u.role]}</span>` : '', sub: '+227 ' + U.fphone(u.phone) + ' · ' + u.orders + ' commande' + (u.orders > 1 ? 's' : ''),
    act: 'us-open', id: u.id, end: u.active ? '' : html`<span class="chip cancelled">Désactivé</span>`,
  }))}</div>` : empty('users', 'Aucun compte', 'Aucun résultat pour cette recherche.'));
  async function usLoad() {
    const a = { limit: 100 };
    if (US.role) a.role = US.role;
    if (US.q.trim()) a.q = US.q.trim();
    const r = await NZ.api('admin.users', a);
    US.items = r.items;
    const l = document.getElementById('us-list'); if (l) l.innerHTML = str(usList());
    const c = document.getElementById('us-chips'); if (c) c.innerHTML = str(usChips());
  }
  NZ.route('/admin/users', async (ctx) => {
    ctx.shell({ title: 'Équipe et clients', back: '#/admin/more', tab: 'more' });
    ctx.main(html`<div id="us-chips">${usChips()}</div>
      <input class="input" type="search" data-bind="q" value="${US.q}" placeholder="Nom ou téléphone" aria-label="Rechercher un compte" autocomplete="off" style="margin-bottom:14px">
      <div id="us-list">${U.skeleton(3)}</div>`);
    NZ.bindTarget = US;
    NZ.onBind = () => { clearTimeout(usTimer); usTimer = setTimeout(() => usLoad().catch((e) => U.toast(e.message, 'err')), 350); };
    try { await usLoad(); } catch (e) { ctx.fail(e); }
  }, A);
  NZ.act('us-role', (el) => { US.role = el.dataset.v; usLoad().catch((e) => U.toast(e.message, 'err')); });
  NZ.act('us-open', (el) => {
    const u = US.items.find((x) => x.id === el.dataset.id);
    if (!u) return;
    const self = u.id === NZ.user().id;
    const reveal = u.role === 'client' ? 'driver,admin' : u.role === 'driver' ? 'admin' : 'driver';
    U.openOverlay(html`<h2>${u.name}</h2><p class="muted small">+227 ${U.fphone(u.phone)} · ${ROLES[u.role]} · inscrit le ${fdate(u.created_at)} · ${u.orders} commande${u.orders > 1 ? 's' : ''}</p>
      ${V.callRow(u.phone, 'Bonjour ' + u.name + ', ', 'Appeler')}
      ${self ? html`<div style="margin-top:14px">${V.notice('C\'est votre compte : vous ne pouvez pas modifier votre propre rôle ni le désactiver.')}</div>` : ''}
      <form data-submit="us-save" novalidate style="margin-top:14px"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="orig_role" value="${u.role}"><input type="hidden" name="orig_name" value="${u.name}"><input type="hidden" name="orig_active" value="${u.active ? '1' : '0'}">
        ${field({ label: 'Nom', name: 'name', value: u.name, maxlength: 60 })}
        ${self ? '' : html`${field({ label: 'Rôle', kind: 'select', name: 'role', value: u.role, options: [{ v: 'client', t: 'Client' }, { v: 'driver', t: 'Livreur' }, { v: 'admin', t: 'Administrateur' }], attrs: 'data-reveal="us-pin:' + reveal + '"' })}
          <div id="us-pin" hidden>${field({ label: 'Nouveau code PIN du compte', kind: 'pin', name: 'pin', maxlength: 10, autocomplete: 'new-password', hint: 'Obligatoire : un compte de l\'équipe a un code de 6 à 10 chiffres, pas trop simple (pas 123456). Transmettez-le à la personne.' })}</div>
          ${switchRow('active', 'Compte actif', 'Un compte désactivé ne peut plus se connecter.', u.active)}`}
        <div class="btn-row" style="margin-top:18px">${btn({ label: 'Fermer', kind: 'ghost', act: 'overlay-close' })}${btn({ label: 'Enregistrer', type: 'submit' })}</div></form>
      ${self ? html`<p class="small muted" style="margin-top:14px">Pour changer votre propre code : « Mon compte » → « Changer mon code PIN ».</p>` : html`<div style="margin-top:14px">${btn({ label: 'Réinitialiser le code PIN', kind: 'ghost', full: true, icon: 'lock', act: 'us-pin', id: u.id })}</div>`}`);
  });
  NZ.submit('us-save', async (f) => {
    const d = U.formData(f);
    const patch = { id: d.id };
    if (d.name.trim() !== d.orig_name) patch.name = d.name.trim();
    if (d.role && d.role !== d.orig_role) { patch.role = d.role; if (d.role !== 'client') { if (!/^\d{6,10}$/.test(d.pin || '')) return U.toast('Entrez un code PIN de 6 à 10 chiffres pour ce compte.', 'err'); if (NZ.weakPin(d.pin)) return U.toast(NZ.WEAK_PIN_MSG, 'err'); patch.pin = d.pin; } }
    if (d.role !== undefined && (d.active ? '1' : '0') !== d.orig_active) patch.active = !!d.active;
    if (Object.keys(patch).length === 1) { U.closeOverlay(); return; }
    await U.busy(f.querySelector('button[type=submit]'), async () => {
      try { await NZ.api('admin.user.update', patch); U.closeOverlay(); U.toast('Compte mis à jour', 'ok'); await usLoad(); } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.act('us-pin', (el) => {
    const u = US.items.find((x) => x.id === el.dataset.id);
    if (!u) return;
    const staff = u.role !== 'client';
    U.openOverlay(html`<h2>Nouveau code PIN</h2><p class="muted" style="margin-bottom:12px">Pour ${u.name}. Tous ses appareils seront déconnectés.</p>
      <form data-submit="us-pin" novalidate><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="staff" value="${staff ? '1' : '0'}">
        ${field({ label: 'Nouveau code PIN', kind: 'pin', name: 'pin', maxlength: 10, autocomplete: 'new-password', hint: (staff ? '6 à 10 chiffres' : '4 à 8 chiffres') + ', pas trop simple (évitez 1234, 0000).' })}
        <div class="btn-row" style="margin-top:16px">${btn({ label: 'Annuler', kind: 'ghost', act: 'overlay-close' })}${btn({ label: 'Enregistrer', type: 'submit' })}</div></form>`);
  });
  NZ.submit('us-pin', async (f) => {
    const d = U.formData(f);
    if (!(d.staff === '1' ? /^\d{6,10}$/ : /^\d{4,8}$/).test(d.pin)) return U.toast(d.staff === '1' ? 'Le code doit contenir 6 à 10 chiffres.' : 'Le code doit contenir 4 à 8 chiffres.', 'err');
    if (NZ.weakPin(d.pin)) return U.toast(NZ.WEAK_PIN_MSG, 'err');
    await U.busy(f.querySelector('button[type=submit]'), async () => {
      try { await NZ.api('admin.user.pin', { id: d.id, pin: d.pin }); U.closeOverlay(); U.toast('Code PIN modifié', 'ok'); } catch (e) { U.toast(e.message, 'err'); }
    });
  });

  /* =====================================================================
     Invitations
     ===================================================================== */
  const INV_STATE = { active: ['Active', 'accepted'], used: ['Utilisée', 'delivered'], expired: ['Expirée', 'plain'], revoked: ['Annulée', 'cancelled'] };
  let INV = [];
  const invView = () => html`<div style="margin-bottom:14px">${btn({ label: 'Nouvelle invitation', full: true, icon: 'plus', act: 'inv-new' })}</div>
    ${INV.length ? html`<div class="list">${INV.map((i) => row({
      icon: 'key', title: ROLES[i.role] + (i.note ? ' · ' + i.note : ''),
      sub: i.state === 'used' ? 'Utilisée par ' + (i.used_by || '—') + ' le ' + fdate(i.used_at) : i.state === 'active' ? 'Valable jusqu\'au ' + fdate(i.expires_at) : 'Créée le ' + fdate(i.created_at),
      end: html`<span class="chip ${INV_STATE[i.state][1]}">${INV_STATE[i.state][0]}</span>`, noArrow: true, act: i.state === 'active' ? 'inv-open' : 'noop', id: i.id,
    }))}</div>` : empty('key', 'Aucune invitation', 'Créez un code pour ajouter un livreur ou un administrateur.')}
    <p class="small muted" style="margin-top:12px">Un code ne sert qu'une seule fois. Pour des raisons de sécurité, il n'est affiché qu'à sa création.</p>`;
  NZ.route('/admin/invites', async (ctx) => {
    ctx.shell({ title: 'Invitations', back: '#/admin/more', tab: 'more' });
    try { INV = (await NZ.api('admin.invite.list')).items; ctx.main(invView()); } catch (e) { ctx.fail(e); }
  }, A);
  NZ.act('inv-new', () => {
    U.openOverlay(html`<h2>Nouvelle invitation</h2><form data-submit="inv-create" novalidate>
      ${field({ label: 'Rôle', kind: 'select', name: 'role', value: 'driver', options: [{ v: 'driver', t: 'Livreur' }, { v: 'admin', t: 'Administrateur' }] })}
      ${field({ label: 'Pour qui ?', name: 'note', placeholder: 'Ex. Moussa, moto', optional: true, maxlength: 60 })}
      ${field({ label: 'Valable pendant', kind: 'select', name: 'days', value: '14', options: [['3', '3 jours'], ['7', '7 jours'], ['14', '14 jours'], ['30', '30 jours']].map(([v, t]) => ({ v, t })) })}
      <div class="btn-row" style="margin-top:16px">${btn({ label: 'Annuler', kind: 'ghost', act: 'overlay-close' })}${btn({ label: 'Créer le code', type: 'submit' })}</div></form>`);
  });
  NZ.submit('inv-create', async (f) => {
    const d = U.formData(f);
    await U.busy(f.querySelector('button[type=submit]'), async () => {
      try {
        const r = await NZ.api('admin.invite.create', { role: d.role, note: d.note, days: d.days });
        INV = (await NZ.api('admin.invite.list')).items; setMain(invView());
        const url = location.origin + location.pathname + '#/register';
        const msg = 'Bonjour ! Voici votre code d\'invitation ' + NZ.company().name + ' (' + ROLES[r.role].toLowerCase() + ') : ' + r.code + '\nCréez votre compte ici : ' + url + '\nChoisissez « J\'ai un code d\'invitation » puis saisissez le code. Valable jusqu\'au ' + fdate(r.expires_at) + '.';
        U.openOverlay(html`<h2>Code créé</h2><p class="muted">Copiez-le maintenant : il ne sera plus affiché ensuite.</p><div class="code-box num" id="inv-code">${r.code}</div>
          <p class="small muted center">${ROLES[r.role]} · valable jusqu'au ${fdate(r.expires_at)}</p>
          <div class="stack" style="margin-top:14px">${btn({ label: 'Copier le code', full: true, icon: 'copy', act: 'copy-text', data: { text: r.code } })}
            ${btn({ label: 'Envoyer par WhatsApp', kind: 'wa', full: true, icon: 'wa', href: 'https://wa.me/?text=' + encodeURIComponent(msg) })}
            ${btn({ label: 'Fermer', kind: 'ghost', full: true, act: 'overlay-close' })}</div>`, { focus: false });
      } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.act('copy-text', (el) => U.copyText(el.dataset.text));
  NZ.act('inv-open', async (el) => {
    const ok = await U.confirmBox({ title: 'Annuler cette invitation ?', text: 'Le code ne pourra plus être utilisé.', ok: 'Annuler l\'invitation', cancel: 'Garder', danger: true });
    if (!ok) return;
    try { INV = (await NZ.api('admin.invite.revoke', { id: el.dataset.id })).items; setMain(invView()); U.toast('Invitation annulée', 'ok'); } catch (e) { U.toast(e.message, 'err'); }
  });

  /* =====================================================================
     Réglages et tarifs
     ===================================================================== */
  const PRICE_FIELDS = [['price_small', 'Petit (0-5 kg)'], ['price_medium', 'Moyen (5-10 kg)'], ['price_large', 'Grand (10-20 kg)'], ['price_xl', 'Très grand (+20 kg)'], ['pharmacy_fee', 'Pharmacie'], ['express_fee', 'Express (supplément)'], ['far_fee', 'Zone éloignée (supplément)']];
  NZ.route('/admin/config', async (ctx) => {
    ctx.shell({ title: 'Configuration', back: '#/admin/more', tab: 'more' });
    let cat;
    try { cat = await NZ.api('admin.catalog'); } catch (e) { return ctx.fail(e); }
    const c = cat.config;
    ctx.main(html`<form data-submit="cfg-save" novalidate class="stack-lg">
      <div class="card"><div class="h2" style="margin-bottom:12px">Informations de l'entreprise</div>
        ${field({ label: 'Nom de l\'entreprise', name: 'company_name', value: c.company_name, maxlength: 40 })}
        ${field({ label: 'Slogan', name: 'tagline', value: c.tagline, maxlength: 80 })}
        ${field({ label: 'WhatsApp (avec indicatif +227)', name: 'whatsapp', value: c.whatsapp, type: 'tel', inputmode: 'numeric', placeholder: '22796123456', hint: 'Les clients vous écrivent sur ce numéro. Exemple : 22796123456' })}</div>
      <div class="card"><div class="h2" style="margin-bottom:12px">Tarifs (FCFA)</div>
        <div class="grid2">${PRICE_FIELDS.map(([k, l]) => field({ label: l, name: k, value: c[k], inputmode: 'numeric' }))}</div></div>
      <div class="card"><div class="h2" style="margin-bottom:6px">Villes desservies par les agences</div>
        ${field({ label: 'Une ville par ligne', kind: 'textarea', name: 'cities', value: (c.cities || []).join('\n'), rows: 6 })}</div>
      <div class="card"><div style="display:flex;align-items:center;gap:14px"><div style="flex:1"><div style="font-weight:700">Mode maintenance</div><div class="small muted">Désactive temporairement les nouvelles commandes</div></div><label class="switch"><input type="checkbox" name="maintenance"${c.maintenance ? raw(' checked') : ''} aria-label="Mode maintenance"><i></i></label></div></div>
      ${btn({ label: 'Enregistrer', type: 'submit', full: true, size: 'lg' })}</form>`);
  }, A);
  NZ.submit('cfg-save', async (f) => {
    const d = U.formData(f);
    const body = { company_name: d.company_name, tagline: d.tagline, whatsapp: d.whatsapp.replace(/\D/g, ''), maintenance: !!d.maintenance, cities: d.cities.split(/\n|,/).map((s) => s.trim()).filter(Boolean) };
    for (const [k] of PRICE_FIELDS) {
      const v = String(d[k]).replace(/[\s ]/g, '');
      if (!/^\d{1,8}$/.test(v)) return U.toast('Tous les tarifs doivent être des nombres entiers.', 'err');
      body[k] = v;
    }
    await U.busy(f.querySelector('button[type=submit]'), async () => {
      try { await NZ.api('admin.config.set', body); await NZ.loadConfig(); U.toast('Réglages enregistrés', 'ok'); } catch (e) { U.toast(e.message, 'err'); }
    });
  });

  /* =====================================================================
     Quartiers
     ===================================================================== */
  let CAT = null;
  const zoneView = () => {
    const f = NZ.prices().far;
    return html`<div style="margin-bottom:14px">${btn({ label: 'Ajouter un quartier', full: true, icon: 'plus', act: 'zone-edit' })}</div>
      ${CAT.pending_zones.length ? html`<div class="card" style="margin-bottom:14px"><div class="h2">Quartiers saisis par les clients</div><p class="small muted" style="margin:2px 0 10px">Touchez un quartier pour l'ajouter à la liste.</p>
        <div class="addr-chips">${CAT.pending_zones.map((z) => html`<button type="button" data-act="zone-edit" data-name="${z.name}">${z.name} · ${z.count}</button>`)}</div></div>` : ''}
      ${CAT.quartiers.length ? html`<div class="list">${CAT.quartiers.map((q) => row({ icon: 'pin', tone: q.active ? '' : 'red', title: q.name, sub: q.far ? 'Zone éloignée · + ' + fcfa(f) : 'Zone normale', act: 'zone-edit', id: q.id, end: q.active ? '' : html`<span class="chip cancelled">Masqué</span>` }))}</div>` : empty('map', 'Aucun quartier', 'Ajoutez les quartiers où vous livrez.')}`;
  };
  NZ.route('/admin/zones', async (ctx) => {
    ctx.shell({ title: 'Quartiers', back: '#/admin/more', tab: 'more' });
    try { CAT = await NZ.api('admin.catalog'); ctx.main(zoneView()); } catch (e) { ctx.fail(e); }
  }, A);
  NZ.act('zone-edit', (el) => {
    const q = el.dataset.id ? CAT.quartiers.find((x) => x.id === el.dataset.id) : { name: el.dataset.name || '', far: false, active: true };
    U.openOverlay(html`<h2>${q.id ? 'Modifier le quartier' : 'Nouveau quartier'}</h2><form data-submit="zone-save" novalidate><input type="hidden" name="id" value="${q.id || ''}">
      ${field({ label: 'Nom du quartier', name: 'name', value: q.name, maxlength: 40 })}
      ${switchRow('far', 'Zone éloignée', 'Ajoute le supplément de zone éloignée à la commande', q.far)}
      ${q.id ? switchRow('active', 'Visible pour les clients', 'Masqué : le quartier n\'apparaît plus dans la liste', q.active) : ''}
      <div class="btn-row" style="margin-top:18px">${q.id ? btn({ label: 'Supprimer', kind: 'danger', act: 'zone-del', id: q.id }) : btn({ label: 'Annuler', kind: 'ghost', act: 'overlay-close' })}${btn({ label: 'Enregistrer', type: 'submit' })}</div></form>`);
  });
  NZ.submit('zone-save', async (f) => {
    const d = U.formData(f);
    if (d.name.trim().length < 2) return U.toast('Nom du quartier trop court.', 'err');
    await U.busy(f.querySelector('button[type=submit]'), async () => {
      try {
        const body = { name: d.name, far: !!d.far };
        if (d.id) { body.id = d.id; body.active = !!d.active; }
        CAT = await NZ.api('admin.quartier.save', body); U.closeOverlay(); setMain(zoneView()); NZ.loadConfig().catch(() => {}); U.toast('Quartier enregistré', 'ok');
      } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.act('zone-del', async (el) => {
    const id = el.dataset.id;
    const ok = await U.confirmBox({ title: 'Supprimer ce quartier ?', text: 'Les commandes déjà passées ne changent pas.', ok: 'Supprimer', danger: true });
    if (!ok) return;
    try { CAT = await NZ.api('admin.quartier.delete', { id }); setMain(zoneView()); NZ.loadConfig().catch(() => {}); U.toast('Quartier supprimé', 'ok'); } catch (e) { U.toast(e.message, 'err'); }
  });

  /* =====================================================================
     Agences et pharmacies partenaires
     ===================================================================== */
  const PT = { kind: 'agency' };
  const ptView = () => {
    const list = CAT.partners.filter((p) => p.kind === PT.kind);
    return html`<div class="filters"><button type="button" class="fchip${PT.kind === 'agency' ? ' on' : ''}" data-act="pt-kind" data-v="agency">Agences</button><button type="button" class="fchip${PT.kind === 'pharmacy' ? ' on' : ''}" data-act="pt-kind" data-v="pharmacy">Pharmacies</button></div>
      <div style="margin-bottom:14px">${btn({ label: PT.kind === 'agency' ? 'Ajouter une agence' : 'Ajouter une pharmacie', full: true, icon: 'plus', act: 'pt-edit' })}</div>
      ${list.length ? html`<div class="list">${list.map((p) => row({ icon: p.kind === 'agency' ? 'bus' : 'cross', tone: p.active ? '' : 'red', title: p.name, sub: [p.quartier, p.kind === 'agency' && p.destinations.length ? p.destinations.length + ' ville' + (p.destinations.length > 1 ? 's' : '') : ''].filter(Boolean).join(' · ') || 'À compléter', act: 'pt-edit', id: p.id, end: p.active ? '' : html`<span class="chip cancelled">Masquée</span>` }))}</div>`
        : empty(PT.kind === 'agency' ? 'bus' : 'cross', PT.kind === 'agency' ? 'Aucune agence' : 'Aucune pharmacie', 'Ajoutez vos partenaires : les clients pourront les choisir dans une liste.')}`;
  };
  NZ.route('/admin/partners', async (ctx) => {
    ctx.shell({ title: 'Agences et pharmacies', back: '#/admin/more', tab: 'more' });
    try { CAT = await NZ.api('admin.catalog'); ctx.main(ptView()); } catch (e) { ctx.fail(e); }
  }, A);
  NZ.act('pt-kind', (el) => { PT.kind = el.dataset.v; setMain(ptView()); });
  NZ.act('pt-edit', (el) => {
    const p = el.dataset.id ? CAT.partners.find((x) => x.id === el.dataset.id) : { kind: PT.kind, name: '', phone: '', quartier: '', address: '', destinations: [], active: true };
    const known = CAT.quartiers.find((q) => q.name.toLowerCase() === String(p.quartier || '').toLowerCase());
    const qv = p.quartier ? (known ? known.name : '__other') : '';
    const ag = p.kind === 'agency';
    U.openOverlay(html`<h2>${p.id ? 'Modifier' : (ag ? 'Nouvelle agence' : 'Nouvelle pharmacie')}</h2><form data-submit="pt-save" novalidate><input type="hidden" name="id" value="${p.id || ''}"><input type="hidden" name="kind" value="${p.kind}">
      ${field({ label: 'Nom', name: 'name', value: p.name, maxlength: 60, placeholder: ag ? 'Ex. Rimbo Transport' : 'Ex. Pharmacie du Marché' })}
      ${field({ label: 'Téléphone', kind: 'phone', name: 'phone', value: p.phone, optional: true })}
      ${V.quartierField({ label: 'Quartier', id: 'pt-q-other', value: qv, other: qv === '__other' ? p.quartier : '', nameQ: 'quartier', nameO: 'other' })}
      ${field({ label: 'Adresse', name: 'address', value: p.address, optional: true, maxlength: 120, placeholder: 'Ex. face à la gare routière' })}
      ${ag ? field({ label: 'Villes desservies', kind: 'textarea', name: 'destinations', value: (p.destinations || []).join('\n'), rows: 4, optional: true, hint: 'Une ville par ligne. Laissez vide pour proposer toutes les villes.' }) : ''}
      ${switchRow('active', 'Visible pour les clients', 'Masquée : n\'apparaît plus dans la liste', p.active)}
      <div class="btn-row" style="margin-top:18px">${p.id ? btn({ label: 'Supprimer', kind: 'danger', act: 'pt-del', id: p.id }) : btn({ label: 'Annuler', kind: 'ghost', act: 'overlay-close' })}${btn({ label: 'Enregistrer', type: 'submit' })}</div></form>`);
  });
  NZ.submit('pt-save', async (f) => {
    const d = U.formData(f);
    if (d.name.trim().length < 2) return U.toast('Entrez le nom.', 'err');
    const q = d.quartier === '__other' ? (d.other || '').trim() : d.quartier;
    await U.busy(f.querySelector('button[type=submit]'), async () => {
      try {
        const body = { id: d.id || undefined, kind: d.kind, name: d.name, phone: d.phone, quartier: q, address: d.address, active: !!d.active };
        if (d.kind === 'agency') body.destinations = (d.destinations || '').split(/\n|,/).map((s) => s.trim()).filter(Boolean);
        CAT = await NZ.api('admin.partner.save', body); U.closeOverlay(); setMain(ptView()); NZ.loadConfig().catch(() => {}); U.toast('Enregistré', 'ok');
      } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.act('pt-del', async (el) => {
    const id = el.dataset.id;
    const ok = await U.confirmBox({ title: 'Supprimer ce partenaire ?', text: 'Les commandes déjà passées gardent son nom.', ok: 'Supprimer', danger: true });
    if (!ok) return;
    try { CAT = await NZ.api('admin.partner.delete', { id }); setMain(ptView()); NZ.loadConfig().catch(() => {}); U.toast('Supprimé', 'ok'); } catch (e) { U.toast(e.message, 'err'); }
  });

  /* =====================================================================
     Annonces
     ===================================================================== */
  NZ.route('/admin/announce', (ctx) => {
    ctx.shell({ title: 'Annonces', back: '#/admin/more', tab: 'more', skeleton: false });
    ctx.main(html`<form class="card" data-submit="announce" novalidate>
      <p class="muted" style="margin-bottom:14px">Le message apparaît dans la rubrique « Messages » de chaque personne.</p>
      ${field({ label: 'Titre', name: 'title', maxlength: 60, placeholder: 'Ex. Nouveaux tarifs dès lundi' })}
      ${field({ label: 'Message', kind: 'textarea', name: 'body', rows: 4, maxlength: 300, optional: true })}
      ${field({ label: 'Destinataires', kind: 'select', name: 'audience', value: 'clients', options: [{ v: 'clients', t: 'Tous les clients' }, { v: 'drivers', t: 'Livreurs et équipe' }, { v: 'all', t: 'Tout le monde' }] })}
      <div style="margin-top:16px">${btn({ label: 'Envoyer', type: 'submit', full: true, size: 'lg', icon: 'send' })}</div></form>`);
  }, A);
  NZ.submit('announce', async (f) => {
    const d = U.formData(f);
    if (d.title.trim().length < 3) return U.toast('Écrivez un titre (3 lettres minimum).', 'err');
    const ok = await U.confirmBox({ title: 'Envoyer cette annonce ?', text: 'Elle sera visible tout de suite par les destinataires choisis.', ok: 'Envoyer' });
    if (!ok) return;
    await U.busy(f.querySelector('button[type=submit]'), async () => {
      try { const r = await NZ.api('admin.announce', d); U.toast('Annonce envoyée à ' + r.sent + ' personne' + (r.sent > 1 ? 's' : ''), 'ok'); f.reset(); } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  /* =====================================================================
     Journal d'activité : qui a changé quoi, et quand
     ===================================================================== */
  const LOG_LABEL = {
    'order.update': ['Commande modifiée', 'box'], 'user.update': ['Compte modifié', 'users'], 'user.pin': ['Code PIN réinitialisé', 'lock'],
    'invite.create': ['Invitation créée', 'key'], 'invite.revoke': ['Invitation annulée', 'key'], 'config.set': ['Réglages modifiés', 'sliders'],
    'quartier.save': ['Quartier enregistré', 'map'], 'quartier.delete': ['Quartier supprimé', 'map'],
    'partner.save': ['Partenaire enregistré', 'bus'], 'partner.delete': ['Partenaire supprimé', 'bus'], 'announce': ['Annonce envoyée', 'mega'],
  };
  const CFG_LABEL = { price_small: 'Prix 0–5 kg', price_medium: 'Prix 5–10 kg', price_large: 'Prix 10–20 kg', price_xl: 'Prix + de 20 kg', express_fee: 'Express', far_fee: 'Zone éloignée', pharmacy_fee: 'Pharmacie' };
  const AUD = { clients: 'aux clients', drivers: 'à l\'équipe', all: 'à tout le monde' };
  function logDetail(x) {
    const d = x.detail || {}, out = [];
    const st = (k) => STATUS[k] || k;
    if (x.action === 'order.update') {
      if (d.status_to) out.push(st(d.status_from) + ' → ' + st(d.status_to));
      if (d.total_to != null) out.push('Total ' + fcfa(d.total_from) + ' → ' + fcfa(d.total_to));
      if ('driver' in d) out.push(d.driver ? 'Livreur : ' + d.driver : 'Livreur retiré');
      if (d.note_changed) out.push('Note interne modifiée');
    } else if (x.action === 'user.update') {
      if (d.name) out.push('Nom : ' + d.name);
      if (d.role_to) out.push(ROLES[d.role_from] + ' → ' + ROLES[d.role_to]);
      if ('active' in d) out.push(d.active ? 'Compte réactivé' : 'Compte désactivé');
    } else if (x.action === 'user.pin') {
      out.push('Tous ses appareils ont été déconnectés');
    } else if (x.action === 'invite.revoke') {
      out.push(ROLES[d.role] || d.role || '');
    } else if (x.action === 'invite.create') {
      out.push((ROLES[d.role] || d.role) + ' · valable ' + d.days + ' jour' + (d.days > 1 ? 's' : ''));
    } else if (x.action === 'config.set') {
      Object.keys(d).forEach((k) => {
        if (CFG_LABEL[k]) out.push(CFG_LABEL[k] + ' : ' + fcfa(d[k]));
        else if (k === 'maintenance') out.push(d[k] ? 'Maintenance activée' : 'Maintenance désactivée');
        else out.push({ company_name: 'Nom', tagline: 'Slogan', whatsapp: 'Numéro WhatsApp', cities: 'Villes' }[k] + ' modifié');
      });
    } else if (x.action === 'quartier.save') {
      out.push(d.far ? 'Zone éloignée' : 'Zone normale');
    } else if (x.action === 'partner.save') {
      out.push((d.kind === 'pharmacy' ? 'Pharmacie' : 'Agence') + (d.new ? ' ajoutée' : ' modifiée'));
    } else if (x.action === 'announce') {
      out.push('Envoyée ' + (AUD[d.audience] || '') + ' (' + d.sent + ' personne' + (d.sent > 1 ? 's' : '') + ')');
    }
    return out.join(' · ');
  }
  let LG = { items: [], more: false };
  const logView = () => html`${LG.items.length ? html`<div class="list">${LG.items.map((x) => {
      const [label, icon] = LOG_LABEL[x.action] || [x.action, 'list'];
      const target = String(x.action).indexOf('invite.') === 0 ? String(x.target || '').replace(/^(admin|driver)( · )?/, '') : x.target;
      return row({ icon, title: label, sub: [target, logDetail(x), x.admin + ' · ' + fwhen(x.at)].filter(Boolean).join(' — '), noArrow: true, wrap: true, act: 'noop' });
    })}</div>` : empty('list', 'Rien pour le moment', 'Les changements faits par l\'équipe apparaîtront ici.')}
    ${LG.more ? html`<div style="margin-top:12px">${btn({ label: 'Voir plus', kind: 'ghost', full: true, act: 'log-more' })}</div>` : ''}
    <p class="small muted" style="margin-top:12px">Les codes PIN et les codes d'invitation ne sont jamais enregistrés ici.</p>`;
  NZ.route('/admin/log', async (ctx) => {
    ctx.shell({ title: 'Journal d\'activité', back: '#/admin/more', tab: 'more' });
    try { const r = await NZ.api('admin.log', { limit: 40 }); LG = { items: r.items, more: r.items.length === 40 }; ctx.main(logView()); } catch (e) { ctx.fail(e); }
  }, A);
  NZ.act('log-more', async (el) => {
    await U.busy(el, async () => {
      try {
        const r = await NZ.api('admin.log', { limit: 40, offset: LG.items.length });
        LG.items = LG.items.concat(r.items); LG.more = r.items.length === 40;
        const m = document.getElementById('main'); if (m) m.innerHTML = str(logView());
      } catch (e) { U.toast(e.message, 'err'); }
    });
  });
})((window.NZ = window.NZ || {}));
