/* Nazari Express — la carte : un petit moteur maison (fond OpenStreetMap), sans bibliothèque externe.
   Une carte = un élément DOM qui garde ses tuiles, ses repères et sa vue : quand un écran est redessiné,
   on DÉPLACE cet élément au lieu de le recréer (la carte ne clignote pas, ne revient pas à zéro).
   Fond de carte : une seule adresse à changer (TILE_URL) si l'on passe un jour à un fournisseur payant. */
(function (NZ) {
  'use strict';

  const TILE = 256, MIN_Z = 4, MAX_Z = 19;
  const TILE_URL = (z, x, y) => 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
  const NS = 'http://www.w3.org/2000/svg';
  const AGADEZ = { lat: 16.9733, lng: 7.9911 };
  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const okPt = (p) => !!p && typeof p.lat === 'number' && typeof p.lng === 'number' && isFinite(p.lat) && isFinite(p.lng);

  /* ---------- projection (Web Mercator, comme tous les fonds de carte) ---------- */
  const world = (lat, lng, z) => {
    const s = TILE * Math.pow(2, z);
    const sin = clamp(Math.sin(lat * RAD), -0.9999, 0.9999);
    return { x: (lng + 180) / 360 * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
  };
  const geo = (x, y, z) => {
    const s = TILE * Math.pow(2, z);
    const n = Math.PI - 2 * Math.PI * y / s;
    return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: x / s * 360 - 180 };
  };

  /* ---------- distances (en mètres, à vol d'oiseau) ---------- */
  const dist = (a, b) => {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * RAD, dLng = (b.lng - a.lng) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const fmtDist = (m) => {
    if (!(m >= 0)) return '';
    if (m < 100) return Math.max(10, Math.round(m / 10) * 10) + ' m';
    if (m < 975) return Math.round(m / 50) * 50 + ' m';
    const km = m / 1000;
    return (km < 10 ? km.toFixed(1) : String(Math.round(km))).replace('.', ',') + ' km';
  };
  /* durée approximative : route ≈ 1,35 × le vol d'oiseau, 20 km/h en ville (moto) */
  const etaMin = (m) => Math.max(1, Math.round(m * 1.35 / 333));
  const fmtEta = (m) => (m >= 150 ? 'environ ' + etaMin(m) + ' min' : '');

  /* ---------- dessins des repères (nos propres balises : aucun texte venant d'un utilisateur) ---------- */
  const pinSvg = (fill, glyph) => '<svg viewBox="0 0 30 40" width="30" height="40" aria-hidden="true"><path d="M15 38.5S28 25 28 14.5C28 7.3 22.2 1.5 15 1.5S2 7.3 2 14.5C2 25 15 38.5 15 38.5z" fill="' + fill + '" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>' + glyph + '</svg>';
  const GLYPH_HOME = '<path d="M9 15.2v-4.4l6-4.6 6 4.6v4.4z" fill="#fff"/>';
  const GLYPH_DOT = '<circle cx="15" cy="14.5" r="4.6" fill="#fff"/>';
  const SCOOTER = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="17" r="2.6"/><circle cx="18.5" cy="17" r="2.6"/><path d="M8 17h8"/><path d="M18.5 17 16 6.5h-2.5"/><path d="M5.5 14.4c.4-2.7 2.2-4 4.8-4H13l1.4 4.1"/></svg>';

  /* ---------- une carte ---------- */
  function create(opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'nzmap';
    el.setAttribute('role', 'application');
    el.setAttribute('aria-label', opts.label || 'Carte');
    el.innerHTML = '<div class="nzm-tiles"></div><svg class="nzm-lines" xmlns="' + NS + '" aria-hidden="true"></svg><div class="nzm-marks"></div>'
      + '<div class="nzm-ctl"><button type="button" class="nzm-btn" data-z="1" aria-label="Zoom avant">+</button>'
      + '<button type="button" class="nzm-btn" data-z="-1" aria-label="Zoom arrière">−</button>'
      + '<button type="button" class="nzm-btn fit" data-fit="1" aria-label="Tout voir sur la carte"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4"/></svg></button></div>'
      + '<a class="nzm-attr" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>'
      + '<div class="nzm-note" hidden>Le fond de carte ne s\'affiche pas (réseau faible). Les repères restent exacts.</div>';
    const tilesEl = el.querySelector('.nzm-tiles'), svg = el.querySelector('.nzm-lines'),
      marksEl = el.querySelector('.nzm-marks'), noteEl = el.querySelector('.nzm-note');

    let center = opts.center && okPt(opts.center) ? { lat: opts.center.lat, lng: opts.center.lng } : { lat: AGADEZ.lat, lng: AGADEZ.lng };
    let zoom = clamp(opts.zoom || 14, MIN_Z, MAX_Z);
    let W = 0, H = 0, raf = 0, userMoved = false, interactive = false, dead = false, autoPts = null, autoOpts = null;
    let loaded = 0, failed = 0;
    const tiles = new Map(), marks = new Map(), lines = new Map();

    const measure = () => { W = el.clientWidth; H = el.clientHeight; return W > 0 && H > 0; };
    const schedule = () => { if (!raf && !dead) raf = requestAnimationFrame(render); };
    const noteCheck = () => { if (failed >= 2 && loaded === 0) noteEl.hidden = false; };

    function tile(key, z, x, y, n) {
      const img = new Image();
      const t = { img, x, y, z, tries: 0 };
      const url = TILE_URL(z, ((x % n) + n) % n, y);
      img.alt = ''; img.draggable = false; img.decoding = 'async'; img.referrerPolicy = 'origin'; img.className = 'nzm-t';
      img.onload = () => { img.classList.add('ok'); loaded++; noteEl.hidden = true; };
      img.onerror = () => {
        failed++; noteCheck();
        img.classList.add('bad');
        if (t.tries < 2) {       // réseau faible : deux nouveaux essais, espacés (avec une nouvelle image : pas d'événement parasite)
          const wait = 3000 + 5000 * t.tries;
          setTimeout(() => {
            if (dead || tiles.get(key) !== t) return;
            img.remove();
            const nt = tile(key, z, x, y, n);
            nt.tries = t.tries + 1;
            tiles.set(key, nt);
            schedule();
          }, wait);
        }
      };
      img.src = url;
      tilesEl.appendChild(img);
      return t;
    }

    function render() {
      raf = 0;
      if (dead) return;
      if (!measure()) return;                       // pas affichée pour l'instant : le prochain changement de taille la dessinera
      el.classList.toggle('z-mid', zoom >= 14);      // les repères (entreprises, lieux) apparaissent de près…
      el.classList.toggle('z-hi', zoom >= 16);       // …et leur nom encore plus près
      const c = world(center.lat, center.lng, zoom);
      const ox = Math.round(c.x - W / 2), oy = Math.round(c.y - H / 2);
      const n = Math.pow(2, zoom);
      const x0 = Math.floor(ox / TILE), x1 = Math.floor((ox + W - 1) / TILE);
      const y0 = Math.max(0, Math.floor(oy / TILE)), y1 = Math.min(n - 1, Math.floor((oy + H - 1) / TILE));
      const need = new Set();
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const key = zoom + '/' + tx + '/' + ty;
          need.add(key);
          let t = tiles.get(key);
          if (!t) { t = tile(key, zoom, tx, ty, n); tiles.set(key, t); }
          t.img.style.transform = 'translate(' + (tx * TILE - ox) + 'px,' + (ty * TILE - oy) + 'px)';
        }
      }
      // ménage : on garde les voisines du même zoom (retour en arrière sans rechargement), on retire le reste
      for (const [key, t] of tiles) {
        if (need.has(key)) continue;
        if (t.z === zoom && t.x >= x0 - 1 && t.x <= x1 + 1 && t.y >= y0 - 1 && t.y <= y1 + 1) continue;
        t.img.remove(); tiles.delete(key);
      }
      const near = [];
      for (const m of marks.values()) {
        const p = world(m.lat, m.lng, zoom), x = p.x - ox, y = p.y - oy;
        m.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        const off = x < -80 || y < -80 || x > W + 80 || y > H + 80;
        m.el.style.display = off ? 'none' : '';
        if (!off) { m.x = x; m.y = y; near.push(m); }
      }
      if (zoom >= 16 || el.classList.contains('pl-all')) declutter(near);
      for (const l of lines.values()) {
        l.el.setAttribute('points', l.pts.map((q) => { const p = world(q.lat, q.lng, zoom); return (p.x - ox).toFixed(1) + ',' + (p.y - oy).toFixed(1); }).join(' '));
      }
      el.dataset.zoom = String(zoom);
      el.dataset.lat = center.lat.toFixed(5);
      el.dataset.lng = center.lng.toFixed(5);
    }

    /* noms de repères qui se chevauchent : on garde les premiers, on masque les suivants (ils reviennent en zoomant).
       Les points de la course (livreur, client, moi) et leur nom sont prioritaires : un nom de lieu ne les recouvre jamais. */
    function declutter(near) {
      const list = near.length > 150 ? near.slice(0, 150) : near;
      const taken = [];
      const hit = (r, self) => taken.some((t) => t.m !== self && r[0] < t.r[2] && r[2] > t.r[0] && r[1] < t.r[3] && r[3] > t.r[1]);
      const wid = (m) => { if (!m.lw && m.lb) m.lw = m.lb.offsetWidth; return m.lw; };
      for (const m of list) {
        if (m.poi) { taken.push({ m, r: [m.x - 13, m.y - 13, m.x + 13, m.y + 13] }); continue; }
        taken.push({ m, r: [m.x - 23, m.y - 42, m.x + 23, m.y + 24] });
        const w = wid(m);
        if (w) taken.push({ m, r: [m.x - w / 2, m.y + 5, m.x + w / 2, m.y + 27] });
      }
      for (const m of list) {
        if (!m.poi || !m.lb) continue;
        const w = wid(m);
        if (!w) { m.el.classList.remove('nolb'); continue; }       // pas encore mesurable (carte cachée) : on ne décide rien
        const r = [m.x - w / 2 - 2, m.y + 15, m.x + w / 2 + 2, m.y + 38];
        const bad = hit(r, m);
        m.el.classList.toggle('nolb', bad);
        if (!bad) taken.push({ m, r });
      }
    }

    /* ---------- repères et traits ---------- */
    function setMarker(id, o) {
      if (!okPt(o)) return null;
      let m = marks.get(id);
      if (!m) {
        const e = document.createElement('div');
        e.className = 'nzm-mk ' + (o.kind || '');
        e.innerHTML = (o.html || '') + (o.label ? '<span class="lb"></span>' : '');
        if (o.label) e.querySelector('.lb').textContent = o.label;
        marksEl.appendChild(e);
        m = { el: e, lat: o.lat, lng: o.lng, t: 0, poi: /(^| )poi( |$)/.test(o.kind || ''), lb: e.querySelector('.lb'), lw: 0, x: 0, y: 0 };
        marks.set(id, m);
      } else if (m.lat !== o.lat || m.lng !== o.lng) {
        m.el.classList.add('sm');                  // glisse en douceur vers la nouvelle position
        clearTimeout(m.t);
        m.t = setTimeout(() => m.el.classList.remove('sm'), 1300);
        m.lat = o.lat; m.lng = o.lng;
      }
      schedule();
      return m.el;
    }
    function removeMarker(id) { const m = marks.get(id); if (m) { clearTimeout(m.t); m.el.remove(); marks.delete(id); schedule(); } }
    function setLine(id, pts, cls) {
      const list = (pts || []).filter(okPt);
      if (list.length < 2) return removeLine(id);
      let l = lines.get(id);
      if (!l) {
        const e = document.createElementNS(NS, 'polyline');
        e.setAttribute('class', 'nzm-line ' + (cls || ''));
        svg.appendChild(e);
        l = { el: e, pts: list };
        lines.set(id, l);
      }
      l.pts = list;
      schedule();
    }
    function removeLine(id) { const l = lines.get(id); if (l) { l.el.remove(); lines.delete(id); schedule(); } }

    /* ---------- vue ---------- */
    function setView(c, z) {
      if (okPt(c)) center = { lat: c.lat, lng: c.lng };
      if (z != null) zoom = clamp(Math.round(z), MIN_Z, MAX_Z);
      schedule();
    }
    /* la meilleure vue pour voir tous les points ; null si la carte n'est pas affichée */
    function viewFor(points, o) {
      o = o || {};
      const pts = (points || []).filter(okPt);
      if (!pts.length || !measure()) return null;
      if (pts.length === 1) return { center: { lat: pts[0].lat, lng: pts[0].lng }, zoom: o.single || 17 };
      const pad = o.pad == null ? 48 : o.pad;
      for (let z = o.maxZoom || 17; z >= MIN_Z; z--) {
        const w = pts.map((p) => world(p.lat, p.lng, z));
        const minX = Math.min(...w.map((q) => q.x)), maxX = Math.max(...w.map((q) => q.x));
        const minY = Math.min(...w.map((q) => q.y)), maxY = Math.max(...w.map((q) => q.y));
        if (maxX - minX <= W - 2 * pad && maxY - minY <= H - 2 * pad) return { center: geo((minX + maxX) / 2, (minY + maxY) / 2, z), zoom: z };
      }
      const w = pts.map((p) => world(p.lat, p.lng, MIN_Z));
      return { center: geo((Math.min(...w.map((q) => q.x)) + Math.max(...w.map((q) => q.x))) / 2, (Math.min(...w.map((q) => q.y)) + Math.max(...w.map((q) => q.y))) / 2, MIN_Z), zoom: MIN_Z };
    }
    /* « tout voir » : revient à la vue automatique */
    function fit(points, o) {
      if (points) { autoPts = points.filter(okPt); autoOpts = o || null; }
      userMoved = false;
      const v = viewFor(autoPts, autoOpts);
      if (v) setView(v.center, v.zoom); else schedule();
    }
    /* vue automatique douce : ne bouge que si un point sort du cadre ou si le zoom peut changer ; s'arrête dès que la personne déplace la carte */
    function fitAuto(points, o) {
      autoPts = (points || []).filter(okPt); autoOpts = o || null;
      if (userMoved) return;
      const v = viewFor(autoPts, autoOpts);
      if (!v) return;
      if (v.zoom < zoom) return setView(v.center, v.zoom);          // un point sort du cadre : on dézoome tout de suite
      if (v.zoom > zoom) {                                           // on peut zoomer, mais avec de la marge : évite le va-et-vient de zoom près d'un seuil
        const vs = viewFor(autoPts, Object.assign({}, autoOpts, { pad: ((autoOpts && autoOpts.pad) || 48) + 36 }));
        if (vs && vs.zoom > zoom) return setView(v.center, v.zoom);
      }
      const c = world(center.lat, center.lng, zoom), m = 40;
      const out = autoPts.some((p) => { const q = world(p.lat, p.lng, zoom); return Math.abs(q.x - c.x) > W / 2 - m || Math.abs(q.y - c.y) > H / 2 - m; });
      if (out) setView(v.center, v.zoom);
    }
    function zoomBy(d, ax, ay) {
      const z = clamp(zoom + d, MIN_Z, MAX_Z);
      if (z === zoom) return;
      measure();
      if (ax == null) { ax = W / 2; ay = H / 2; }
      const c = world(center.lat, center.lng, zoom);
      const g = geo(c.x - W / 2 + ax, c.y - H / 2 + ay, zoom);     // le point sous le doigt reste sous le doigt
      zoom = z;
      const p = world(g.lat, g.lng, zoom);
      center = geo(p.x - (ax - W / 2), p.y - (ay - H / 2), zoom);
      userMoved = true;
      schedule();
    }
    function pan(dx, dy) {
      const c = world(center.lat, center.lng, zoom);
      center = geo(c.x - dx, c.y - dy, zoom);
      userMoved = true;
      schedule();
    }
    function resize() {
      measure();
      if (!userMoved && autoPts) { const v = viewFor(autoPts, autoOpts); if (v) { center = v.center; zoom = v.zoom; } }
      schedule();
    }
    function setInteractive(v) { interactive = !!v; el.classList.toggle('live', interactive); }

    /* ---------- au doigt, à la souris, aux boutons ---------- */
    const ptrs = new Map();
    let pinch0 = 0, lastWheel = 0;
    const local = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const spread = () => { const [a, b] = Array.from(ptrs.values()); return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
    const midpoint = () => {
      const [a, b] = Array.from(ptrs.values()); const r = el.getBoundingClientRect();
      return [(a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top];
    };
    el.addEventListener('pointerdown', (e) => {
      if (!interactive || (e.button != null && e.button > 0) || e.target.closest('.nzm-btn, .nzm-attr')) return;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pinch0 = ptrs.size === 2 ? spread() : 0;
    });
    el.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) return pan(dx, dy);
      if (ptrs.size === 2) {                       // deux doigts : le centre fait glisser, l'écart change le zoom par paliers
        pan(dx / 2, dy / 2);
        const s = spread();
        if (pinch0 && s / pinch0 > 1.7) { const [ax, ay] = midpoint(); zoomBy(1, ax, ay); pinch0 = s; }
        else if (pinch0 && s / pinch0 < 0.6) { const [ax, ay] = midpoint(); zoomBy(-1, ax, ay); pinch0 = s; }
      }
    });
    const up = (e) => { ptrs.delete(e.pointerId); pinch0 = ptrs.size === 2 ? spread() : 0; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      if (!interactive) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel < 220) return;
      lastWheel = now;
      const [ax, ay] = local(e);
      zoomBy(e.deltaY < 0 ? 1 : -1, ax, ay);
    }, { passive: false });
    el.addEventListener('dblclick', (e) => { if (!interactive || e.target.closest('.nzm-btn')) return; const [ax, ay] = local(e); zoomBy(1, ax, ay); });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.nzm-btn');
      if (b) {
        if (b.dataset.fit) fit(); else zoomBy(parseInt(b.dataset.z, 10) || 0);
        return;
      }
      if (!interactive && opts.onTap && !e.target.closest('.nzm-attr')) opts.onTap();
    });

    let ro = null;
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(() => resize()); ro.observe(el); }
    else window.addEventListener('resize', resize);

    function destroy() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      for (const t of tiles.values()) { t.img.onload = t.img.onerror = null; t.img.src = ''; }
      tiles.clear();
      marks.forEach((m) => clearTimeout(m.t));
      el.remove();
    }

    schedule();
    return { el, setMarker, removeMarker, setLine, removeLine, setView, fit, fitAuto, zoomBy, resize, setInteractive,
      destroy, view: () => ({ center: { lat: center.lat, lng: center.lng }, zoom, userMoved }), isAuto: () => !userMoved };
  }

  NZ.map = { create, world, geo, dist, fmtDist, etaMin, fmtEta, pinSvg, GLYPH_HOME, GLYPH_DOT, SCOOTER, TILE_URL, AGADEZ, MIN_Z, MAX_Z };
})((window.NZ = window.NZ || {}));
