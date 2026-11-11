/* Nazari Express — alertes sur le téléphone (notifications Web Push), même application fermée.
   - le téléphone s'inscrit auprès du service de notification de son navigateur (Chrome, etc.) ;
   - la base de données envoie ensuite chaque alerte (commande, livreur, message, annonce, message du jour) ;
   - tout se règle d'un toucher : « Activer » ; l'administrateur règle le message du jour dans Plus → Alertes du téléphone. */
(function (NZ) {
  'use strict';
  const U = NZ.ui, { html, ic, btn, field } = U;
  const store = NZ.store;
  const K_LATER = 'nz.push.later';   // « Plus tard » (7 jours)
  const K_REG = 'nz.push.reg';       // dernier enregistrement { ep, uid, t }
  const DAY = 86400000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const permission = () => (supported() ? Notification.permission : 'unsupported');   // default | granted | denied | unsupported
  const swReady = (ms = 6000) => Promise.race([navigator.serviceWorker.ready, sleep(ms).then(() => { throw new Error('Le téléphone n\'est pas prêt, réessayez dans un instant.'); })]);
  const fromB64u = (s) => {
    const p = String(s).replace(/-/g, '+').replace(/_/g, '/');
    const b = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  };
  const sameKey = (sub, key) => {
    try {
      const a = new Uint8Array(sub.options.applicationServerKey), b = fromB64u(key);
      return a.length === b.length && a.every((v, i) => v === b[i]);
    } catch (e) { return false; }
  };

  async function current() {
    if (!supported()) return null;
    try { return await (await swReady(2500)).pushManager.getSubscription(); } catch (e) { return null; }
  }
  // clé publique donnée par la base (la première fois, la fonction d'envoi la crée : on patiente un peu)
  async function serverKey() {
    for (let i = 0; i < 4; i++) {
      const r = await NZ.api('push.key', {}, { timeout: 8000, retry: 0 });
      if (r && r.key) return r.key;
      await sleep(2500);
    }
    return null;
  }
  async function register(sub) {
    const j = sub.toJSON();
    await NZ.api('push.sub', { endpoint: j.endpoint, keys: j.keys, ua: (navigator.userAgent || '').slice(0, 140) }, { retry: 1 });
    store.set(K_REG, { ep: j.endpoint, uid: NZ.user() && NZ.user().id, t: Date.now() });
  }

  /* Activer : à appeler depuis un bouton (le navigateur exige un geste de la personne). */
  async function enable() {
    if (!supported()) throw new Error('Ce téléphone ne permet pas les alertes.');
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p === 'denied') throw new Error('blocked');
    if (p !== 'granted') throw new Error('later');
    const key = await serverKey();
    if (!key) throw new Error('Les alertes ne sont pas encore prêtes. Réessayez dans une minute.');
    const reg = await swReady();
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, key)) { try { await sub.unsubscribe(); } catch (e) { /* ignore */ } sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(key) });
    await register(sub);
    store.del(K_LATER);
  }
  async function disable() {
    const sub = await current();
    if (sub) {
      try { await NZ.api('push.unsub', { endpoint: sub.endpoint }); } catch (e) { /* ignore */ }
      try { await sub.unsubscribe(); } catch (e) { /* ignore */ }
    }
    store.del(K_REG);
  }
  // déconnexion : ce téléphone ne reçoit plus les alertes de ce compte (l'abonnement du navigateur est gardé).
  // Rapide et sans le service worker : l'adresse de ce téléphone a été retenue à l'inscription. Ne bloque jamais la déconnexion (2,5 s au plus).
  async function detach() {
    const reg = store.get(K_REG, null);
    store.del(K_REG);
    if (!reg || !reg.ep || !NZ.session) return;
    try { await NZ.api('push.unsub', { endpoint: reg.ep }, { timeout: 2500, retry: 0 }); } catch (e) { /* ignore */ }
  }
  // au démarrage et après connexion : ce téléphone reçoit les alertes du compte connecté
  let syncing = null;
  function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        if (!NZ.session || permission() !== 'granted') return;
        let sub = await current();
        if (!sub) {                                  // autorisé mais abonnement perdu : on le recrée
          const key = await serverKey();
          if (!key) return;
          sub = await (await swReady()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(key) });
        }
        const last = store.get(K_REG, null);
        const uid = NZ.user() && NZ.user().id;
        if (last && last.ep === sub.endpoint && last.uid === uid && Date.now() - last.t < 6 * 3600000) return;
        await register(sub);
      } catch (e) { /* silencieux : on réessaiera au prochain démarrage */ } finally { syncing = null; }
    })();
    return syncing;
  }
  async function status() {
    const p = permission();
    if (p !== 'granted') return { state: p };
    return { state: (await current()) ? 'on' : 'default' };
  }
  NZ.push = { supported, permission, enable, disable, detach, sync, status, current };

  // branchements : connexion → sync ; déconnexion → detach
  const _set = NZ.setSession;
  NZ.setSession = function (s) { const r = _set.call(this, s); if (s) setTimeout(sync, 1500); return r; };
  const _out = NZ.logout;
  NZ.logout = async function (...a) { try { await detach(); } catch (e) { /* ignore */ } return _out.apply(this, a); };
  if (NZ.session) setTimeout(sync, 2500);
  // toucher une notification quand l'application est déjà ouverte : le service worker nous dit où aller
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type !== 'nz-open' || typeof d.url !== 'string' || !/^#\/[\w\-./]*$/.test(d.url)) return;
      if (location.hash === d.url) NZ.dispatch(); else location.hash = d.url;
    });
  }

  /* =====================================================================
     Fenêtre « Recevoir les alertes ? » — une fois, sur l'écran d'accueil
     ===================================================================== */
  const isStaff = () => NZ.role() === 'admin' || NZ.role() === 'driver';
  const askText = () => (isStaff()
    ? 'Nouvelles commandes, nouvelles courses et messages des clients : soyez prévenu sur votre téléphone, même quand l\'application est fermée.'
    : 'Votre commande, votre livreur, les messages de Nazari Express : soyez prévenu sur votre téléphone, même quand l\'application est fermée.');
  const blockedHelp = () => html`<p class="muted" style="margin-bottom:14px">Les alertes sont bloquées pour ce site. Pour les autoriser : ouvrez le menu du navigateur (⋮) → <b>Paramètres</b> → <b>Paramètres du site</b> → <b>Notifications</b>, puis autorisez Nazari Express.</p>`;

  function openAsk() {
    U.openOverlay(html`<div class="pushask"><span class="pa-ic">${ic('bell', 34)}</span><h2>Recevoir les alertes ?</h2><p class="muted">${askText()}</p>
      ${btn({ label: 'Activer les alertes', act: 'push-on', full: true, size: 'lg', icon: 'bell' })}
      <div style="margin-top:10px">${btn({ label: 'Plus tard', kind: 'ghost', act: 'push-later', full: true })}</div></div>`, { focus: false });
  }
  const HOMES = ['', '#/', '#/driver', '#/admin'];
  let asked = false;
  function maybeAsk() {
    if (asked || !NZ.session || permission() !== 'default') return;
    const later = store.get(K_LATER, 0);
    if (later && Date.now() - later < 7 * DAY) return;
    if (!HOMES.includes(location.hash) || document.getElementById('overlay')) return;
    asked = true;
    store.set(K_LATER, Date.now());   // quoi qu'il arrive (touché à côté, fermé…), on ne redemande pas avant 7 jours
    openAsk();
  }
  NZ.on('route', () => { setTimeout(maybeAsk, 3000); });

  NZ.act('push-later', () => { store.set(K_LATER, Date.now()); U.closeOverlay(); });
  NZ.act('push-on', async (el) => {
    await U.busy(el, async () => {
      try { await enable(); U.closeOverlay(); U.toast('Alertes activées', 'ok'); }
      catch (e) {
        if (e.message === 'blocked') { U.openOverlay(html`<h2>Alertes bloquées</h2>${blockedHelp()}${btn({ label: 'Compris', act: 'overlay-close', full: true })}`, { focus: false }); }
        else if (e.message === 'later') { store.set(K_LATER, Date.now()); U.closeOverlay(); }
        else U.toast(e.message || 'Impossible d\'activer les alertes.', 'err');
      }
    });
  });

  /* =====================================================================
     « Alertes sur ce téléphone » depuis Mon compte
     ===================================================================== */
  NZ.act('push-account', async () => {
    const st = (await status()).state;
    if (st === 'unsupported') {
      return U.openOverlay(html`<h2>Alertes</h2><p class="muted" style="margin-bottom:14px">Ce téléphone ou ce navigateur ne permet pas les alertes. Essayez avec Chrome, puis ajoutez l'application à l'écran d'accueil.</p>${btn({ label: 'Fermer', act: 'overlay-close', full: true })}`, { focus: false });
    }
    if (st === 'denied') {
      return U.openOverlay(html`<h2>Alertes bloquées</h2>${blockedHelp()}${btn({ label: 'Compris', act: 'overlay-close', full: true })}`, { focus: false });
    }
    if (st === 'on') {
      return U.openOverlay(html`<div class="pushask"><span class="pa-ic ok">${ic('check', 34)}</span><h2>Alertes activées</h2><p class="muted">Ce téléphone est prévenu, même quand l'application est fermée.</p>
        ${btn({ label: 'Envoyer un test', act: 'push-test', full: true, icon: 'bell' })}
        <div style="margin-top:10px">${btn({ label: 'Désactiver sur ce téléphone', kind: 'ghost', act: 'push-off', full: true })}</div></div>`, { focus: false });
    }
    openAsk();
  });
  NZ.act('push-test', async (el) => {
    await U.busy(el, async () => {
      try {
        const r = await NZ.api('push.test', {});
        U.toast(r.sent ? 'Test envoyé : la notification arrive dans quelques secondes.' : 'Ce téléphone n\'est pas encore inscrit. Touchez « Activer les alertes ».', r.sent ? 'ok' : 'err');
      } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.act('push-off', async (el) => {
    await U.busy(el, async () => { await disable(); U.closeOverlay(); U.toast('Alertes désactivées sur ce téléphone', 'ok'); });
  });

  /* =====================================================================
     Administrateur : Plus → Alertes du téléphone (message du jour)
     ===================================================================== */
  const AP = { d: null, ctx: null };
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  const hourOptions = (cur) => {
    const hs = []; for (let h = 5; h <= 21; h++) hs.push(h);
    if (Number.isInteger(cur) && !hs.includes(cur)) { hs.push(cur); hs.sort((a, b) => a - b); }
    return hs.map((h) => ({ v: String(h), t: pad(h) + ' h' }));
  };
  const plural = (n, one, many) => (n > 1 ? many : one);
  const switchRow = (name, title, sub, on) => html`<div style="display:flex;align-items:center;gap:14px;margin-top:14px"><div style="flex:1"><div style="font-weight:700">${title}</div><div class="small muted">${sub}</div></div><label class="switch"><input type="checkbox" name="${name}"${on ? U.raw(' checked') : ''} aria-label="${title}"><i></i></label></div>`;
  function msgBlock(m, i) {
    return html`<div class="ap-msg">${field({ label: 'Message ' + (i + 1), kind: 'textarea', name: 'm' + i, rows: 3, maxlength: 160, value: m.body })}
      <div class="ap-foot"><label class="ap-on"><span class="switch"><input type="checkbox" name="a${i}"${m.active ? U.raw(' checked') : ''} aria-label="Message ${i + 1} actif"><i></i></span><span class="small">Actif</span></label>
      <button type="button" class="ap-del" data-act="ap-del" data-i="${i}">${ic('trash', 18)} Supprimer</button></div></div>`;
  }
  function apView() {
    const d = AP.d, n = d.devices || {};
    const total = (n.client || 0) + (n.driver || 0) + (n.admin || 0);
    return html`<div class="card ap-head"><span class="pa-ic">${ic('bell', 26)}</span><div><b>${total} téléphone${plural(total, '', 's')} inscrit${plural(total, '', 's')}</b>
        <div class="small muted">${n.client || 0} client${plural(n.client, '', 's')} · ${n.driver || 0} livreur${plural(n.driver, '', 's')} · ${n.admin || 0} administrateur${plural(n.admin, '', 's')}</div></div></div>
      ${d.ready ? '' : html`<div class="card" data-vid="ap-notready"><b>Pas encore prêt</b><p class="small muted" style="margin-top:6px">La fonction d'envoi des alertes n'est pas encore activée sur la base de données. Les alertes dans l'application continuent de fonctionner.</p></div>`}
      <div style="margin:4px 0 14px">${btn({ label: 'M\'envoyer un test', kind: 'ghost', full: true, icon: 'bell', act: 'ap-test' })}</div>
      <form class="card" data-submit="ap-save" novalidate>
        <h3 style="margin-bottom:6px">Message du jour</h3>
        <p class="small muted">Un message par jour est envoyé aux clients qui ont activé les alertes, même sans commande. Chaque jour, on passe au message suivant de la liste.</p>
        ${switchRow('daily_on', 'Envoyer un message chaque jour', 'Coupez-le pour ne plus rien envoyer', d.daily_on)}
        <div style="margin-top:12px">${field({ label: 'Heure d\'envoi (heure d\'Agadez)', kind: 'select', name: 'daily_hour', value: String(d.daily_hour), options: hourOptions(d.daily_hour) })}</div>
        <div class="h-sec">Les messages (${d.messages.length})</div>
        ${d.messages.map(msgBlock)}
        <div style="margin:10px 0 16px">${btn({ label: 'Ajouter un message', kind: 'ghost', full: true, icon: 'plus', act: 'ap-add' })}</div>
        ${btn({ label: 'Enregistrer', type: 'submit', full: true, size: 'lg' })}</form>
      <p class="small muted" style="margin:12px 4px">Les annonces (Plus → Annonces), les commandes, les courses et les messages de la discussion sont aussi envoyés sur les téléphones.</p>`;
  }
  const apRender = () => NZ.scrollKeep(() => AP.ctx.main(apView()));
  function apSync() {
    const f = document.querySelector('form[data-submit="ap-save"]');
    if (!f || !AP.d) return;
    const v = U.formData(f);
    AP.d.daily_on = !!v.daily_on;
    if (v.daily_hour != null) AP.d.daily_hour = parseInt(v.daily_hour, 10);
    AP.d.messages.forEach((m, i) => { if (('m' + i) in v) m.body = v['m' + i]; m.active = !!v['a' + i]; });
  }
  NZ.route('/admin/push', async (ctx) => {
    ctx.shell({ title: 'Alertes du téléphone', back: '#/admin/more', tab: 'more', skeleton: false });
    AP.ctx = ctx;
    try { AP.d = await NZ.api('push.admin', {}); } catch (e) { return ctx.fail(e); }
    ctx.main(apView());
  }, { roles: ['admin'] });
  NZ.act('ap-add', () => {
    apSync();
    if (AP.d.messages.length >= 40) return U.toast('40 messages au maximum.', 'err');
    AP.d.messages.push({ id: null, body: '', active: true });
    apRender();
  });
  NZ.act('ap-del', async (el) => {
    apSync();
    const i = parseInt(el.dataset.i, 10), m = AP.d.messages[i];
    if (!m) return;
    if (m.body.trim() && !(await U.confirmBox({ title: 'Supprimer ce message ?', text: m.body.slice(0, 120), ok: 'Supprimer', danger: true }))) return;
    AP.d.messages.splice(i, 1);
    apRender();
  });
  NZ.act('ap-test', async (el) => {
    await U.busy(el, async () => {
      try {
        const r = await NZ.api('push.test', {});
        U.toast(r.sent ? 'Test envoyé : la notification arrive dans quelques secondes.' : 'Votre téléphone n\'est pas encore inscrit : activez d\'abord les alertes (Mon compte).', r.sent ? 'ok' : 'err');
      } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.submit('ap-save', async (form) => {
    apSync();
    const d = AP.d;
    const msgs = d.messages.filter((m) => m.body.trim() !== '');
    if (msgs.some((m) => m.body.trim().length < 5)) return U.toast('Chaque message doit avoir au moins 5 lettres.', 'err');
    await U.busy(form.querySelector('button[type=submit]'), async () => {
      try {
        AP.d = await NZ.api('push.admin.save', { daily_on: d.daily_on, daily_hour: d.daily_hour, messages: msgs.map((m) => (m.id ? { id: m.id, body: m.body.trim(), active: m.active } : { body: m.body.trim(), active: m.active })) });
        apRender();
        U.toast('Enregistré', 'ok');
      } catch (e) { U.toast(e.message, 'err'); }
    });
  });
})((window.NZ = window.NZ || {}));
