/* Nazari Express — les repères de la carte : entreprises, projets, lieux importants.
   L'administrateur les ajoute avec leur nom et leur position (Plus → Repères sur la carte) ;
   les clients et les livreurs les voient, avec leur nom, sur leurs cartes (suivi du colis, course).
   Les noms viennent de la base : ils ne sont jamais insérés comme du HTML (textContent / gabarits protégés). */
(function (NZ) {
  'use strict';
  const U = NZ.ui, M = NZ.map;
  const { html, raw, str, ic, btn, field, row, empty } = U;
  const A = { roles: ['admin'] };

  /* ---------- catégories : nom, couleur, dessin (nos propres balises) ---------- */
  const KINDS = [
    { k: 'shop', t: 'Commerce, entreprise', c: '#d98a1d', g: '<path d="M5.5 9.5h13l-1 9.5h-11z"/><path d="M9 9.5V8a3 3 0 0 1 6 0v1.5"/>' },
    { k: 'project', t: 'Projet, ONG, bureau', c: '#7a5bc6', g: '<rect x="6" y="4" width="12" height="16" rx="1.5"/><path d="M9.5 8h.01M14.5 8h.01M9.5 12h.01M14.5 12h.01" stroke-width="2.6"/><path d="M10.5 20v-3.5h3V20"/>' },
    { k: 'pharmacy', t: 'Pharmacie', c: '#1e9a55', g: '<path d="M12 6.5v11M6.5 12h11"/>' },
    { k: 'agency', t: 'Agence de transport', c: '#2f80c4', g: '<rect x="5" y="4.5" width="14" height="11" rx="2.2"/><path d="M5 10h14M8 15.5V18M16 15.5V18"/>' },
    { k: 'health', t: 'Santé (hôpital, clinique)', c: '#d44646', g: '<path d="M12 19s-6.5-4.2-6.5-9a3.6 3.6 0 0 1 6.5-2.1A3.6 3.6 0 0 1 18.5 10c0 4.8-6.5 9-6.5 9z"/>' },
    { k: 'school', t: 'École, université', c: '#16899a', g: '<path d="M3.5 9.5 12 5l8.5 4.5L12 14z"/><path d="M7 11.8V15c0 1.2 2.2 2.3 5 2.3s5-1.1 5-2.3v-3.2"/>' },
    { k: 'mosque', t: 'Mosquée', c: '#2b7a5a', g: '<path d="M6 19v-5.5a6 6 0 0 1 12 0V19"/><path d="M4 19h16M12 5.2V3.5"/>' },
    { k: 'market', t: 'Marché', c: '#b5601f', g: '<path d="M4 9.5 5.2 5.5h13.6L20 9.5"/><path d="M4 9.5h16v1.2a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 10.7z"/><path d="M5.5 12.5V19h13v-6.5"/>' },
    { k: 'hotel', t: 'Hôtel, restaurant', c: '#bf4a86', g: '<path d="M4 18V7.5M4 14h16v4M20 14v-2.5A2.5 2.5 0 0 0 17.5 9H11v5"/><circle cx="7.5" cy="11" r="1.4"/>' },
    { k: 'landmark', t: 'Autre repère', c: '#566a5f', g: '<path d="M7 20.5V4.5M7 5h10.5l-2.3 3.8 2.3 3.7H7"/>' },
  ];
  const kindOf = (k) => KINDS.find((x) => x.k === k) || KINDS[KINDS.length - 1];
  const glyph = (kd, size) => '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + kd.g + '</svg>';
  const badge = (kd) => '<div class="in"><span class="bd" style="background:' + kd.c + '">' + glyph(kd, 14) + '</span></div>';

  /* ---------- la liste (gardée 2 minutes en mémoire) ---------- */
  const PL = { items: [], at: 0, loading: null };
  const TTL = 2 * 60 * 1000;
  const fetchList = () => NZ.api('place.list', {})
    .then((r) => { PL.items = (r && Array.isArray(r.items)) ? r.items : []; PL.at = Date.now(); return PL.items; });
  /* pour les cartes : jamais d'erreur affichée (la carte marche sans repères si la base n'est pas à jour ou si le réseau est faible) */
  function load(force) {
    if (!force && PL.at && Date.now() - PL.at < TTL) return Promise.resolve(PL.items);
    if (PL.loading) return PL.loading;
    PL.loading = fetchList()
      .catch(() => { PL.at = Date.now() - TTL + 60000; return PL.items; })   // nouvel essai dans 1 minute
      .then((v) => { PL.loading = null; return v; });
    return PL.loading;
  }
  const keep = (r) => { PL.items = (r && Array.isArray(r.items)) ? r.items : PL.items; PL.at = Date.now(); };

  /* ---------- sur une carte : un petit rond coloré, et le nom quand on est assez près ---------- */
  function paint(map) {
    if (!map || typeof map.setMarker !== 'function') return;
    const cur = map.__poi || (map.__poi = new Map());           // id du repère -> « nom|catégorie » affiché
    const seen = new Set();
    PL.items.forEach((it) => {
      const id = 'poi-' + it.id, kd = kindOf(it.kind), sig = it.name + '|' + it.kind;
      seen.add(id);
      if (cur.has(id) && cur.get(id) !== sig) map.removeMarker(id);       // renommé ou changé de catégorie : on le redessine
      map.setMarker(id, { lat: it.lat, lng: it.lng, kind: 'poi k-' + kd.k, label: it.name, html: badge(kd) });
      cur.set(id, sig);
    });
    Array.from(cur.keys()).forEach((id) => { if (!seen.has(id)) { map.removeMarker(id); cur.delete(id); } });
  }
  function attach(map) {
    paint(map);
    load().then(() => paint(map));
  }

  /* ---------- position : celle du téléphone, ou des coordonnées collées ---------- */
  function locate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Ce téléphone ne donne pas sa position.'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) }),
        (e) => reject(new Error(e && e.code === 1 ? 'Position refusée : autorisez la localisation pour ce site.' : 'Position introuvable. Réessayez dehors ou choisissez sur la carte.')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }
  /* « 16.9733, 7.9911 », ou un lien Google Maps complet (…/@16.9733,7.9911,17z · …!3d16.9733!4d7.9911 · …?q=16.9733,7.9911) */
  function parseCoords(t) {
    t = String(t || '').trim();
    if (!t) return null;
    const N = '(-?\\d{1,3}(?:\\.\\d+)?)';
    const m = t.match(new RegExp('!3d' + N + '!4d' + N))
      || t.match(new RegExp('@' + N + ',' + N))
      || t.match(new RegExp('[?&](?:q|query|ll|destination|center)=' + N + '(?:,|%2C)\\s*' + N, 'i'))
      || t.match(/(-?\d{1,3}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})/);
    if (!m) return null;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    return (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) ? { lat, lng } : null;
  }

  /* =====================================================================
     Écran de l'administrateur : Plus → Repères sur la carte
     ===================================================================== */
  const setMain = (h) => { const m = document.getElementById('main'); if (m) m.innerHTML = str(h); };
  const lead = (kd) => raw('<span class="plb" style="background:' + kd.c + '">' + glyph(kd, 20) + '</span>');
  const listView = () => html`<p class="small muted" style="margin:0 2px 12px">Ajoutez les entreprises, projets et lieux importants : ils s'affichent avec leur nom sur les cartes des clients et des livreurs.</p>
    <div class="pl-actions">${btn({ label: 'Ajouter un repère', icon: 'plus', act: 'pl-edit', full: true })}${PL.items.length ? btn({ label: 'Voir sur la carte', kind: 'ghost', icon: 'map', act: 'pl-all', full: true }) : ''}</div>
    ${PL.items.length ? html`<div class="list" data-vid="pl-list">${PL.items.map((it) => row({ lead: lead(kindOf(it.kind)), title: it.name, sub: kindOf(it.kind).t + (it.note ? ' · ' + it.note : ''), act: 'pl-edit', id: String(it.id) }))}</div>
      <p class="small muted" style="margin:10px 2px">${PL.items.length} repère${PL.items.length > 1 ? 's' : ''}</p>`
      : empty('pin', 'Aucun repère', 'Touchez « Ajouter un repère » : donnez le nom du lieu et sa position.')}`;
  NZ.route('/admin/places', async (ctx) => {
    ctx.shell({ title: 'Repères sur la carte', back: '#/admin/more', tab: 'more' });
    try { await fetchList(); ctx.main(listView()); } catch (e) { ctx.fail(e); }
  }, A);

  /* ---------- la fiche d'un repère ---------- */
  const ED = { id: null, lat: null, lng: null, acc: null, kind: 'landmark' };
  const kindChips = () => KINDS.map((x) => html`<button type="button" class="fchip${ED.kind === x.k ? ' on' : ''}" data-act="pl-kind" data-v="${x.k}"><i class="kd" style="background:${x.c}"></i>${x.t}</button>`);
  function posBlock() {
    const has = ED.lat != null;
    const km = has ? M.dist(M.AGADEZ, { lat: ED.lat, lng: ED.lng }) / 1000 : 0;
    return html`<span class="lbl"><span>Position sur la carte</span></span>
      ${has ? html`<p class="pl-ok" data-vid="pl-pos-ok">${ic('check', 20)}<span>Position choisie<small>${ED.lat.toFixed(5)}, ${ED.lng.toFixed(5)}${ED.acc ? ' · précision ' + ED.acc + ' m' : ''}</small></span></p>`
        : html`<p class="pl-none" data-vid="pl-pos-none">Pas encore placé</p>`}
      ${has && km > 60 ? html`<p class="pl-warn" data-vid="pl-pos-far">${ic('info', 18)}<span>Ce point est à ${Math.round(km)} km d'Agadez : vérifiez la position.</span></p>` : ''}
      <div class="pl-btns">${btn({ label: 'Ma position', kind: 'ghost', size: 'sm', icon: 'pin', act: 'pl-here' })}${btn({ label: 'Choisir sur la carte', kind: 'ghost', size: 'sm', icon: 'map', act: 'pl-pick' })}</div>
      <label class="pl-paste"><span class="small muted">Ou collez des coordonnées, ou un lien Google Maps :</span>
        <span class="pl-prow"><input class="input" id="pl-paste" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ex. 16.9733, 7.9911">${btn({ label: 'Utiliser', kind: 'ghost', size: 'sm', act: 'pl-paste-go' })}</span></label>`;
  }
  const repaintPos = () => { const el = document.getElementById('pl-pos'); if (el) el.innerHTML = str(posBlock()); };
  NZ.act('pl-kind', (el) => { ED.kind = el.dataset.v; const c = document.getElementById('pl-kinds'); if (c) c.innerHTML = str(kindChips()); });
  NZ.act('pl-edit', (el) => {
    const it = el.dataset.id ? PL.items.find((x) => String(x.id) === el.dataset.id) : null;
    ED.id = it ? it.id : null; ED.lat = it ? it.lat : null; ED.lng = it ? it.lng : null; ED.acc = null; ED.kind = it ? it.kind : 'landmark';
    U.openOverlay(html`<h2>${it ? 'Modifier le repère' : 'Nouveau repère'}</h2>
      <form data-submit="pl-save" data-vid="pl-form" novalidate>
        ${field({ label: 'Nom du lieu', name: 'name', value: it ? it.name : '', maxlength: 60, placeholder: 'Ex. Hôtel de l\'Aïr, Projet Aïr Solaire' })}
        <div class="field"><span class="lbl"><span>Catégorie</span></span><div class="filters pl-kinds" id="pl-kinds">${kindChips()}</div></div>
        ${field({ label: 'Précision', name: 'note', value: it ? it.note : '', optional: true, maxlength: 120, placeholder: 'Ex. en face de la gare routière' })}
        <div class="field pl-pos" id="pl-pos">${posBlock()}</div>
        <div class="btn-row" style="margin-top:18px">${it ? btn({ label: 'Supprimer', kind: 'danger', act: 'pl-del', id: String(it.id) }) : btn({ label: 'Annuler', kind: 'ghost', act: 'overlay-close' })}${btn({ label: 'Enregistrer', type: 'submit' })}</div>
      </form>`);
  });
  NZ.submit('pl-save', async (f) => {
    const d = U.formData(f);
    if (String(d.name || '').trim().length < 2) return U.toast('Entrez le nom du lieu.', 'err');
    if (ED.lat == null) return U.toast('Choisissez la position du lieu.', 'err');
    await U.busy(f.querySelector('button[type=submit]'), async () => {
      try {
        const r = await NZ.api('place.save', { id: ED.id || undefined, name: d.name, kind: ED.kind, note: d.note || '', lat: ED.lat, lng: ED.lng });
        keep(r);
        U.closeOverlay(); setMain(listView()); U.toast('Enregistré', 'ok');
      } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.act('pl-del', async (el) => {
    const id = Number(el.dataset.id);
    const it = PL.items.find((x) => x.id === id);
    const ok = await U.confirmBox({ title: 'Supprimer ce repère ?', text: (it ? it.name + ' : ' : '') + 'il disparaît des cartes.', ok: 'Supprimer', danger: true });
    if (!ok) return;
    try { keep(await NZ.api('place.delete', { id })); setMain(listView()); U.toast('Supprimé', 'ok'); } catch (e) { U.toast(e.message, 'err'); }
  });
  NZ.act('pl-here', async (el) => {
    await U.busy(el, async () => {
      try { const g = await locate(); ED.lat = g.lat; ED.lng = g.lng; ED.acc = g.acc; repaintPos(); } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.act('pl-paste-go', () => {
    const inp = document.getElementById('pl-paste');
    if (!inp) return;
    const g = parseCoords(inp.value);
    if (!g) return U.toast(/goo\.gl|maps\.app/i.test(inp.value) ? 'Ce lien court ne contient pas la position. Dans Google Maps, touchez longuement le lieu et copiez les chiffres (ex. 16.9733, 7.9911).' : 'Je ne trouve pas de coordonnées. Exemple : 16.9733, 7.9911', 'err');
    ED.lat = g.lat; ED.lng = g.lng; ED.acc = null; repaintPos();
  });
  document.addEventListener('keydown', (e) => {          // Entrée dans la case des coordonnées : on les utilise (sans enregistrer la fiche)
    if (e.key === 'Enter' && e.target && e.target.id === 'pl-paste') { e.preventDefault(); const b = document.querySelector('[data-act="pl-paste-go"]'); if (b) b.click(); }
  });

  /* ---------- carte plein écran : choisir un point (le repère reste au centre), ou voir tous les repères ---------- */
  let PK = null;
  function closeFull() {
    if (!PK) return;
    clearInterval(PK.t);
    try { PK.map.destroy(); } catch (e) { /* déjà fermée */ }
    PK.f.remove();
    PK = null;
    document.body.style.overflow = document.getElementById('overlay') ? 'hidden' : '';
  }
  function openFull(mode) {
    if (PK) return;
    const pick = mode === 'pick', has = ED.lat != null;
    const f = document.createElement('div');
    f.className = 'nzm-full pl-full ' + (pick ? 'pl-pick' : 'pl-view');
    f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true');
    f.innerHTML = '<div class="fh"><button type="button" class="icon-btn" data-act="pl-close" aria-label="Fermer">' + str(ic('x', 26)) + '</button><b>' + (pick ? 'Choisir le lieu' : 'Tous les repères') + '</b></div>'
      + '<div class="fb">' + (pick ? '<div class="pl-cross" aria-hidden="true">' + M.pinSvg('#e4572e', M.GLYPH_DOT) + '</div>' : '')
      + '<button type="button" class="pl-loc" data-act="pl-pick-here">' + str(ic('pin', 20)) + '<span>Ma position</span></button></div>'
      + (pick ? '<div class="fs"><small>Déplacez la carte : la pointe du repère montre le lieu.</small><div class="pl-coord" data-vid="pl-coord">—</div>'
        + '<div class="btn-row">' + str(btn({ label: 'Annuler', kind: 'ghost', act: 'pl-close' })) + str(btn({ label: 'Valider ce point', act: 'pl-pick-ok' })) + '</div></div>'
        : '<div class="fs"><small>Touchez + pour zoomer : les noms apparaissent en s\'approchant.</small></div>');
    document.body.appendChild(f);
    document.body.style.overflow = 'hidden';
    const map = M.create({ label: pick ? 'Choisir le lieu' : 'Tous les repères', center: has ? { lat: ED.lat, lng: ED.lng } : M.AGADEZ, zoom: has ? 18 : 15 });
    const fb = f.querySelector('.fb');
    fb.insertBefore(map.el, fb.firstChild);
    map.setInteractive(true);
    if (!pick) map.el.classList.add('pl-all');
    PK = { f, map, t: 0 };
    attach(map);
    map.resize();
    if (pick) {
      const out = f.querySelector('[data-vid=pl-coord]');
      const upd = () => { if (!PK) return; const c = map.view().center; out.textContent = c.lat.toFixed(5) + ', ' + c.lng.toFixed(5); };
      PK.t = setInterval(upd, 250); upd();
    } else if (PL.items.length) {
      map.fit(PL.items.map((it) => ({ lat: it.lat, lng: it.lng })), { maxZoom: 17 });
    }
  }
  NZ.act('pl-pick', () => openFull('pick'));
  NZ.act('pl-all', () => openFull('all'));
  NZ.act('pl-close', closeFull);
  NZ.act('pl-pick-ok', () => {
    if (!PK) return;
    const c = PK.map.view().center;
    ED.lat = c.lat; ED.lng = c.lng; ED.acc = null;
    closeFull(); repaintPos();
  });
  NZ.act('pl-pick-here', async (el) => {
    await U.busy(el, async () => {
      try { const g = await locate(); if (PK) PK.map.setView({ lat: g.lat, lng: g.lng }, 18); } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.on('route', closeFull);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFull(); });

  NZ.places = { load, attach, paint, parseCoords, kinds: KINDS, items: () => PL.items, _state: () => ({ PL, ED, PK }) };
})((window.NZ = window.NZ || {}));
