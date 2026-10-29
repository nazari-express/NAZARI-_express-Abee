/* Nazari Express — composants partagés (client, livreur, admin). */
(function (NZ) {
  'use strict';
  const U = NZ.ui;
  const { html, str, ic, fcfa, fwhen, ftime, SERVICE, statusChip, btn, telLink, waLink } = U;
  const V = (NZ.v = {});
  NZ.VERSION = '1.0.0';

  /* ---------- frise de suivi ---------- */
  const REACHED = {
    received: 'Commande reçue', accepted: 'Commande validée', preparing: 'En préparation',
    in_delivery: 'En cours de livraison', delivered: 'Livré', cancelled: 'Commande annulée',
  };
  const WAITING = {
    accepted: 'En attente de validation', preparing: 'En attente de la pharmacie',
    in_delivery: 'En attente du livreur', delivered: 'Livraison',
  };
  V.timeline = function (status, events, service) {
    const at = {};
    (events || []).forEach((e) => { if (!(e.status in at)) at[e.status] = e; });
    let steps = ['received', 'accepted'];
    if (service === 'pharmacy' || at.preparing || status === 'preparing') steps.push('preparing');
    steps.push('in_delivery', 'delivered');
    if (status === 'cancelled') {
      const last = (events || []).filter((e) => e.status !== 'cancelled' && steps.includes(e.status)).map((e) => steps.indexOf(e.status));
      const upto = last.length ? Math.max.apply(null, last) : 0;
      steps = steps.slice(0, upto + 1).concat('cancelled');
    }
    const idx = steps.indexOf(status);
    return html`<ol class="timeline">${steps.map((s, i) => {
      let cls;
      if (s === 'cancelled') cls = 'bad';
      else if (status === 'delivered' || (status !== 'cancelled' && i < idx) || status === 'cancelled') cls = 'done';
      else if (i === idx) cls = 'now';
      else cls = 'pending';
      const ev = at[s];
      const label = cls === 'pending' ? (WAITING[s] || REACHED[s]) : REACHED[s];
      const icon = cls === 'done' ? ic('check', 16) : cls === 'bad' ? ic('x', 16) : cls === 'pending' ? ic('plus', 14) : '';
      const note = s === 'cancelled' && ev && ev.note ? html`<div class="tm">Motif : ${ev.note}</div>` : '';
      return html`<li class="tl ${cls}"><span class="pt">${icon}</span><div class="lb">${label}</div><div class="tm">${ev ? fwhen(ev.at) : (cls === 'now' ? 'En cours' : '—')}</div>${note}</li>`;
    })}</ol>`;
  };

  /* ---------- codes PIN : mêmes règles que la base (la base reste l'autorité) ---------- */
  const WEAK_PINS = ['1004', '2580', '0852', '1357', '2468', '1379', '1313', '6969', '1470', '3690', '2001', '2000', '1020', '2020', '5683', '8520', '7410', '1590', '2222',
    '520131', '520520', '159753', '147258', '258369', '147852', '852456', '789456', '456123', '123321', '654123', '102030', '135790', '246810', '159357', '111222', '222333', '555666',
    '998877', '121314', '123654', '321654', '696969', '100200', '200300'];
  NZ.weakPin = (p) => /^(\d{1,5})\1+$/.test(p) || /^((\d)\2){2,5}$/.test(p) || '01234567890123456789'.includes(p) || '98765432109876543210'.includes(p) || WEAK_PINS.includes(p);
  NZ.WEAK_PIN_MSG = 'Ce code est trop simple (1234, 0000, chiffres qui se répètent…). Choisissez-en un autre.';

  /* ---------- lieux de départ / d'arrivée ---------- */
  V.fromText = (o) => {
    if (o.service === 'agency_pickup' || o.service === 'pharmacy') return [o.partner_name || (o.service === 'pharmacy' ? 'Pharmacie' : 'Agence'), o.pickup.quartier];
    return [o.pickup.quartier || '—', o.pickup.name];
  };
  V.toText = (o) => {
    if (o.service === 'agency_drop') return [o.partner_name || 'Agence', o.agency_dest ? '→ ' + o.agency_dest : ''];
    return [o.drop.quartier || '—', o.drop.name];
  };
  V.routeLine = (o) => V.fromText(o)[0] + ' → ' + V.toText(o)[0];
  V.sentenceCase = (s) => s;

  V.routeBlock = function (o, opts) {
    opts = opts || {};
    const withPhones = opts.phones !== false;
    const side = (label, who, place, sub1, sub2) => html`<dt>${label}</dt><dd>${place}${sub1 ? html`<small>${sub1}</small>` : ''}${sub2 ? html`<small>${sub2}</small>` : ''}</dd>`;
    const contact = (n, p) => [n, p ? '+227 ' + U.fphone(p) : ''].filter(Boolean).join(' · ');
    let from, to;
    if (o.service === 'agency_pickup' || o.service === 'pharmacy') {
      from = side('De', 'p', o.partner_name || 'Partenaire',
        [o.pickup.quartier, o.pickup.details].filter(Boolean).join(' · '),
        o.service === 'agency_pickup' && o.agency_ref ? 'Retrait au nom / reçu : ' + o.agency_ref : '');
    } else {
      from = side('De', 's', o.pickup.quartier || '—',
        o.pickup.details,
        withPhones ? contact(o.pickup.name, o.pickup.phone) : o.pickup.name);
    }
    if (o.service === 'agency_drop') {
      to = side('Vers', 'a', o.partner_name || 'Agence',
        [o.drop.quartier, o.drop.details].filter(Boolean).join(' · '),
        ['Destination : ' + (o.agency_dest || '—'), withPhones ? contact(o.dest_name, o.dest_phone) : o.dest_name].filter(Boolean).join(' — '));
    } else {
      to = side('Vers', 'r', o.drop.quartier || '—',
        o.drop.details,
        withPhones ? contact(o.drop.name, o.drop.phone) : o.drop.name);
    }
    return html`<dl class="route">${from}${to}</dl>`;
  };

  /* ---------- montants et paiement ---------- */
  V.payWhen = (o) => (o.collect_at === 'pickup' ? 'À l\'enlèvement' : 'À la livraison');
  V.payText = (o) => V.payWhen(o) + (o.pay_method === 'mobile' ? ' (mobile money)' : ' (espèces)');
  V.amountText = function (o) {
    const f = o.fees || {};
    if (o.service === 'pharmacy' && !f.items) return fcfa(f.delivery || f.total || 0) + ' + médicaments';
    return fcfa(f.total || 0) + (o.quote ? ' (à confirmer)' : '');
  };
  V.feeLines = function (o) {
    const f = o.fees;
    const L = [];
    if (f.base) L.push([o.service === 'pharmacy' ? 'Livraison pharmacie' : 'Livraison (' + (U.TIERS.find((t) => t.key === o.tier) || { range: '' }).range + ')', f.base]);
    if (f.express) L.push(['Express (même jour)', f.express]);
    if (f.far) L.push(['Zone éloignée', f.far]);
    if (f.adjust) L.push([f.adjust < 0 ? 'Remise' : 'Ajustement', f.adjust]);
    if (f.items) L.push(['Médicaments / produits', f.items]);
    return L;
  };
  V.feeBox = function (o, title) {
    const L = V.feeLines(o);
    return html`<div class="price-box">${title ? html`<div class="h2" style="margin-bottom:6px">${title}</div>` : ''}${L.map(([l, v]) => html`<div class="line"><span>${l}</span><span class="num">${v < 0 ? '− ' + fcfa(-v) : fcfa(v)}</span></div>`)}
      <div class="line tot"><span>Total à payer</span><span class="num">${fcfa(o.fees.total)}</span></div>
      ${o.quote ? html`<div class="small muted" style="margin-top:6px">Colis très volumineux : le prix final est confirmé par l'équipe avant l'enlèvement.</div>` : ''}
      ${o.service === 'pharmacy' && !o.fees.items ? html`<div class="small muted" style="margin-top:6px">Le montant des médicaments sera confirmé par message avant la livraison.</div>` : ''}</div>`;
  };

  /* ---------- contacts ---------- */
  V.callRow = function (phone, text, label) {
    if (!phone) return '';
    return html`<div class="actions">${btn({ href: telLink(phone), label: label || 'Appeler', kind: 'ghost', size: 'sm', icon: 'phone' })}${btn({ href: waLink(phone, text || ''), label: 'WhatsApp', kind: 'ghost', size: 'sm', icon: 'wa' })}</div>`;
  };

  /* ---------- carte de commande (listes) ---------- */
  V.serviceLine = function (o) {
    const s = SERVICE[o.service] || SERVICE.parcel;
    return o.service === 'pharmacy' ? s.t : s.t + ' · ' + Number(o.weight_kg).toString().replace('.', ',') + ' kg';
  };
  V.orderCard = function (o, href, opts) {
    opts = opts || {};
    const [fromP] = V.fromText(o);
    const [toP] = V.toText(o);
    const amount = opts.amount || V.amountText(o);
    return html`<a class="ocard" href="${href}"><div class="top"><span class="code num">${o.code}</span>${statusChip(o.status)}</div>
      <div class="meta">${V.serviceLine(o)}${o.express ? ' · Express' : ''}</div>
      <div class="meta" style="margin-top:2px">${fromP} → ${toP}</div>
      ${opts.extra || ''}
      <div class="sum"><span class="small muted" style="font-weight:500">${fwhen(o.created_at)}</span><span class="num">${amount}</span></div></a>`;
  };

  /* ---------- cases d'information ---------- */
  V.kv = (pairs) => html`<dl class="kv">${pairs.filter((p) => p && p[1] !== '' && p[1] != null).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`;
  V.notice = (text, kind, icon) => html`<div class="notice ${kind || ''}">${ic(icon || (kind === 'bad' ? 'alert' : kind === 'warn' ? 'info' : 'info'), 20)}<div>${text}</div></div>`;

  /* un quartier : liste + « Autre quartier… » */
  V.quartierOptions = function (value) {
    const q = (NZ.config && NZ.config.quartiers) || [];
    const opts = [{ v: '', t: 'Choisir un quartier' }].concat(q.map((x) => ({ v: x.name, t: x.name + (x.far ? ' (zone éloignée)' : '') })), [{ v: '__other', t: 'Autre quartier…' }]);
    return opts;
  };
  V.effQ = (o) => (o && o.quartier === '__other' ? String(o.other || '').trim() : String((o && o.quartier) || '').trim());
  V.quartierField = function (o) {
    const isOther = o.value === '__other';
    const sel = U.field({ label: o.label, kind: 'select', value: o.value, options: V.quartierOptions(), bind: o.bindQ, name: o.nameQ, error: isOther ? '' : o.error, attrs: 'data-other="' + o.id + '"' });
    const oth = html`<div id="${o.id}"${isOther ? '' : U.raw(' hidden')}>${U.field({ label: 'Nom du quartier', value: o.other || '', bind: o.bindO, name: o.nameO, placeholder: 'Ex. Sabon Gari', error: isOther ? o.error : '', maxlength: 40 })}</div>`;
    return html`${sel}${oth}`;
  };

  /* ---------- messages d'erreur de formulaire ---------- */
  V.errBox = (msg) => (msg ? html`<div class="notice bad" role="alert" style="margin-bottom:14px">${ic('alert', 20)}<div>${msg}</div></div>` : '');
})((window.NZ = window.NZ || {}));
