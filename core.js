/* Nazari Express — noyau : stockage, API, routeur, coque de page, menu. */
(function (NZ) {
  'use strict';
  const U = NZ.ui;
  const { html, str, ic, esc, btn, toast } = U;

  /* ---------- stockage : ne bloque jamais, même si le navigateur le refuse ---------- */
  const mem = {};
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch (e) { /* ignore */ }
      return k in mem ? mem[k] : d;
    },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  NZ.store = store;

  /* ---------- petit bus d'événements ---------- */
  const bus = {};
  NZ.on = (n, fn) => { (bus[n] = bus[n] || []).push(fn); };
  NZ.emit = (n, ...a) => { (bus[n] || []).forEach((fn) => { try { fn(...a); } catch (e) { console.error(e); } }); };

  /* ---------- API ---------- */
  const ENDPOINT = window.NZ_ENDPOINT || 'https://auzbestspfwjtityfucm.supabase.co/rest/v1/rpc/nz_api';
  const API_KEY = 'sb_publishable_e76S6aXK2Jx_nULSX9Ssxg_7qyB9TxM';
  class ApiError extends Error {
    constructor(code, message, extra) { super(message); this.code = code; Object.assign(this, extra || {}); }
  }
  NZ.ApiError = ApiError;

  async function once(action, args, opts) {
    const token = opts.anon ? null : (NZ.session && NZ.session.token) || null;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout || 20000);
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { apikey: API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ p_action: action, p_token: token, p_args: args || {} }),
        signal: ctl.signal,
        cache: 'no-store',
      });
    } catch (e) {
      throw new ApiError('network', 'Pas de connexion. Vérifiez votre réseau puis réessayez.', { network: true });
    } finally { clearTimeout(timer); }
    let body = null;
    try { body = await res.json(); } catch (e) { /* corps vide ou illisible */ }
    if (!res.ok || !body || typeof body !== 'object' || !('ok' in body)) {
      throw new ApiError('server', 'Le service est momentanément indisponible. Réessayez dans un instant.', { status: res.status, detail: body });
    }
    if (!body.ok) {
      if (body.error === 'auth' && token) NZ.authLost();
      throw new ApiError(body.error || 'error', body.message || 'Une erreur est survenue.');
    }
    return body.data;
  }
  async function api(action, args, opts) {
    opts = opts || {};
    const tries = 1 + (opts.retry || 0);
    let last;
    for (let i = 0; i < tries; i++) {
      try { return await once(action, args, opts); } catch (e) {
        last = e;
        if (!e.network || i === tries - 1) throw e;
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      }
    }
    throw last;
  }
  NZ.api = api;

  /* ---------- session ---------- */
  NZ.session = store.get('nz.s', null);
  if (NZ.session && (!NZ.session.token || !NZ.session.user)) NZ.session = null;
  NZ.me = null;
  NZ.user = () => (NZ.session && NZ.session.user) || null;
  NZ.role = () => (NZ.user() ? NZ.user().role : null);
  NZ.isStaff = () => ['driver', 'admin'].includes(NZ.role());
  NZ.setSession = (s) => { NZ.session = s; NZ.me = null; if (s) store.set('nz.s', s); else store.del('nz.s'); };
  NZ.homeHash = () => ({ admin: '#/admin', driver: '#/driver' }[NZ.role()] || '#/');
  NZ.authLost = function () {
    if (!NZ.session) return;
    NZ.setSession(null);
    toast('Votre session a expiré. Reconnectez-vous.', 'err');
    NZ.go('/login', { replace: true });
  };
  NZ.logout = async function () {
    try { await api('logout', {}, { timeout: 6000 }); } catch (e) { /* hors ligne : on oublie quand même la session */ }
    NZ.setSession(null);
    NZ.draft = null;
    NZ.go('/login', { replace: true });
  };

  /* ---------- configuration publique (prix, quartiers, partenaires) ---------- */
  NZ.config = store.get('nz.cfg', null);
  NZ.loadConfig = async function () {
    try {
      const c = await api('config', {}, { anon: true, retry: 1 });
      NZ.config = c; store.set('nz.cfg', c);
    } catch (e) { if (!NZ.config) throw e; }
    return NZ.config;
  };
  NZ.company = () => (NZ.config && NZ.config.company) || { name: 'Nazari Express', tagline: 'Vos colis, notre priorité', whatsapp: '', maintenance: false };
  NZ.prices = () => (NZ.config && NZ.config.prices) || { small: 1000, medium: 1500, large: 2500, xl: 5000, express: 1000, far: 500, pharmacy: 1000 };
  NZ.waHref = (text) => U.waLink(NZ.company().whatsapp, text);
  function brandParts() {
    const n = String(NZ.company().name || 'Nazari Express').trim();
    const i = n.indexOf(' ');
    return i < 0 ? [n, ''] : [n.slice(0, i), n.slice(i + 1)];
  }
  NZ.brandParts = brandParts;

  /* zone d'un quartier saisi : blank | unknown | near | far */
  NZ.zone = function (name) {
    const v = String(name || '').trim().toLowerCase();
    if (!v) return 'blank';
    const q = ((NZ.config && NZ.config.quartiers) || []).find((x) => String(x.name).toLowerCase() === v);
    return !q ? 'unknown' : q.far ? 'far' : 'near';
  };

  /* ---------- badges (messages, nouvelles commandes…) ---------- */
  function badgeValue(id) {
    const m = NZ.me; if (!m) return 0;
    if (id === 'messages' || id === 'bell') return m.unread || 0;
    if (id === 'orders') return (m.counts && m.counts.new) || 0;
    if (id === 'courses') return (m.counts && m.counts.available) || 0;
    return 0;
  }
  function paintBadges() {
    document.querySelectorAll('[data-badge]').forEach((el) => {
      const n = badgeValue(el.dataset.badge);
      el.hidden = !n;
      el.textContent = n > 99 ? '99+' : String(n);
    });
  }
  NZ.paintBadges = paintBadges;
  NZ.refreshMe = async function () {
    if (!NZ.session) return null;
    try {
      const m = await api('me', {}, { timeout: 12000 });
      const prev = NZ.me;
      NZ.me = m;
      if (m.user && NZ.session) {
        const roleChanged = m.user.role !== NZ.session.user.role;
        NZ.session.user = m.user; store.set('nz.s', NZ.session);
        if (roleChanged) NZ.emit('role-changed', m.user);
      }
      paintBadges();
      NZ.emit('me', m, prev);
      return m;
    } catch (e) { return null; }
  };

  /* ---------- routeur à base de « # » ---------- */
  NZ.routes = [];
  NZ.route = function (pattern, handler, opts) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (m, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    NZ.routes.push(Object.assign({ re, keys, handler }, opts || {}));
  };
  NZ.go = function (path, o) {
    const target = '#' + path;
    if (o && o.replace) { history.replaceState(null, '', target); dispatch(); return; }
    if (location.hash === target) { dispatch(); return; }
    location.hash = target;
  };
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  function find(path) {
    for (const r of NZ.routes) {
      const m = r.re.exec(path);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch (e) { params[k] = m[i + 1]; } });
        return { r, params };
      }
    }
    return null;
  }

  let gen = 0;
  let polls = [];
  const app = () => document.getElementById('app');
  function stopPolls() { polls.forEach((p) => clearInterval(p.id)); polls = []; }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    polls.forEach((p) => { p.fn().catch(() => {}); });
    NZ.refreshMe();
  });

  /* ---------- haut de page, onglets ---------- */
  const TABS = {
    client: [
      { id: 'home', label: 'Accueil', icon: 'home', href: '#/' },
      { id: 'messages', label: 'Messages', icon: 'chat', href: '#/messages' },
      { id: 'account', label: 'Compte', icon: 'user', href: '#/account' },
    ],
    driver: [
      { id: 'courses', label: 'Courses', icon: 'truck', href: '#/driver' },
      { id: 'messages', label: 'Messages', icon: 'chat', href: '#/messages' },
      { id: 'account', label: 'Compte', icon: 'user', href: '#/account' },
    ],
    admin: [
      { id: 'orders', label: 'Commandes', icon: 'list', href: '#/admin' },
      { id: 'stats', label: 'Tableau', icon: 'chart', href: '#/admin/stats' },
      { id: 'messages', label: 'Messages', icon: 'chat', href: '#/messages' },
      { id: 'more', label: 'Plus', icon: 'sliders', href: '#/admin/more' },
    ],
  };
  function topbar(o) {
    const u = NZ.user();
    const [a, b] = brandParts();
    let left = '';
    if (o.backAct) left = html`<button type="button" class="icon-btn" data-act="${o.backAct}" aria-label="Retour">${ic('back')}</button>`;
    else if (o.back) left = html`<a class="icon-btn" href="${o.back}" aria-label="Retour">${ic('back')}</a>`;
    else if (o.brand && u) left = html`<button type="button" class="icon-btn" data-act="open-menu" aria-label="Ouvrir le menu">${ic('menu')}</button>`;
    const mid = o.brand
      ? html`<div class="t-brand"><div class="wm"><svg class="logo" width="30" height="24" aria-hidden="true"><use href="#logo-mark"/></svg><span>${a}${b ? html`<b>${b}</b>` : ''}</span></div><small>${NZ.company().tagline}</small></div>`
      : html`<h1 class="t-title">${o.title}</h1>`;
    const right = o.brand
      ? html`<a class="icon-btn" href="#/messages" aria-label="Messages">${ic('bell')}<span class="badge" data-badge="bell" hidden></span></a>`
      : (o.right || (o.back ? '' : ''));
    const spacer = o.brand && !left ? html`<span style="width:44px"></span>` : '';
    return html`<header class="topbar">${left}${spacer}${mid}${right}</header>`;
  }
  function tabsHtml(active) {
    const set = TABS[NZ.role()] || TABS.client;
    return html`<nav class="tabs" aria-label="Navigation principale">${set.map((t) => html`<a class="tab${t.id === active ? ' on' : ''}" href="${t.href}"${t.id === active ? U.raw(' aria-current="page"') : ''}>${ic(t.icon, 24)}<span>${t.label}</span><span class="badge" data-badge="${t.id}" hidden></span></a>`)}</nav>`;
  }

  /* ---------- menu latéral ---------- */
  function menuLink(href, icon, label, act) {
    return act
      ? html`<button type="button" class="menu-link" data-act="${act}">${ic(icon, 22)}<span>${label}</span></button>`
      : html`<a class="menu-link" href="${href}" data-act="close-menu">${ic(icon, 22)}<span>${label}</span></a>`;
  }
  function openMenu() {
    closeMenu();
    const u = NZ.user();
    const role = NZ.role();
    const wa = NZ.waHref('Bonjour ' + NZ.company().name + ', ');
    const items = role === 'client' || !role ? [
      menuLink('#/', 'home', 'Accueil'),
      menuLink('#/new', 'plus', 'Nouvelle commande'),
      menuLink('#/orders', 'box', 'Mes commandes'),
      menuLink('#/track', 'pin', 'Suivre une commande'),
      menuLink('#/tarifs', 'tag', 'Nos tarifs'),
      menuLink('#/addresses', 'map', 'Mes adresses'),
      menuLink('#/help', 'help', 'Aide et questions'),
      menuLink('#/about', 'info', 'À propos'),
    ] : [
      menuLink(NZ.homeHash(), 'home', role === 'admin' ? 'Commandes' : 'Courses'),
      menuLink('#/new', 'plus', 'Passer une commande'),
      menuLink('#/messages', 'chat', 'Messages'),
      menuLink('#/account', 'user', 'Mon compte'),
    ];
    const el = document.createElement('div');
    el.className = 'drawer'; el.id = 'drawer';
    el.innerHTML = str(html`<div class="drawer-wrap"><div class="bg" data-act="close-menu"></div>
      <nav class="panel" aria-label="Menu">
        <div class="profile" style="padding:6px 8px 14px"><div class="avatar" style="width:52px;height:52px;font-size:20px">${U.initials(u ? u.name : '?')}</div>
          <div><div style="font-weight:800">${u ? u.name : ''}</div><div class="muted small">${u ? '+227 ' + U.fphone(u.phone) : ''}</div></div></div>
        ${items}
        <div class="menu-sep"></div>
        ${wa ? html`<a class="menu-link" href="${wa}" target="_blank" rel="noopener noreferrer">${ic('wa', 22)}<span>Nous écrire sur WhatsApp</span></a>` : ''}
        ${menuLink('', 'out', 'Se déconnecter', 'logout')}
      </nav></div>`);
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    const d = document.getElementById('drawer');
    if (d) d.remove();
    if (!document.getElementById('overlay')) document.body.style.overflow = '';
  }
  NZ.act('open-menu', openMenu);
  NZ.act('close-menu', closeMenu);
  NZ.act('logout', async () => {
    closeMenu();
    const ok = await U.confirmBox({ title: 'Se déconnecter ?', text: 'Vous devrez saisir à nouveau votre numéro et votre code PIN.', ok: 'Se déconnecter' });
    if (ok) NZ.logout();
  });
  NZ.act('back', () => { if (history.length > 1) history.back(); else NZ.go('/'); });

  /* ---------- répartiteur ---------- */
  async function dispatch() {
    const my = ++gen;
    const alive = () => my === gen;
    U.closeOverlay(); closeMenu(); stopPolls();
    NZ.bindTarget = null; NZ.onBind = null;
    let { path, query } = parseHash();
    const hit = find(path) || find('/404');
    const r = hit.r;
    const role = NZ.role();

    if (!r.public && !NZ.session) { NZ.next = location.hash; return NZ.go('/login', { replace: true }); }
    if (NZ.session && r.guestOnly) return NZ.go(NZ.homeHash().slice(1), { replace: true });
    if (path === '/' && role && role !== 'client') return NZ.go(NZ.homeHash().slice(1), { replace: true });
    if (r.roles && role && !r.roles.includes(role)) return NZ.go(NZ.homeHash().slice(1), { replace: true });

    const ctx = {
      params: hit.params, query, alive,
      /* dessine la coque (haut, onglets) avec un chargement en attendant les données */
      shell(o) {
        if (!alive()) return null;
        o = o || {};
        const tabs = o.tab && NZ.session;
        app().innerHTML = str(html`<div class="shell">${topbar(o)}<main id="main" class="${o.flush ? 'flush' : ''}${tabs ? '' : ' no-tabs'}" tabindex="-1">${o.skeleton === false ? '' : U.skeleton(3)}</main>${tabs ? tabsHtml(o.tab) : ''}</div>`);
        paintBadges();
        window.scrollTo(0, 0);
        document.title = (o.title ? o.title + ' · ' : '') + NZ.company().name;
        return document.getElementById('main');
      },
      main(content) {
        if (!alive()) return null;
        const m = document.getElementById('main');
        if (m) m.innerHTML = str(content);
        return m;
      },
      plain(content) { if (alive()) { app().innerHTML = str(content); window.scrollTo(0, 0); document.title = NZ.company().name; } },
      poll(ms, fn) {
        const id = setInterval(() => { if (!alive() || document.hidden) return; fn().catch(() => {}); }, ms);
        polls.push({ id, fn: async () => { if (alive()) await fn(); } });
      },
      fail(e) {
        if (!alive()) return;
        const m = document.getElementById('main');
        const net = !!(e && e.network);
        const content = U.empty('alert', net ? 'Pas de connexion' : 'Un souci est survenu', net ? 'Vérifiez votre réseau puis réessayez.' : ((e && e.message) || 'Réessayez dans un instant.'), btn({ label: 'Réessayer', act: 'retry', kind: 'primary' }));
        if (m) m.innerHTML = str(content); else app().innerHTML = str(html`<main class="no-tabs" style="padding-top:60px">${content}</main>`);
      },
    };
    try {
      await r.handler(ctx);
    } catch (e) {
      if (!alive()) return;
      console.error(e);
      ctx.fail(e instanceof ApiError ? e : new ApiError('ui', 'Un souci est survenu. Réessayez.'));
    }
  }
  NZ.dispatch = dispatch;
  NZ.act('retry', () => dispatch());
  window.addEventListener('hashchange', dispatch);

  window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); });

  /* ---------- fonctions utiles aux écrans ---------- */
  NZ.scrollKeep = (fn) => { const y = window.scrollY; fn(); window.scrollTo(0, y); };
  NZ.newKey = () => {
    const a = new Uint8Array(12);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
  };
  NZ.errText = (e) => (e && e.message) || 'Une erreur est survenue.';
})((window.NZ = window.NZ || {}));
