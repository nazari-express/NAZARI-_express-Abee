/* Nazari Express — briques d'interface : gabarits HTML sûrs, icônes, formats, fenêtres. */
(function (NZ) {
  'use strict';

  /* ---------- l'application ne s'affiche jamais dans le cadre d'un autre site (clic piégé) ----------
     GitHub Pages ne permet pas d'envoyer l'en-tête X-Frame-Options : on se protège ici. */
  if (window.top !== window.self) {
    try { window.top.location.replace(window.self.location.href); } catch (e) { /* bloqué : on masque */ }
    document.documentElement.style.display = 'none';
  }

  /* ---------- gabarits : tout ce qui est inséré est échappé, sauf raw() ---------- */
  const RAW = Symbol('raw');
  const raw = (s) => ({ [RAW]: String(s) });
  const isRaw = (v) => v !== null && typeof v === 'object' && RAW in v;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toS(v) {
    if (v === null || v === undefined || v === false || v === true) return '';
    if (Array.isArray(v)) return v.map(toS).join('');
    if (isRaw(v)) return v[RAW];
    return esc(v);
  }
  function html(strings, ...vals) {
    let o = strings[0];
    for (let i = 0; i < vals.length; i++) o += toS(vals[i]) + strings[i + 1];
    return raw(o);
  }
  const str = toS;

  /* ---------- icônes ---------- */
  const P = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10"/>',
    chat: '<path d="M20.5 12a8 8 0 0 1-11.7 7.1L4 20.2l1.2-4.4A8 8 0 1 1 20.5 12z"/><path d="M8.7 12h.01M12 12h.01M15.3 12h.01" stroke-width="2.6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
    box: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    pin: '<path d="M12 21s7-6.1 7-11.5a7 7 0 0 0-14 0C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/>',
    tag: '<path d="M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7z"/><circle cx="7.8" cy="8.8" r="1.4"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 1.8H4.2z"/><path d="M10 21h4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    back: '<path d="M19 12H5M11.5 5.5 5 12l6.5 6.5"/>',
    next: '<path d="M5 12h14M12.5 5.5 19 12l-6.5 6.5"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    truck: '<path d="M2.5 6.5h11v9.5h-11zM13.5 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.9"/><circle cx="17" cy="18" r="1.9"/>',
    bus: '<rect x="4" y="3.5" width="16" height="13" rx="2.5"/><path d="M4 10.5h16M8 16.5v2.5M16 16.5v2.5"/><path d="M7.5 13.5h.01M16.5 13.5h.01" stroke-width="2.6"/>',
    cross: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
    shield: '<path d="M12 3 20 6v6c0 4.7-3.4 7.9-8 9-4.6-1.1-8-4.3-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M14.8 9.2c-.5-1-1.5-1.5-2.8-1.5-1.6 0-2.8.8-2.8 2.1 0 3 5.6 1.4 5.6 4.3 0 1.3-1.2 2.2-2.8 2.2-1.4 0-2.5-.6-3-1.7"/>',
    bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    lock: '<rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01" stroke-width="2.4"/>',
    phone: '<path d="M5.5 3.5h3.2l1.8 4.6-2.2 1.4a11 11 0 0 0 5.2 5.2l1.4-2.2 4.6 1.8v3.2a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2z"/>',
    wa: '<path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.5z"/><path d="M9.3 8.4c.3-.5.8-.5 1.1 0l.7 1.4c.1.3 0 .6-.2.8l-.5.6c.7 1.3 1.8 2.3 3.1 3l.6-.6c.2-.2.5-.3.8-.2l1.5.8c.5.3.5.8.1 1.3-.7.9-1.7 1.2-2.7.9-3.1-1-5.2-3.3-5.8-6.4-.1-.7.1-1.2.4-1.6z" fill="currentColor" stroke="none"/>',
    out: '<path d="M10 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4M15.5 16.5 20 12l-4.5-4.5M20 12H9.5"/>',
    list: '<path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20"/><path d="M4 6.5h.01M4 12h.01M4 17.5h.01" stroke-width="2.6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1.9-1.1 1.8M12 16.6h.01" stroke-width="2.2"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    edit: '<path d="M4 20h4L19.5 8.5l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    refresh: '<path d="M20 11A8 8 0 0 0 6 6.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14 4.5M20 20v-4.5h-4.5"/>',
    alert: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.2h.01" stroke-width="2.4"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
    share: '<path d="M4.5 12v7a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-7M16 6.5 12 2.5l-4 4M12 2.5V15"/>',
    mega: '<path d="M3.5 10.5v3a1 1 0 0 0 1 1H8l6.5 4v-13L8 9.5H4.5a1 1 0 0 0-1 1z"/><path d="M17.5 9a4.5 4.5 0 0 1 0 6"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5"/><circle cx="17.2" cy="9.5" r="2.5"/><path d="M17.5 14.5c2.7.2 4.5 1.8 4.5 5"/>',
    chart: '<path d="M4 20V11M10 20V4.5M16 20v-6.5M21.5 20h-19"/>',
    send: '<path d="M21.5 2.5 10.5 13.5M21.5 2.5 15 21.5l-4.5-8-8-4.5z"/>',
    eye: '<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.8"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.8"/><path d="M19 20.5c0 1.2-1.6 1.8-3.5 1.8H13"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.2A9.6 9.6 0 0 1 12 5c6.2 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.7A17 17 0 0 0 2 12s3.8 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    dots: '<path d="M12 5h.01M12 12h.01M12 19h.01" stroke-width="3"/>',
    note: '<path d="M5 3.5h10l4 4v13H5z"/><path d="M14.5 3.5v4.5H19M8.5 12.5h7M8.5 16h7"/>',
    dcheck: '<path d="m2.5 12.5 4.5 4.5L15 8M10 16.5l1.5 1.5 9-10"/>',
    map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l3 3M14 9l2 2"/>',
    toggle: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="16.5" cy="12" r="2.6"/>',
    del: '<path d="M21 5H9l-6 7 6 7h12z"/><path d="m13 9.5 5 5M18 9.5l-5 5"/>',
    mute: '<path d="M4 9.5v5h3.5l5 4v-13l-5 4z"/><path d="m16.5 9.5 5 5M21.5 9.5l-5 5"/>',
    camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 3.5 3L15 13.5l5 4.5"/>',
    book: '<path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><circle cx="12" cy="10" r="2.2"/><path d="M8.5 15.5c.7-1.4 1.9-2 3.5-2s2.8.6 3.5 2"/>',
  };
  /* dessin du sprite (tools/illus.py) : <svg class="il"><use href="#il-xxx"/></svg> */
  function il(name, size, cls) {
    const s = size || 64;
    return raw('<svg class="il ' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><use href="#il-' + name + '"/></svg>');
  }
  function ic(name, size, cls) {
    return raw('<svg class="ic ' + (cls || '') + '" width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>');
  }

  /* ---------- formats ---------- */
  const NB = ' ';
  const fnum = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  const fcfa = (n) => fnum(n) + NB + 'FCFA';
  function fphone(p) {
    const d = String(p || '').replace(/\D/g, '');
    return d.length === 8 ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : d;
  }
  const TZ = 'Africa/Niamey';
  const tfmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  const dfmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  const dkey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  function ftime(iso) { return iso ? tfmt.format(new Date(iso)) : ''; }
  function fdate(iso) { return iso ? dfmt.format(new Date(iso)) : ''; }
  function fwhen(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const k = dkey.format(d), today = dkey.format(new Date()), yest = dkey.format(new Date(Date.now() - 864e5));
    if (k === today) return ftime(iso);
    if (k === yest) return 'Hier ' + ftime(iso);
    return dfmt.format(d).slice(0, 5) + ' ' + ftime(iso);
  }
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  /* ---------- libellés métier ---------- */
  const SERVICE = {
    parcel: { t: 'Colis', long: 'Colis à domicile', icon: 'box' },
    agency_drop: { t: 'Dépôt agence', long: 'Dépôt à une agence de transport', icon: 'bus' },
    agency_pickup: { t: 'Retrait agence', long: 'Retrait à une agence de transport', icon: 'bus' },
    pharmacy: { t: 'Pharmacie', long: 'Livraison de pharmacie', icon: 'cross' },
  };
  const STATUS = {
    received: 'Reçue', accepted: 'Validée', preparing: 'En préparation', in_delivery: 'En cours', delivered: 'Livrée', cancelled: 'Annulée',
  };
  const TIERS = [
    { key: 'small', label: 'Petit (0-5 kg)', range: '0 - 5 kg', max: 5, def: 2, price: 'small' },
    { key: 'medium', label: 'Moyen (5-10 kg)', range: '5 - 10 kg', max: 10, def: 7, price: 'medium' },
    { key: 'large', label: 'Grand (10-20 kg)', range: '10 - 20 kg', max: 20, def: 15, price: 'large' },
    { key: 'xl', label: 'Très grand (+20 kg)', range: '+ 20 kg', max: Infinity, def: 25, price: 'xl' },
  ];
  const tierOf = (w) => (w <= 5 ? 'small' : w <= 10 ? 'medium' : w <= 20 ? 'large' : 'xl');
  const statusChip = (s) => html`<span class="chip ${s}">${STATUS[s] || s}</span>`;

  /* ---------- liens ---------- */
  function waLink(number, text) {
    let d = String(number || '').replace(/\D/g, '');
    if (d.length === 8) d = '227' + d;
    if (!d) return '';
    return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
  }
  const telLink = (p) => 'tel:+' + (String(p || '').replace(/\D/g, '').length === 8 ? '227' : '') + String(p || '').replace(/\D/g, '');

  /* ---------- composants ---------- */
  function btn(o) {
    const cls = ['btn', o.kind || 'primary', o.size || '', o.full ? 'full' : ''].join(' ').trim();
    const tag = o.href ? 'a' : 'button';
    const attrs = (o.href ? ' href="' + esc(o.href) + '"' + (o.href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '') : ' type="' + (o.type || 'button') + '"')
      + (o.act ? ' data-act="' + esc(o.act) + '"' : '')
      + (o.id ? ' data-id="' + esc(o.id) + '"' : '')
      + (o.data ? Object.keys(o.data).map((k) => ' data-' + k + '="' + esc(o.data[k]) + '"').join('') : '')
      + (o.disabled ? ' disabled' : '');
    return raw('<' + tag + ' class="' + cls + '"' + attrs + '>' + (o.icon ? str(ic(o.icon, o.size === 'sm' ? 18 : 20)) : '') + esc(o.label) + (o.iconRight ? str(ic(o.iconRight, o.size === 'sm' ? 18 : 20)) : '') + '</' + tag + '>');
  }
  function field(o) {
    const bind = o.bind ? ' data-bind="' + esc(o.bind) + '"' : '';
    const common = (o.name ? ' name="' + esc(o.name) + '"' : '') + bind + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '')
      + (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') + (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : ' autocomplete="off"')
      + (o.list ? ' list="' + esc(o.list) + '"' : '') + (o.attrs ? ' ' + o.attrs : '');
    let control;
    if (o.kind === 'textarea') {
      control = '<textarea class="input"' + common + (o.rows ? ' rows="' + o.rows + '"' : '') + '>' + esc(o.value || '') + '</textarea>';
    } else if (o.kind === 'select') {
      control = '<select class="input"' + common + '>' + (o.options || []).map((x) => '<option value="' + esc(x.v) + '"' + (String(x.v) === String(o.value) ? ' selected' : '') + '>' + esc(x.t) + '</option>').join('') + '</select>';
    } else if (o.kind === 'phone') {
      control = '<div class="phone"><span class="pre">+227</span><input class="input" type="tel" inputmode="numeric" data-phone="1" value="' + esc(fphone(o.value || '')) + '"' + common + '></div>';
    } else if (o.kind === 'pin') {
      control = '<div class="pin-wrap"><input class="input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="' + (o.maxlength || 10) + '" value="' + esc(o.value || '') + '"' + common.replace(/ maxlength="\d+"/, '') + '><button type="button" class="icon-btn" data-act="toggle-pin" aria-label="Afficher ou masquer le code">' + str(ic('eye', 20)) + '</button></div>';
    } else {
      control = '<input class="input" type="' + (o.type || 'text') + '"' + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') + ' value="' + esc(o.value == null ? '' : o.value) + '"' + common + '>';
    }
    return raw('<label class="field' + (o.error ? ' err' : '') + '"><span class="lbl"><span>' + esc(o.label) + '</span>' + (o.optional ? '<i>facultatif</i>' : '') + '</span>' + control
      + (o.error ? '<div class="msg" role="alert">' + esc(o.error) + '</div>' : '') + (o.hint && !o.error ? '<div class="hint">' + esc(o.hint) + '</div>' : '') + '</label>');
  }
  const empty = (icon, title, text, action) => html`<div class="empty"><div class="disc">${ic(icon, 30)}</div><div class="t">${title}</div><div>${text}</div>${action ? html`<div style="margin-top:16px">${action}</div>` : ''}</div>`;
  const skeleton = (n) => html`<div class="stack">${Array.from({ length: n || 3 }, () => html`<div class="skel" style="height:78px"></div>`)}</div>`;
  const row = (o) => {
    const inner = html`${o.lead ? o.lead : html`<span class="disc sm ${o.tone || ''}">${ic(o.icon || 'box', 20)}</span>`}<span class="grow"><span class="t">${o.title}${o.chip || ''}</span>${o.sub ? html`<span class="s" style="display:block">${o.sub}</span>` : ''}</span><span class="end">${o.end || ''}${o.noArrow ? '' : ic('chev', 18)}</span>`;
    const cls = 'row' + (o.unread ? ' unread' : '') + (o.wrap ? ' wrap' : '');
    if (o.href) return html`<a class="${cls}" href="${o.href}">${inner}</a>`;
    return html`<button type="button" class="${cls}" data-act="${o.act}" ${o.id ? raw('data-id="' + esc(o.id) + '"') : ''}>${inner}</button>`;
  };

  /* ---------- événements : data-act et data-bind ---------- */
  const handlers = {};
  NZ.act = (name, fn) => { handlers[name] = fn; };
  document.addEventListener('click', (e) => {
    const el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el || el.disabled) return;
    const fn = handlers[el.dataset.act];
    if (fn) { if (el.tagName !== 'A') e.preventDefault(); NZ.unlockAudio && NZ.unlockAudio(); fn(el, e); }
  });
  function setPath(obj, path, v) {
    const ks = path.split('.');
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== 'object' || o[ks[i]] === null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }
  NZ.bindTarget = null; NZ.onBind = null;
  function onField(e) {
    const el = e.target;
    if (el.dataset && el.dataset.other) {
      const t = document.getElementById(el.dataset.other);
      if (t) t.hidden = el.value !== '__other';
    }
    if (el.dataset && el.dataset.reveal) {
      const [id, vals] = el.dataset.reveal.split(':');
      const t = document.getElementById(id);
      if (t) t.hidden = !vals.split(',').includes(el.value);
    }
    if (el.dataset && el.dataset.diff) {
      const [id, expected] = el.dataset.diff.split(':');
      const t = document.getElementById(id);
      const digits = String(el.value).replace(/\D/g, '');
      if (t) t.hidden = digits !== '' && parseInt(digits, 10) === parseInt(expected, 10);
    }
    if (el.dataset && el.dataset.phone) {
      let d = el.value.replace(/\D/g, '');
      if (d.startsWith('00227')) d = d.slice(5); else if (d.startsWith('227') && d.length > 8) d = d.slice(3);
      d = d.slice(0, 8);
      const f = fphone(d);
      if (el.value !== f) el.value = f;
    }
    if (!el.dataset || !el.dataset.bind || !NZ.bindTarget) return;
    const v = el.type === 'checkbox' ? el.checked : (el.dataset.phone ? el.value.replace(/\D/g, '') : el.value);
    setPath(NZ.bindTarget, el.dataset.bind, v);
    if (NZ.onBind) NZ.onBind(el.dataset.bind, el, v);
  }
  document.addEventListener('input', onField);
  document.addEventListener('change', onField);
  /* formulaires : <form data-submit="nom"> ; Entrée sur le clavier du téléphone valide aussi */
  const submits = {};
  NZ.submit = (name, fn) => { submits[name] = fn; };
  document.addEventListener('submit', (e) => {
    const f = e.target.closest ? e.target.closest('form[data-submit]') : null;
    if (!f) return;
    e.preventDefault();
    const fn = submits[f.dataset.submit];
    if (fn) { NZ.unlockAudio && NZ.unlockAudio(); fn(f, e); }
  });
  NZ.act('toggle-pin', (el) => {
    const inp = el.parentElement.querySelector('input');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    el.innerHTML = str(ic(show ? 'eyeoff' : 'eye', 20));
  });
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  /* lecture d'un formulaire : name -> valeur (téléphones en chiffres) */
  function formData(root) {
    const out = {};
    root.querySelectorAll('[name]').forEach((el) => {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.dataset.phone ? el.value.replace(/\D/g, '') : el.value.trim();
    });
    return out;
  }

  /* ---------- messages, fenêtres ---------- */
  let toastTimer = null;
  function toast(msg, kind) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'err' ? 5200 : 3200);
  }
  function openOverlay(inner, opts) {
    closeOverlay();
    const o = document.createElement('div');
    o.className = 'overlay'; o.id = 'overlay';
    o.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + str(inner) + '</div>';
    o.addEventListener('click', (e) => { if (e.target === o && !(opts && opts.locked)) closeOverlay(); });
    document.body.appendChild(o);
    document.body.style.overflow = 'hidden';
    const f = o.querySelector('input,textarea,select,button.btn');
    if (opts && opts.focus !== false && f && f.tagName !== 'BUTTON') setTimeout(() => f.focus(), 60);
    return o;
  }
  function closeOverlay() {
    const o = document.getElementById('overlay');
    if (o) o.remove();
    document.body.style.overflow = '';
  }
  NZ.act('overlay-close', closeOverlay);
  function confirmBox(o) {
    return new Promise((resolve) => {
      const ov = openOverlay(html`<h2>${o.title}</h2><p class="muted" style="margin-bottom:18px">${o.text || ''}</p>
        ${o.reason ? field({ label: o.reason, name: 'reason', kind: 'textarea', optional: true, rows: 2 }) : ''}
        <div class="btn-row" style="margin-top:16px">${btn({ label: o.cancel || 'Retour', kind: 'ghost', act: 'confirm-no' })}${btn({ label: o.ok || 'Confirmer', kind: o.danger ? 'solid-danger' : 'primary', act: 'confirm-yes' })}</div>`, { focus: false });
      const done = (v) => { const r = ov.querySelector('[name=reason]'); const reason = r ? r.value.trim() : ''; closeOverlay(); resolve(v ? { reason } : false); };
      handlers['confirm-yes'] = () => done(true);
      handlers['confirm-no'] = () => done(false);
      ov.addEventListener('click', (e) => { if (e.target === ov) resolve(false); });
    });
  }

  /* bouton occupé pendant une requête */
  async function busy(el, fn) {
    if (!el) return fn();
    if (el.dataset.busy) return;
    el.dataset.busy = '1';
    const old = el.innerHTML;
    el.disabled = true;
    el.innerHTML = '<span class="spin' + (el.classList.contains('primary') || el.classList.contains('wa') || el.classList.contains('solid-danger') ? '' : ' dark') + '"></span>';
    try { return await fn(); }
    finally { delete el.dataset.busy; if (el.isConnected) { el.disabled = false; el.innerHTML = old; } }
  }

  /* copier dans le presse-papiers */
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast('Copié', 'ok'); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copié', 'ok'); } catch (e2) { toast('Copie impossible', 'err'); }
      ta.remove();
    }
  }

  /* son d'alerte (administrateurs) */
  let actx = null, audioOn = false;
  NZ.unlockAudio = function () {
    if (audioOn) return; audioOn = true;
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
  };
  function beep() {
    if (!actx) return;
    try {
      if (actx.state === 'suspended') actx.resume();
      [0, 0.18].forEach((dt, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = i ? 1046 : 784;
        g.gain.setValueAtTime(0.0001, actx.currentTime + dt);
        g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + dt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dt + 0.3);
        o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + dt); o.stop(actx.currentTime + dt + 0.32);
      });
    } catch (e) { /* silencieux */ }
  }

  NZ.ui = { RAW, raw, esc, html, str, ic, il, P, fnum, fcfa, fphone, ftime, fdate, fwhen, initials, SERVICE, STATUS, TIERS, tierOf, statusChip, waLink, telLink, btn, field, empty, skeleton, row, setPath, getPath, formData, toast, openOverlay, closeOverlay, confirmBox, busy, copyText, beep };
})((window.NZ = window.NZ || {}));
