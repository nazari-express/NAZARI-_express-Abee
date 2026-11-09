/* Nazari Express — composants partagés (client, livreur, admin). */
(function (NZ) {
  'use strict';
  const U = NZ.ui;
  const { html, raw, str, ic, fcfa, fwhen, ftime, SERVICE, statusChip, btn, telLink, waLink } = U;
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

  /* ---------- position GPS du client ----------
     Le client partage sa position : elle est rangée dans les « précisions » de l'adresse, sous la forme
     « GPS 16.973300,7.990800 (±12 m) ». L'équipe en tire un bouton d'itinéraire. */
  V.GEO = { lat: 16.9733, lng: 7.9911, farKm: 6, outKm: 40, name: 'Position GPS', farName: 'Position GPS éloignée' };
  V.isGeoName = (n) => n === V.GEO.name || n === V.GEO.farName;
  V.geoKm = (lat, lng) => {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat - V.GEO.lat) * rad, dLng = (lng - V.GEO.lng) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(V.GEO.lat * rad) * Math.cos(lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  };
  V.geoText = (g) => 'GPS ' + g.lat.toFixed(6) + ',' + g.lng.toFixed(6) + (g.acc ? ' (±' + g.acc + ' m)' : '');
  V.geoParse = (s) => {
    const m = /GPS\s+(-?\d{1,2}\.\d{3,7}),(-?\d{1,3}\.\d{3,7})(?:\s*\(\s*±?\s*(\d{1,5})\s*m\s*\))?/.exec(String(s || ''));
    if (!m) return null;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
    const rest = String(s).replace(m[0], '').replace(/^[\s·]+|[\s·]+$/g, '');
    return { lat, lng, acc: m[3] ? parseInt(m[3], 10) : 0, rest };
  };
  V.geoHref = (g) => 'https://www.google.com/maps/search/?api=1&query=' + g.lat.toFixed(6) + ',' + g.lng.toFixed(6);
  /* itinéraire depuis la position du livreur jusqu'à celle du client */
  V.geoRouteHref = (g) => 'https://www.google.com/maps/dir/?api=1&destination=' + g.lat.toFixed(6) + ',' + g.lng.toFixed(6) + '&travelmode=driving';
  /* précisions d'une adresse : le texte du client + un lien « Ouvrir la position » si elle contient un GPS */
  V.detailsHtml = (d) => {
    const g = V.geoParse(d);
    if (!g) return d || '';
    return html`${g.rest ? g.rest + ' · ' : ''}<a href="${V.geoHref(g)}" target="_blank" rel="noopener noreferrer" style="font-weight:700;display:inline-flex;align-items:center;gap:4px">${ic('pin', 14)} Ouvrir sur la carte${g.acc ? ' (±' + g.acc + ' m)' : ''}</a>`;
  };

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
        V.detailsHtml(o.pickup.details),
        withPhones ? contact(o.pickup.name, o.pickup.phone) : o.pickup.name);
    }
    if (o.service === 'agency_drop') {
      to = side('Vers', 'a', o.partner_name || 'Agence',
        [o.drop.quartier, o.drop.details].filter(Boolean).join(' · '),
        ['Destination : ' + (o.agency_dest || '—'), withPhones ? contact(o.dest_name, o.dest_phone) : o.dest_name].filter(Boolean).join(' — '));
    } else {
      to = side('Vers', 'r', o.drop.quartier || '—',
        V.detailsHtml(o.drop.details),
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
  /* la pastille d'une agence / pharmacie : sa photo si on l'a, sinon le petit dessin (remplacé dès l'arrivée de la photo) */
  V.ppBox = (p, o) => {
    o = o || {};
    const d = NZ.photoOf(p);
    return html`<span class="pp${o.cls ? ' ' + o.cls : ''}${d ? ' has' : ''}" data-pp="${p.id}" data-pv="${p.pv || 0}">${d ? html`<img src="${d}" alt="">` : U.il(p.kind === 'pharmacy' ? 'pharmacy' : 'agency', o.icon || 46)}</span>`;
  };
  V.notice = (text, kind, icon) => html`<div class="notice ${kind || ''}">${ic(icon || (kind === 'bad' ? 'alert' : kind === 'warn' ? 'info' : 'info'), 20)}<div>${text}</div></div>`;

  /* un quartier : liste + « Autre quartier… » */
  V.quartierOptions = function (value) {
    const q = ((NZ.config && NZ.config.quartiers) || []).filter((x) => !V.isGeoName(x.name));
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

  /* ---------- carte d'identité du client (retrait d'un colis à l'agence) ----------
     opts.can : le bouton est affiché ; sinon opts.why explique pourquoi la carte n'est pas visible */
  V.idCardBox = function (o, opts) {
    opts = opts || {};
    if (!o || o.service !== 'agency_pickup') return '';
    if (!opts.can) return opts.why ? html`<div class="notice">${ic('lock', 18)}<div>${opts.why}</div></div>` : '';
    return html`<div class="card"><div class="h2" style="margin-bottom:6px">Carte d'identité du client</div>
      <p class="muted small" style="margin:0 0 12px">Elle sert à retirer le colis à l'agence. ${opts.note || ''}</p>
      ${btn({ label: 'Voir la carte d\'identité', kind: 'primary', full: true, size: 'lg', icon: 'image', act: 'id-view', id: o.id })}</div>`;
  };
  NZ.act('id-view', (el) => U.busy(el, async () => {
    try {
      const r = await NZ.api('id.get', { order_id: el.dataset.id });
      if (NZ.kit && NZ.kit.viewPhoto) NZ.kit.viewPhoto(r.img, 'Carte d\'identité');
    } catch (e) { U.toast(e.message, 'err'); }
  }));

  /* ---------- code QR ----------
     Petit générateur de code QR (texte en octets, correction d'erreurs niveau M, versions 1 à 10 : jusqu'à 213 caractères).
     V.qr(texte) renvoie une matrice de 0 et de 1 ; V.qrSvg(texte) renvoie le dessin prêt à afficher. */
  V.qr = function (text) {
    const data = Array.from(new TextEncoder().encode(String(text)));
    const EC = [null, [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]], [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]]];
    const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
    let ver = 0, cap = 0;
    for (let v = 1; v <= 10 && !ver; v++) {
      const c = EC[v].slice(1).reduce((t, g) => t + g[0] * g[1], 0);
      if (data.length * 8 + 4 + (v < 10 ? 8 : 16) <= c * 8) { ver = v; cap = c; }
    }
    if (!ver) throw new Error('QR : texte trop long');
    // 1) les données en bits : mode « octets », longueur, texte, fin, remplissage
    const bits = [];
    const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(data.length, ver < 10 ? 8 : 16);
    data.forEach((b) => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let p = 0xEC; bits.length < cap * 8; p ^= 0xEC ^ 0x11) put(p, 8);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    // 2) correction d'erreurs (Reed-Solomon) par blocs, puis mélange des blocs
    const exp = new Array(512), log = new Array(256);
    for (let i = 0, x = 1; i < 255; i++) { exp[i] = x; log[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
    for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
    const mul = (a, b) => (a && b ? exp[log[a] + log[b]] : 0);
    const rs = (d, n) => {
      let g = [1];
      for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); g.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= mul(c, exp[i]); }); g = ng; }
      const r = new Array(n).fill(0);
      d.forEach((b) => { const f = b ^ r.shift(); r.push(0); if (f) g.slice(1).forEach((c, j) => { r[j] ^= mul(c, f); }); });
      return r;
    };
    const e = EC[ver], blocks = [];
    let pos = 0;
    e.slice(1).forEach(([k, len]) => { for (let i = 0; i < k; i++) { blocks.push(cw.slice(pos, pos + len)); pos += len; } });
    const ecs = blocks.map((b) => rs(b, e[0]));
    const out = [];
    for (let i = 0; i < Math.max.apply(null, blocks.map((b) => b.length)); i++) blocks.forEach((b) => { if (i < b.length) out.push(b[i]); });
    for (let i = 0; i < e[0]; i++) ecs.forEach((b) => out.push(b[i]));
    // 3) la grille : repères, alignement, pointillés, puis les données en zigzag
    const n = 17 + 4 * ver;
    const M = Array.from({ length: n }, () => new Array(n).fill(0));
    const F = Array.from({ length: n }, () => new Array(n).fill(false));
    const set = (r, c, v) => { M[r][c] = v ? 1 : 0; F[r][c] = true; };
    const finder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        set(rr, cc, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)));
      }
    };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    const AL = ALIGN[ver];
    AL.forEach((r) => AL.forEach((c) => {
      if (F[r][c]) return;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }));
    for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    // zones réservées au format et à la version (remplies plus bas)
    for (let i = 0; i < 9; i++) { F[8][i] = true; F[i][8] = true; }
    for (let i = 0; i < 8; i++) { F[8][n - 1 - i] = true; F[n - 1 - i][8] = true; }
    if (ver >= 7) for (let i = 0; i < 18; i++) { F[n - 11 + (i % 3)][Math.floor(i / 3)] = true; F[Math.floor(i / 3)][n - 11 + (i % 3)] = true; }
    let k = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const c = right - j, r = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
          if (!F[r][c] && k < out.length * 8) { M[r][c] = (out[k >>> 3] >>> (7 - (k & 7))) & 1; k++; }
        }
      }
    }
    // 4) le masque : on garde celui qui donne la grille la plus lisible
    const masks = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
      (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
      (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => ((((r + c) % 2) + ((r * c) % 3)) % 2) === 0];
    const finish = (g, mask) => {
      const fmt = (() => { const d = mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); return ((d << 10) | r) ^ 0x5412; })();
      const b = (i) => (fmt >>> i) & 1;
      for (let i = 0; i <= 5; i++) g[i][8] = b(i);
      g[7][8] = b(6); g[8][8] = b(7); g[8][7] = b(8);
      for (let i = 9; i < 15; i++) g[8][14 - i] = b(i);
      for (let i = 0; i < 8; i++) g[8][n - 1 - i] = b(i);
      for (let i = 8; i < 15; i++) g[n - 15 + i][8] = b(i);
      g[n - 8][8] = 1;
      if (ver >= 7) {
        let r = ver;
        for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
        const vb = (ver << 12) | r;
        for (let i = 0; i < 18; i++) { const bit = (vb >>> i) & 1, a = n - 11 + (i % 3), q = Math.floor(i / 3); g[a][q] = bit; g[q][a] = bit; }
      }
      return g;
    };
    const penalty = (g) => {
      let p = 0;
      const line = (get) => {
        for (let a = 0; a < n; a++) {
          let run = 1;
          for (let b = 1; b < n; b++) {
            if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; } else run = 1;
          }
          for (let b = 0; b + 10 < n; b++) {
            const w = []; for (let t = 0; t < 11; t++) w.push(get(a, b + t));
            const s = w.join('');
            if (s === '10111010000' || s === '00001011101') p += 40;
          }
        }
      };
      line((a, b) => g[a][b]); line((a, b) => g[b][a]);
      for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const v = g[r][c]; if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) p += 3; }
      const dark = g.reduce((t, row) => t + row.reduce((a, b) => a + b, 0), 0);
      return p + 10 * Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n));
    };
    let best = null, bestP = Infinity;
    for (let m = 0; m < 8; m++) {
      const g = M.map((row, r) => row.map((v, c) => (!F[r][c] && masks[m](r, c) ? v ^ 1 : v)));
      finish(g, m);
      const p = penalty(g);
      if (p < bestP) { bestP = p; best = g; }
    }
    return best;
  };
  /* le même code sous forme de dessin : fond blanc, bord de 4 carrés, carrés noirs */
  V.qrSvg = function (text, label) {
    const g = V.qr(text), n = g.length;
    let d = '';
    g.forEach((row, r) => row.forEach((v, c) => { if (v) d += 'M' + (c + 4) + ' ' + (r + 4) + 'h1v1h-1z'; }));
    return html`<svg class="qr" viewBox="0 0 ${n + 8} ${n + 8}" role="img" aria-label="${label || 'Code QR'}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"></rect><path d="${raw(d)}" fill="#000"></path></svg>`;
  };

  /* ---------- messages d'erreur de formulaire ---------- */
  V.errBox = (msg) => (msg ? html`<div class="notice bad" role="alert" style="margin-bottom:14px">${ic('alert', 20)}<div>${msg}</div></div>` : '');
})((window.NZ = window.NZ || {}));
