/* Nazari Express — espace livreur : courses à prendre, courses en cours, livrées. */
(function (NZ) {
  'use strict';
  const U = NZ.ui, V = NZ.v;
  const { html, str, ic, btn, field, fcfa, fwhen, empty, statusChip, SERVICE } = U;

  const mapsHref = (...parts) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(parts.filter(Boolean).concat(['Agadez', 'Niger']).join(', '));

  /* =====================================================================
     Liste des courses
     ===================================================================== */
  let DL = { scope: null, items: [] };
  const counts = () => (NZ.me && NZ.me.counts) || {};
  const dlCard = (o) => V.orderCard(o, '#/driver/order/' + o.id, {
    amount: 'À encaisser ' + fcfa(o.fees.total),
    extra: o.sealed ? html`<div style="margin-top:6px"><span class="sealed">${ic('lock', 14)}Commande scellée</span></div>` : '',
  });
  const dlView = () => {
    const c = counts();
    const chip = (v, t, n) => html`<button type="button" class="fchip${DL.scope === v ? ' on' : ''}" data-act="dl-scope" data-v="${v}">${t}${n ? ' (' + n + ')' : ''}</button>`;
    const emptyMsg = { available: ['À prendre', 'Aucune course à prendre', 'Les nouvelles courses validées apparaissent ici.'], mine: ['Mes courses', 'Aucune course en cours', 'Prenez une course dans l\'onglet « À prendre ».'], done: ['Livrées', 'Aucune livraison terminée', 'Vos dernières livraisons apparaîtront ici.'] }[DL.scope];
    return html`<div class="filters">${chip('available', 'À prendre', c.available)}${chip('mine', 'Mes courses', c.mine)}${chip('done', 'Livrées')}</div>
      ${DL.items.length ? DL.items.map(dlCard) : empty('truck', emptyMsg[1], emptyMsg[2])}`;
  };
  NZ.route('/driver', async (ctx) => {
    ctx.shell({ title: 'Courses', tab: 'courses' });
    await NZ.refreshMe();
    if (!DL.scope) DL.scope = counts().mine > 0 ? 'mine' : 'available';
    let sig = '';
    const load = async (force) => {
      const r = await NZ.api('driver.list', { scope: DL.scope });
      DL.items = r.items;
      const s = DL.scope + JSON.stringify(r.items) + JSON.stringify(counts());
      if (force || s !== sig) { sig = s; NZ.scrollKeep(() => ctx.main(dlView())); }
    };
    NZ.dlLoad = load;
    try { await load(true); } catch (e) { return ctx.fail(e); }
    ctx.poll(10000, async () => { await NZ.refreshMe(); await load(false); });
  }, { roles: ['driver', 'admin'] });
  NZ.act('dl-scope', async (el) => {
    DL.scope = el.dataset.v;
    const m = document.getElementById('main'); if (m) m.innerHTML = str(dlView());
    try { await NZ.dlLoad(true); } catch (e) { U.toast(e.message, 'err'); }
  });

  /* =====================================================================
     Détail d'une course
     ===================================================================== */
  const placeCard = (title, o) => o.locked
    ? html`<div class="card"><div class="h2" style="margin-bottom:8px">${title}</div>
      ${o.name ? html`<div style="font-weight:700">${o.name}</div>` : ''}
      <div style="font-weight:700">${o.quartier || '—'}</div>
      <div class="muted small" style="margin-top:6px;display:flex;gap:6px;align-items:center">${ic('lock', 14)}<span>Adresse précise et contact masqués</span></div>
      ${o.extra || ''}</div>`
    : html`<div class="card"><div class="h2" style="margin-bottom:8px">${title}</div>
    <div style="font-weight:700">${o.name || '—'}</div>
    ${o.quartier ? html`<div>${o.quartier}</div>` : ''}${o.details ? html`<div class="muted">${o.details}</div>` : ''}
    ${o.phone ? html`<div class="muted" style="margin-top:2px">+227 ${U.fphone(o.phone)}</div>` : ''}
    ${o.extra || ''}
    <div class="actions">${o.phone ? btn({ href: U.telLink(o.phone), label: 'Appeler', kind: 'ghost', size: 'sm', icon: 'phone' }) : ''}${o.phone ? btn({ href: U.waLink(o.phone, o.wa || ''), label: 'WhatsApp', kind: 'ghost', size: 'sm', icon: 'wa' }) : ''}${btn({ href: mapsHref(o.details, o.quartier), label: 'Itinéraire', kind: 'ghost', size: 'sm', icon: 'map' })}</div></div>`;

  function driverOrderView(r) {
    const o = r.order, me = NZ.user();
    const s = SERVICE[o.service] || SERVICE.parcel;
    const mine = !!(o.driver && o.driver.id === me.id);
    const free = !o.driver && ['accepted', 'preparing'].includes(o.status);
    const dims = o.dims ? [o.dims.l, o.dims.w, o.dims.h].filter(Boolean).join(' × ') + ' cm' : '';
    const wa = 'Bonjour, je suis le livreur ' + NZ.company().name + ' pour la commande ' + o.code + '.';
    // tant que la course n'est pas la sienne (ou une fois terminée), le livreur ne voit que les quartiers
    const lock = o.contact_hidden ? (free ? 'Le nom, le téléphone et l\'adresse précise s\'affichent quand vous prenez la course.' : 'Les coordonnées ne sont plus affichées une fois la course terminée.') : '';

    let from, to;
    if (o.service === 'agency_pickup' || o.service === 'pharmacy') {
      from = placeCard(o.service === 'pharmacy' ? 'À récupérer à la pharmacie' : 'À récupérer à l\'agence', {
        name: o.partner_name, quartier: o.pickup.quartier, details: o.pickup.details, phone: o.pickup.phone, wa, locked: lock,
        extra: o.service === 'agency_pickup' && o.agency_ref ? html`<div class="notice warn" style="margin-top:10px">${ic('info', 18)}<div>Au nom / reçu : <b>${o.agency_ref}</b></div></div>`
          : o.service === 'pharmacy' ? html`<div style="margin-top:10px"><span class="sealed">${ic('lock', 14)}Commande scellée : à remettre fermée</span></div>` : '',
      });
    } else {
      from = placeCard('Enlèvement chez l\'expéditeur', { name: o.pickup.name, quartier: o.pickup.quartier, details: o.pickup.details, phone: o.pickup.phone, wa, locked: lock });
    }
    if (o.service === 'agency_drop') {
      to = placeCard('À déposer à l\'agence', {
        name: o.partner_name, quartier: o.drop.quartier, details: o.drop.details, phone: o.drop.phone, wa, locked: lock,
        extra: html`<div class="notice" style="margin-top:10px">${ic('bus', 18)}<div>Destination : <b>${o.agency_dest || '—'}</b>${o.contact_hidden ? '' : html`<br>Destinataire : ${o.dest_name || '—'}${o.dest_phone ? ' · +227 ' + U.fphone(o.dest_phone) : ''}`}</div></div>`,
      });
    } else {
      to = placeCard('Livraison au destinataire', { name: o.drop.name, quartier: o.drop.quartier, details: o.drop.details, phone: o.drop.phone, wa, locked: lock });
    }
    const flags = [o.express ? 'Express' : '', o.far ? 'Zone éloignée' : ''].filter(Boolean);
    const actions = free ? btn({ label: 'Prendre cette course', kind: 'primary', size: 'lg', full: true, act: 'drv-claim', id: o.id, icon: 'check' })
      : mine && ['accepted', 'preparing'].includes(o.status) ? html`${btn({ label: o.service === 'pharmacy' ? 'J\'ai récupéré la commande' : 'J\'ai récupéré le colis', size: 'lg', full: true, act: 'drv-pickup', id: o.id, icon: 'check' })}<div style="margin-top:10px">${btn({ label: 'Rendre cette course', kind: 'danger', full: true, act: 'drv-release', id: o.id })}</div>`
        : mine && o.status === 'in_delivery' ? btn({ label: 'Marquer comme livré', size: 'lg', full: true, act: 'drv-deliver', id: o.id, data: { total: o.fees.total }, icon: 'dcheck' }) : '';
    return html`<div class="stack">
      <div class="card"><div class="code-card" style="justify-content:space-between"><div style="display:flex;gap:12px;align-items:center"><span class="disc sm solid">${ic(s.icon, 20)}</span><div><div class="muted small">${s.long}</div><div class="h2 num">${o.code}</div></div></div>${statusChip(o.status)}</div>
        <div class="stat hot" style="margin-top:14px"><div class="v num">${fcfa(o.status === 'delivered' && o.collected != null ? o.collected : o.fees.total)}</div>
          <div class="l">${o.status === 'delivered' ? 'Encaissé' : 'À encaisser ' + (o.collect_at === 'pickup' ? 'à l\'enlèvement' : 'à la livraison')} · ${o.pay_method === 'mobile' ? 'mobile money' : 'espèces'}</div></div>
        ${flags.length ? html`<div class="actions" style="margin-top:10px">${flags.map((f) => html`<span class="chip warn">${f}</span>`)}</div>` : ''}</div>
      ${actions ? html`<div>${actions}</div>` : ''}
      ${lock ? html`<div class="notice">${ic('lock', 18)}<div>${lock}</div></div>` : ''}
      ${from}${to}
      ${o.service !== 'pharmacy' ? html`<div class="card"><div class="h2" style="margin-bottom:4px">Colis</div>${V.kv([['Poids', Number(o.weight_kg).toString().replace('.', ',') + ' kg'], ['Dimensions', dims], ['Contenu', o.desc], ['Message', o.note]])}</div>` : (o.note ? html`<div class="card"><div class="h2">Message</div><p>${o.note}</p></div>` : '')}
      ${o.status === 'delivered' ? html`<div class="card"><div class="h2" style="margin-bottom:6px">Livraison terminée</div><div class="muted">Livré ${fwhen(o.delivered_at)}</div></div>` : ''}
    </div>`;
  }
  NZ.route('/driver/order/:id', async (ctx) => {
    ctx.shell({ title: 'Course', back: '#/driver', tab: 'courses' });
    let sig = '';
    const load = async () => {
      const r = await NZ.api('order.get', { id: ctx.params.id });
      NZ.currentOrder = r;
      const s = JSON.stringify(r);
      if (s !== sig) { sig = s; NZ.scrollKeep(() => ctx.main(driverOrderView(r))); }
    };
    NZ.drvLoad = load;
    try { await load(); } catch (e) { return ctx.fail(e); }
    ctx.poll(10000, load);
  }, { roles: ['driver', 'admin'] });

  const act = async (el, action, args, okMsg) => {
    await U.busy(el, async () => {
      try { await NZ.api(action, args); if (okMsg) U.toast(okMsg, 'ok'); NZ.refreshMe(); await NZ.drvLoad(); } catch (e) { U.toast(e.message, 'err'); if (e.code === 'taken' || e.code === 'not_found' || e.code === 'bad_state') { try { await NZ.drvLoad(); } catch (e2) { /* ignore */ } } }
    });
  };
  NZ.act('drv-claim', (el) => act(el, 'driver.claim', { id: el.dataset.id }, 'Course prise. Bonne route !'));
  NZ.act('drv-pickup', (el) => act(el, 'driver.pickup', { id: el.dataset.id }, 'Colis récupéré. Le client est prévenu.'));
  NZ.act('drv-release', async (el) => {
    const ok = await U.confirmBox({ title: 'Rendre cette course ?', text: 'Elle sera de nouveau proposée aux autres livreurs.', ok: 'Rendre la course', cancel: 'Garder', danger: true });
    if (!ok) return;
    try { await NZ.api('driver.release', { id: el.dataset.id }); U.toast('Course rendue', 'ok'); NZ.refreshMe(); location.hash = '#/driver'; } catch (e) { U.toast(e.message, 'err'); }
  });
  NZ.act('drv-deliver', (el) => {
    const id = el.dataset.id, total = el.dataset.total;
    U.openOverlay(html`<h2>Confirmer la livraison</h2><p class="muted" style="margin-bottom:12px">Indiquez l'argent que vous avez encaissé auprès du client.</p>
      <form data-submit="drv-deliver" novalidate><input type="hidden" name="id" value="${id}"><input type="hidden" name="total" value="${total}">
        ${field({ label: 'Montant encaissé (FCFA)', name: 'collected', value: total, inputmode: 'numeric', hint: 'Total attendu : ' + fcfa(total) + '. Entrez 0 si rien n\'a été payé.', attrs: 'data-diff="dv-why:' + total + '"' })}
        <div id="dv-why" hidden style="margin-top:14px">${field({ label: 'Pourquoi ce montant est différent ?', kind: 'textarea', name: 'note', rows: 2, maxlength: 200, placeholder: 'Ex. le client n\'avait que 600 FCFA, il paiera demain', hint: 'Obligatoire : l\'équipe verra votre explication.' })}</div>
        <div class="btn-row" style="margin-top:16px">${btn({ label: 'Annuler', kind: 'ghost', act: 'overlay-close' })}${btn({ label: 'Livré', type: 'submit', icon: 'check' })}</div></form>`);
  });
  NZ.submit('drv-deliver', async (form) => {
    const d = U.formData(form);
    const v = String(d.collected).replace(/\s/g, '');
    if (!/^\d{1,9}$/.test(v)) return U.toast('Entrez le montant en chiffres (ex. 1500).', 'err');
    const differs = String(parseInt(v, 10)) !== String(parseInt(d.total, 10));
    if (differs && (d.note || '').trim().length < 3) { const w = document.getElementById('dv-why'); if (w) { w.hidden = false; const t = w.querySelector('textarea'); if (t) t.focus(); } return U.toast('Expliquez pourquoi le montant est différent du montant demandé.', 'err'); }
    await U.busy(form.querySelector('button[type=submit]'), async () => {
      try { await NZ.api('driver.deliver', differs ? { id: d.id, collected: v, note: d.note.trim() } : { id: d.id, collected: v }); U.closeOverlay(); U.toast('Livraison enregistrée. Merci !', 'ok'); NZ.refreshMe(); await NZ.drvLoad(); } catch (e) { U.toast(e.message, 'err'); }
    });
  });
})((window.NZ = window.NZ || {}));
