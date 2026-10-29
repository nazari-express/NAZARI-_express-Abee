/* Nazari Express — démarrage de l'application. */
(function (NZ) {
  'use strict';
  const U = NZ.ui, { html, str, btn } = U;

  /* installation sur l'écran d'accueil (Android) */
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); NZ.installPrompt = e; });
  window.addEventListener('appinstalled', () => { NZ.installPrompt = null; });
  NZ.act('install-app', async () => {
    const p = NZ.installPrompt;
    if (!p) return U.toast('Dans le menu de votre navigateur, choisissez « Ajouter à l\'écran d\'accueil ».');
    p.prompt();
    try { await p.userChoice; } catch (e) { /* ignore */ }
    NZ.installPrompt = null;
  });

  /* alertes : nouvelle commande (admin), nouvelle course (livreur), nouveau message */
  NZ.on('me', (m, prev) => {
    if (!prev || !m.user) return;
    const c = m.counts || {}, p = prev.counts || {};
    const role = m.user.role;
    if (role === 'admin' && (c.new || 0) > (p.new || 0)) { U.beep(); U.toast('Nouvelle commande reçue', 'ok'); }
    else if ((role === 'driver' || role === 'admin') && (c.available || 0) > (p.available || 0)) { U.beep(); U.toast('Nouvelle course disponible', 'ok'); }
    else if ((m.unread || 0) > (prev.unread || 0) && !document.hidden) U.toast('Nouveau message', 'ok');
  });
  NZ.on('role-changed', () => { NZ.dispatch(); });

  setInterval(() => { if (!document.hidden && NZ.session) NZ.refreshMe(); }, 20000);

  /* réglages (tarifs, quartiers, agences, maintenance, WhatsApp) : rechargés au plus toutes les 60 s */
  let cfgAt = Date.now();
  const freshConfig = (force) => {
    if (document.hidden || (!force && Date.now() - cfgAt < 60000)) return;
    cfgAt = Date.now();
    NZ.loadConfig().catch(() => {});
  };
  setInterval(() => freshConfig(false), 15000);
  document.addEventListener('visibilitychange', () => freshConfig(false));
  window.addEventListener('online', () => { U.toast('Connexion rétablie', 'ok'); freshConfig(true); if (NZ.session) NZ.refreshMe(); });
  window.addEventListener('offline', () => { U.toast('Vous êtes hors ligne', 'err'); });

  function hideSplash() {
    const s = document.getElementById('splash');
    if (!s) return;
    s.classList.add('out');
    setTimeout(() => s.remove(), 450);
  }
  function splashError(e) {
    const l = document.querySelector('#splash .loading');
    if (!l) return;
    l.innerHTML = '<span>' + U.esc(e && e.network ? 'Pas de connexion' : 'Service indisponible') + '</span>';
    l.setAttribute('role', 'button'); l.tabIndex = 0;
    l.onclick = () => location.reload();
    const again = document.createElement('div');
    again.style.cssText = 'position:absolute;left:0;right:0;bottom:96px;text-align:center;color:#fff;font-weight:600';
    again.textContent = 'Touchez ci-dessous pour réessayer';
    document.getElementById('splash').appendChild(again);
  }

  async function boot() {
    const t0 = Date.now();
    try {
      await NZ.loadConfig();
    } catch (e) {
      if (!NZ.config) { splashError(e); return; }
    }
    if (NZ.session) await NZ.refreshMe();
    const wait = 700 - (Date.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    await NZ.dispatch();
    hideSplash();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})((window.NZ = window.NZ || {}));
