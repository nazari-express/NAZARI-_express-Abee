/* Nazari Express — la carte d'une course.
   CLIENT : il voit son livreur arriver en direct (position envoyée par le téléphone du livreur, application ouverte).
   LIVREUR : il voit le client sur la carte (le point GPS que le client a partagé), sa propre position, et la distance.
   Le partage de position par le client (GPS de l'adresse) n'est pas touché : on ne fait que le lire. */
(function (NZ) {
  'use strict';
  const U = NZ.ui, V = NZ.v, M = NZ.map;
  const { ic } = U;
  const ACTIVE = ['accepted', 'preparing', 'in_delivery'];
  const OFF_KEY = 'nz.track.off';
  const POLL_MS = 6000;          // le client demande la position du livreur toutes les 6 s
  const PING_MS = 7000;          // le livreur envoie au plus toutes les 7 s…
  const HEART_MS = 25000;        // …et au moins toutes les 25 s, même à l'arrêt
  const MOVE_M = 12;             // un déplacement de 12 m suffit pour renvoyer
  const FRESH_S = 45;            // « en direct » : position de moins de 45 s

  const gpsOf = (s) => { const g = V.geoParse(s); return g ? { lat: g.lat, lng: g.lng } : null; };
  const pointsOf = (o) => ({ from: gpsOf(o.pickup && o.pickup.details), to: gpsOf(o.drop && o.drop.details) });
  /* le point du CLIENT : lui-même qui envoie un colis (enlèvement) ou le lieu où l'on lui livre (retrait agence, pharmacie) */
  const isSend = (o) => o.service === 'parcel' || o.service === 'agency_drop';
  const clientPoint = (o) => { const p = pointsOf(o); return isSend(o) ? p.from : p.to; };
  const ago = (s) => (s < 120 ? 'moins de 2 min' : Math.round(s / 60) + ' min');
  const EXPAND = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
  const INFO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01" stroke-width="2.4"/></svg>';
  const $ = (root, sel) => root.querySelector(sel);

  /* ---------- repères de la course (les points GPS que le client a partagés) ---------- */
  function paintPoints(map, o, who) {
    const p = pointsOf(o), mineKey = isSend(o) ? 'from' : 'to';
    [['from', p.from], ['to', p.to]].forEach(([k, pt]) => {
      if (!pt) return map.removeMarker('pt-' + k);
      const isClient = k === mineKey;
      const label = isClient ? (who === 'client' ? 'Chez vous' : 'Client') : (k === 'from' ? 'Enlèvement' : 'Livraison');
      map.setMarker('pt-' + k, {
        lat: pt.lat, lng: pt.lng, kind: 'pin ' + k, label,
        html: '<div class="in">' + M.pinSvg(isClient ? '#d9622b' : '#2f86c8', isClient ? M.GLYPH_HOME : M.GLYPH_DOT) + '</div>',
      });
    });
    return [p.from, p.to].filter(Boolean);
  }

  /* ---------- un panneau = un cadre (titre, état, carte, boutons) qui survit aux réaffichages de l'écran ---------- */
  let CUR = null;      // panneau dont la carte peut s'agrandir
  let FULL = null;     // { p, f } : carte en plein écran
  function makePanel(o, cfg) {
    const root = document.createElement('div');
    root.className = cfg.box + ' mpc';
    root.dataset.vid = 'mp-card';
    root.hidden = !!cfg.hidden;
    root.innerHTML = '<div class="mp-h"><h2></h2><span class="mp-pill" data-vid="mp-pill"></span></div>'
      + '<p class="mp-t" data-vid="mp-text"></p><p class="mp-s" data-vid="mp-sub" hidden></p>'
      + '<div class="mp-map" data-vid="mp-map"><button type="button" class="mp-exp" data-act="mp-full" data-vid="mp-expand">' + EXPAND + 'Agrandir</button></div>'
      + '<div class="mp-extra"></div>';
    $(root, 'h2').textContent = cfg.title;
    const host = $(root, '.mp-map');
    const p = { id: o.id, order: o, root, host, title: cfg.title, dead: false, who: cfg.who, extra: $(root, '.mp-extra') };
    p.map = M.create({ label: cfg.title, onTap: () => openFull(p) });
    host.insertBefore(p.map.el, host.firstChild);
    if (NZ.places) NZ.places.attach(p.map);        // entreprises, projets et lieux ajoutés par l'administrateur (avec leur nom)
    p.say = (main, sub, pill, kind) => {
      $(root, '.mp-t').textContent = main;
      const s = $(root, '.mp-s'); s.textContent = sub || ''; s.hidden = !sub;
      const b = $(root, '.mp-pill'); b.textContent = pill || ''; b.className = 'mp-pill ' + (kind || ''); b.hidden = !pill;
      p.said = { main, sub: sub || '' };
      if (FULL && FULL.p === p) paintFull();
    };
    p.destroy = () => {
      p.dead = true;
      if (FULL && FULL.p === p) closeFull();
      p.map.destroy();
      root.remove();
    };
    CUR = p;
    return p;
  }
  /* cadrage : dès qu'un nouveau repère apparaît (premier affichage, position du livreur qui arrive), on cadre tout, bien centré ;
     ensuite le cadrage reste doux : il ne bouge que si un repère sort du cadre, et laisse la personne déplacer la carte */
  function frame(p, list) {
    if (!list.length) return;
    if (p.nfit !== list.length) { p.nfit = list.length; p.map.fit(list, { maxZoom: 18 }); }
    else p.map.fitAuto(list, { maxZoom: 18 });
  }
  function paintFull() {
    if (!FULL) return;
    const s = $(FULL.f, '.fs'), d = FULL.p.said || { main: '', sub: '' };
    s.textContent = d.main;
    if (d.sub) { const sm = document.createElement('small'); sm.textContent = d.sub; s.appendChild(sm); }
  }
  function openFull(p) {
    if (FULL || !p || p.dead) return;
    const f = document.createElement('div');
    f.className = 'nzm-full';
    f.dataset.vid = 'mp-fullscreen';
    f.innerHTML = '<div class="fh"><button type="button" class="icon-btn" data-act="mp-close" data-vid="mp-close" aria-label="Fermer la carte">' + U.str(ic('x', 26)) + '</button><b></b></div><div class="fb"></div><div class="fs"></div>';
    $(f, 'b').textContent = p.title;
    document.body.appendChild(f);
    document.body.style.overflow = 'hidden';
    $(f, '.fb').appendChild(p.map.el);
    p.map.setInteractive(true);
    FULL = { p, f };
    p.map.resize();
    paintFull();
  }
  function closeFull() {
    if (!FULL) return;
    const { p, f } = FULL;
    FULL = null;
    p.map.setInteractive(false);
    p.host.insertBefore(p.map.el, p.host.firstChild);
    f.remove();
    if (!document.getElementById('overlay') && !document.getElementById('drawer')) document.body.style.overflow = '';
    p.map.fit();       // la petite carte reprend son cadrage automatique (tout voir)
    p.map.resize();
  }
  NZ.act('mp-full', () => { if (CUR) openFull(CUR); });
  NZ.act('mp-close', closeFull);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFull(); });

  /* =====================================================================
     CLIENT : « Suivre mon livreur »
     ===================================================================== */
  let CP = null;
  function stopClient() { if (CP) { CP.destroy(); CP = null; } }

  function paintClient(p) {
    if (p.dead) return;
    const o = p.order, pos = p.pos;
    if (!pos) { p.root.hidden = true; return; }     // pas de position récente : on n'affiche rien
    p.root.hidden = false;
    const age = pos.age + (Date.now() - pos.at) / 1000;
    const live = age <= FRESH_S && !p.lost;
    const here = { lat: pos.lat, lng: pos.lng };
    const el = p.map.setMarker('drv', { lat: here.lat, lng: here.lng, kind: 'drv', html: '<div class="in">' + M.SCOOTER + '</div>' });
    if (el) el.classList.toggle('live', live);
    const pts = paintPoints(p.map, o, 'client');
    const me = clientPoint(o);
    if (me) p.map.setLine('route', [here, me]); else p.map.removeLine('route');
    frame(p, [here].concat(pts));

    const d = me ? M.dist(here, me) : null;
    const goingToClient = isSend(o) ? o.status !== 'in_delivery' : o.status === 'in_delivery';
    let main, sub = '';
    if (!live) {
      main = 'Dernière position connue de votre livreur.';
      sub = p.lost ? 'Pas de réseau pour le moment. Nouvel essai en cours…' : 'Il y a ' + ago(age) + '.';
    } else if (goingToClient) {
      main = d != null && d < 120 ? 'Votre livreur est tout près !' : 'Votre livreur arrive.';
      if (d != null && d >= 120) sub = 'À ' + M.fmtDist(d) + ' de vous · ' + M.fmtEta(d);
    } else {
      main = isSend(o) ? 'Votre colis est en route.' : (o.service === 'pharmacy' ? 'Votre livreur va récupérer votre commande.' : 'Votre livreur va récupérer votre colis.');
      if (d != null) sub = 'Votre livreur est à ' + M.fmtDist(d) + ' de vous.';
    }
    p.say(main, sub, live ? 'En direct' : 'Il y a ' + ago(age), live ? 'live' : 'warn');
  }
  async function tickClient(p) {
    if (!p || p.dead) return;
    let d;
    try { d = await NZ.api('track.get', { order_id: p.id }, { timeout: 12000 }); } catch (e) {
      if (p.dead) return;
      if (e && e.code === 'not_found') return stopClient();
      p.lost = true; paintClient(p);
      return;
    }
    if (p.dead) return;
    p.lost = false;
    p.pos = d && d.on && d.pos ? Object.assign({}, d.pos, { at: Date.now() }) : null;
    paintClient(p);
  }
  /* appelé après CHAQUE dessin de l'écran « Suivi du colis » */
  function clientAttach(ctx, r) {
    const o = r.order, slot = document.getElementById('mp-slot');
    if (!slot || !o.driver || !ACTIVE.includes(o.status)) return stopClient();
    if (!CP || CP.id !== o.id) {
      stopClient();
      CP = makePanel(o, { box: 'cbox', title: 'Suivre mon livreur', who: 'client', hidden: true });
      const p = CP;
      ctx.poll(POLL_MS, () => tickClient(p));
      tickClient(p);
    }
    CP.order = o;
    slot.appendChild(CP.root);
    CP.map.resize();
    paintClient(CP);
  }

  /* =====================================================================
     LIVREUR : carte de la course + partage de sa position avec le client
     ===================================================================== */
  let DP = null;
  const sharing = () => NZ.store.get(OFF_KEY, '') !== '1';
  function stopDriver() {
    if (!DP) return;
    const p = DP;
    DP = null;
    p.dead = true;
    try { if (p.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(p.watch); } catch (e) { /* ignore */ }
    try { if (p.wl) p.wl.release(); } catch (e) { /* ignore */ }
    clearInterval(p.beat);
    clearTimeout(p.later);
    p.destroy();
  }
  async function wake(p) {
    try {
      if (p.dead || p.wl || document.hidden || !navigator.wakeLock) return;
      p.wl = await navigator.wakeLock.request('screen');
      p.wl.addEventListener('release', () => { p.wl = null; });
    } catch (e) { /* écran allumé : tant pis si le téléphone refuse */ }
  }
  document.addEventListener('visibilitychange', () => { if (DP && !document.hidden) wake(DP); });

  function nextStop(o) {
    const p = pointsOf(o), mineKey = isSend(o) ? 'from' : 'to';
    const order = o.status === 'in_delivery' ? ['to', 'from'] : ['from', 'to'];
    const k = order.find((x) => p[x]);
    if (!k) return null;
    return { k, pt: p[k], label: k === mineKey ? 'Chez le client' : (k === 'from' ? 'Enlèvement' : 'Livraison') };
  }
  function paintDriver(p) {
    if (p.dead) return;
    const o = p.order, me = p.me;
    const pts = paintPoints(p.map, o, 'driver');
    if (me) {
      const el = p.map.setMarker('me', { lat: me.lat, lng: me.lng, kind: 'me', html: '<div class="in"></div>' });
      if (el) el.classList.add('live');
    }
    const next = nextStop(o);
    if (me && next) p.map.setLine('route', [me, next.pt]); else p.map.removeLine('route');
    frame(p, (me ? [me] : []).concat(pts));

    let main, sub = '';
    if (p.err === 'denied') { main = 'La position est refusée.'; sub = 'Autorisez la position dans les réglages du navigateur pour que le client vous voie arriver.'; }
    else if (p.err === 'unsupported') { main = 'Ce téléphone ne permet pas de suivre la position.'; }
    else if (!me) { main = 'Recherche de votre position…'; sub = p.err === 'unavail' ? 'Allez à l\'extérieur ou activez la localisation du téléphone.' : ''; }
    else if (next) {
      const d = M.dist(me, next.pt);
      main = next.label + ' : ' + M.fmtDist(d);
      sub = d >= 150 ? M.fmtEta(d) : 'Vous êtes tout près.';
    } else { main = 'Le client n\'a pas partagé sa position.'; sub = 'Utilisez l\'adresse indiquée plus bas. Le point bleu, c\'est vous.'; }

    let pill, kind;
    if (!sharing()) { pill = 'Partage arrêté'; kind = ''; }
    else if (p.err === 'denied' || p.err === 'unsupported') { pill = 'Non partagée'; kind = 'warn'; }
    else if (p.sentOk && Date.now() - p.sentOk < 45000) { pill = 'Le client vous voit'; kind = 'live'; }
    else if (p.sendErr) { pill = 'Pas de réseau'; kind = 'warn'; }
    else { pill = 'Envoi…'; kind = ''; }
    p.say(main, sub, pill, kind);
    const b = $(p.extra, '[data-vid=mp-share]');
    if (b) b.textContent = sharing() ? 'Arrêter de partager ma position' : 'Partager ma position avec le client';
  }
  function publish(p) {
    const me = p.me;
    if (p.dead || !me || !sharing()) return;
    if (me.acc != null && me.acc > 1000) return;                 // position trop imprécise : mieux vaut ne rien montrer au client
    const now = Date.now(), l = p.last;
    if (l && now - l.t < PING_MS) {
      // trop tôt : si le livreur a bougé, on renverra dès que c'est permis (pas besoin d'attendre le prochain signe de vie)
      if (M.dist(l, me) >= MOVE_M && !p.later) p.later = setTimeout(() => { p.later = 0; publish(p); }, PING_MS - (now - l.t) + 30);
      return;
    }
    if (l && M.dist(l, me) < MOVE_M && now - l.t < HEART_MS) return;
    if (p.inflight) { if (!p.later) p.later = setTimeout(() => { p.later = 0; publish(p); }, 1500); return; }
    p.last = { t: now, lat: me.lat, lng: me.lng };
    const args = { lat: me.lat, lng: me.lng };
    if (me.acc != null) args.acc = me.acc;
    if (me.hdg != null) args.hdg = me.hdg;
    if (me.spd != null) args.spd = me.spd;
    p.inflight = true;
    NZ.api('track.ping', args, { timeout: 10000 }).then((r) => {
      p.inflight = false;
      if (p.dead) return;
      p.sendErr = false;
      p.sentOk = r && r.stored === false && r.why === 'no_order' ? 0 : Date.now();
      paintDriver(p);
    }).catch((e) => {
      p.inflight = false;
      if (p.dead) return;
      p.sendErr = !!(e && e.network); p.last = null; paintDriver(p);
    });
  }
  function startDriver(p) {
    wake(p);
    if (!navigator.geolocation) { p.err = 'unsupported'; return paintDriver(p); }
    p.watch = navigator.geolocation.watchPosition((pos) => {
      if (p.dead) return;
      const c = pos.coords;
      p.err = '';
      p.me = {
        lat: c.latitude, lng: c.longitude,
        acc: isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
        hdg: isFinite(c.heading) && c.heading != null ? Math.round(c.heading) : null,
        spd: isFinite(c.speed) && c.speed != null ? Math.round(c.speed * 3.6) : null,
      };
      paintDriver(p);
      publish(p);
    }, (e) => {
      if (p.dead) return;
      p.err = e && e.code === 1 ? 'denied' : 'unavail';
      paintDriver(p);
    }, { enableHighAccuracy: true, maximumAge: 4000, timeout: 30000 });
    // si le téléphone ne bouge pas, on renvoie quand même un signe de vie
    p.beat = setInterval(() => publish(p), HEART_MS);
  }
  function driverAttach(ctx, r) {
    const o = r.order, me = NZ.user(), slot = document.getElementById('mp-slot');
    const mine = !!(o.driver && me && o.driver.id === me.id && ACTIVE.includes(o.status));
    if (!slot || !mine) return stopDriver();
    if (!DP || DP.id !== o.id) {
      stopDriver();
      DP = makePanel(o, { box: 'card', title: 'Carte', who: 'driver' });
      DP.extra.innerHTML = '<div class="mp-row"><button type="button" class="btn ghost sm" data-act="mp-share" data-vid="mp-share"></button></div>'
        + '<p class="mp-hint">' + INFO + '<span>Gardez cet écran allumé : le client vous voit arriver tant que l\'application reste ouverte.</span></p>';
      startDriver(DP);
    }
    DP.order = o;
    slot.appendChild(DP.root);
    DP.map.resize();
    paintDriver(DP);
  }
  NZ.act('mp-share', () => {
    const p = DP;
    if (!p) return;
    if (sharing()) {
      NZ.store.set(OFF_KEY, '1');
      NZ.api('track.stop', {}).catch(() => {});
      p.sentOk = 0; p.last = null;
      U.toast('Le client ne voit plus votre position.', 'ok');
    } else {
      NZ.store.del(OFF_KEY);
      p.last = null;
      U.toast('Le client vous voit arriver.', 'ok');
      publish(p);
    }
    paintDriver(p);
  });

  /* ---------- à chaque changement d'écran : on ferme tout (la carte plein écran, les suivis en cours) ---------- */
  NZ.on('route', () => { closeFull(); stopClient(); stopDriver(); CUR = null; });

  NZ.track = {
    /* emplacement réservé dans l'écran : le panneau y est posé après chaque dessin */
    slot: U.raw('<div id="mp-slot"></div>'),
    client: clientAttach, driver: driverAttach,
    pointsOf, clientPoint, nextStop,
    _state: () => ({ client: CP, driver: DP, full: FULL }),
  };
})((window.NZ = window.NZ || {}));
