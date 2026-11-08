/* Nazari Express — écrans communs : connexion de l'équipe, tarifs, aide, suivi public, notifications, compte. */
(function (NZ) {
  'use strict';
  const U = NZ.ui, V = NZ.v;
  const { html, raw, str, ic, btn, field, fcfa, fwhen, empty, row, statusChip, SERVICE } = U;

  const orderHref = (id) => (NZ.role() === 'admin' ? '#/admin/order/' : NZ.role() === 'driver' ? '#/driver/order/' : '#/order/') + id;
  NZ.orderHref = orderHref;

  /* =====================================================================
     Connexion et création de compte
     ===================================================================== */
  function authPage(inner) {
    const [a, b] = NZ.brandParts();
    return html`<div class="auth"><div class="head"><svg class="logo" width="70" height="56" aria-hidden="true"><use href="#logo-mark"/></svg><div class="wm">${a}${b ? html`<b>${b}</b>` : ''}</div><p>${NZ.company().tagline}</p></div><div class="body">${inner}</div></div>`;
  }
  const safeNext = (h) => (typeof h === 'string' && /^#\/[A-Za-z0-9/_?=&.%-]*$/.test(h) && !/^#\/(login|register|staff)/.test(h) ? h : '');
  async function afterAuth(r) {
    NZ.setSession({ token: r.token, user: r.user });
    NZ.draft = null;
    await NZ.refreshMe();
    const next = safeNext(NZ.next);
    NZ.next = null;
    if (next && next !== location.hash) location.replace(next);
    else NZ.go(NZ.homeHash().slice(1), { replace: true });
  }
  NZ.afterAuth = afterAuth;
  let authCtx = null, LOGIN = {}, REG = {};

  const loginView = () => {
    const wa = NZ.waHref('Bonjour, j\'ai oublié mon code PIN Nazari Express.');
    return authPage(html`<form class="card" data-submit="login" novalidate>
        <h2 class="h2" style="margin-bottom:14px">Connexion de l'équipe</h2>
        ${V.errBox(LOGIN.err)}
        ${field({ label: 'Numéro de téléphone', kind: 'phone', name: 'phone', value: LOGIN.phone, autocomplete: 'tel-national', error: LOGIN.errors.phone })}
        ${field({ label: 'Code PIN', kind: 'pin', name: 'pin', autocomplete: 'current-password', error: LOGIN.errors.pin })}
        <div style="margin-top:18px">${btn({ label: 'Se connecter', type: 'submit', full: true, size: 'lg' })}</div>
      </form>
      <p class="center" style="margin-top:18px">Nouveau dans l'équipe ? <a href="#/staff/register"><b>Créer mon compte</b></a></p>
      <p class="center" style="margin-top:10px"><a href="#/login">Vous êtes client ? Entrez ici</a></p>
      <p class="center small muted" style="margin-top:10px"><a href="#/tarifs">Voir nos tarifs</a>${wa ? html` · <a href="${wa}" target="_blank" rel="noopener noreferrer">Code oublié ?</a>` : ''}</p>`);
  };
  const drawLogin = () => authCtx.plain(loginView());
  NZ.route('/staff', (ctx) => { authCtx = ctx; LOGIN = { phone: '', err: '', errors: {} }; drawLogin(); }, { public: true, guestOnly: true });
  NZ.submit('login', async (form) => {
    const d = U.formData(form);
    LOGIN = { phone: d.phone, err: '', errors: {} };
    if (d.phone.length !== 8) LOGIN.errors.phone = 'Entrez les 8 chiffres de votre numéro.';
    if (!d.pin) LOGIN.errors.pin = 'Entrez votre code PIN.';
    if (Object.keys(LOGIN.errors).length) return drawLogin();
    await U.busy(form.querySelector('button[type=submit]'), async () => {
      try { await afterAuth(await NZ.api('login', { phone: d.phone, pin: d.pin }, { anon: true })); } catch (e) { LOGIN.err = e.message; drawLogin(); }
    });
  });

  const registerView = () => authPage(html`<form class="card" data-submit="register" novalidate>
      <h2 class="h2" style="margin-bottom:14px">Compte de l'équipe</h2>
      ${V.errBox(REG.err)}
      ${field({ label: 'Votre nom', name: 'name', value: REG.name, autocomplete: 'name', placeholder: 'Ex. Abdou Moussa', error: REG.errors.name, maxlength: 60 })}
      ${field({ label: 'Numéro de téléphone', kind: 'phone', name: 'phone', value: REG.phone, autocomplete: 'tel-national', error: REG.errors.phone })}
      ${field({ label: 'Choisissez un code PIN', kind: 'pin', name: 'pin', value: REG.pin, autocomplete: 'new-password', hint: REG.invite ? '6 à 10 chiffres pour un compte de l\'équipe. Évitez 123456 et les chiffres répétés.' : '4 à 8 chiffres. Évitez 1234 ou 0000. Gardez-le pour vous.', error: REG.errors.pin })}
      ${field({ label: 'Confirmez le code PIN', kind: 'pin', name: 'pin2', value: REG.pin2, autocomplete: 'new-password', error: REG.errors.pin2 })}
      ${REG.invite
        ? field({ label: 'Code d\'invitation', name: 'invite', value: REG.code, placeholder: 'XXXX-XXXX-XXXX', hint: 'Donné par l\'administrateur (livreurs et équipe).', error: REG.errors.invite, attrs: 'autocapitalize="characters" spellcheck="false"' })
        : html`<div style="margin-top:12px"><button type="button" class="link-btn" data-act="reg-invite">J'ai un code d'invitation</button></div>`}
      <div style="margin-top:14px">${btn({ label: 'Créer mon compte', type: 'submit', full: true, size: 'lg' })}</div>
    </form>
    <p class="center" style="margin-top:18px">Déjà un compte ? <a href="#/staff"><b>Se connecter</b></a></p>`);
  const drawReg = () => authCtx.plain(registerView());
  NZ.route('/staff/register', (ctx) => { authCtx = ctx; REG = { name: '', phone: '', code: '', pin: '', pin2: '', invite: true, err: '', errors: {} }; drawReg(); }, { public: true, guestOnly: true });
  NZ.act('reg-invite', (el) => { const d = U.formData(el.closest('form')); REG.name = d.name; REG.phone = d.phone; REG.pin = d.pin; REG.pin2 = d.pin2; REG.invite = true; REG.err = ''; REG.errors = {}; drawReg(); });
  NZ.submit('register', async (form) => {
    const d = U.formData(form);
    REG = { name: d.name, phone: d.phone, code: d.invite || '', pin: d.pin, pin2: d.pin2, invite: REG.invite, err: '', errors: {} };
    const staff = REG.invite && REG.code.trim() !== '';
    if (d.name.trim().length < 2) REG.errors.name = 'Entrez votre nom (2 lettres minimum).';
    if (d.phone.length !== 8) REG.errors.phone = 'Entrez les 8 chiffres de votre numéro.';
    if (!(staff ? /^[0-9]{6,10}$/ : /^[0-9]{4,8}$/).test(d.pin)) REG.errors.pin = staff ? 'Le code PIN doit contenir 6 à 10 chiffres.' : 'Le code PIN doit contenir 4 à 8 chiffres.';
    else if (NZ.weakPin(d.pin)) REG.errors.pin = NZ.WEAK_PIN_MSG;
    else if (d.pin !== d.pin2) REG.errors.pin2 = 'Les deux codes PIN ne sont pas identiques.';
    if (Object.keys(REG.errors).length) return drawReg();
    await U.busy(form.querySelector('button[type=submit]'), async () => {
      try { await afterAuth(await NZ.api('register', { name: d.name, phone: d.phone, pin: d.pin, invite: REG.code }, { anon: true })); } catch (e) {
        const map = { invalid_phone: 'phone', phone_taken: 'phone', invalid_pin: 'pin', weak_pin: 'pin', invite: 'invite' };
        if (map[e.code]) REG.errors[map[e.code]] = e.message; else REG.err = e.message;
        drawReg();
      }
    });
  });

  /* 404 */
  NZ.route('/404', (ctx) => {
    ctx.shell({ title: 'Page introuvable', back: '#/', tab: 'home', skeleton: false });
    ctx.main(empty('map', 'Page introuvable', 'Cette page n\'existe pas ou a été déplacée.', btn({ label: 'Retour à l\'accueil', href: NZ.homeHash() })));
  }, { public: true });

  /* =====================================================================
     Tarifs, aide, à propos
     ===================================================================== */
  const publicShell = (ctx, title, tab) => ctx.shell({ title, back: NZ.session ? NZ.homeHash() : '#/login', tab: NZ.session ? tab : null, skeleton: false });

  NZ.route('/tarifs', async (ctx) => {
    publicShell(ctx, 'Nos tarifs', 'home');
    try { await NZ.loadConfig(); } catch (e) { return ctx.fail(e); }
    const P = NZ.prices();
    ctx.main(html`<div class="stack">
      <div class="notice" style="background:var(--green);color:#fff;padding:16px">${ic('box', 28)}<div><b>Des tarifs clairs et transparents</b><br>pour tous vos envois à Agadez.</div></div>
      <div class="card pad0"><table class="tbl"><thead><tr><th>Poids du colis</th><th class="r">Prix de livraison</th></tr></thead><tbody>
        ${U.TIERS.map((t) => html`<tr><td>${t.label.replace(/\s*\(.*$/, '')} <span class="muted">(${t.range})</span></td><td class="r num ${t.key === 'xl' ? 'g' : 'p'}">${t.key === 'xl' ? 'Sur devis' : fcfa(P[t.price])}</td></tr>`)}
      </tbody></table></div>
      ${P.xl ? html`<p class="small muted" style="margin:-4px 4px 0">Au-delà de 20 kg, le prix est confirmé par l'équipe (à partir de ${fcfa(P.xl)}).</p>` : ''}
      <div class="card pad0"><table class="tbl"><thead><tr><th colspan="2">Suppléments</th></tr></thead><tbody>
        <tr><td>Livraison express (même jour)</td><td class="r num p">+ ${fcfa(P.express)}</td></tr>
        <tr><td>Loin du centre d'Agadez (quartiers excentrés)</td><td class="r num p">+ ${fcfa(P.far)}</td></tr>
      </tbody></table></div>
      <div class="card pad0"><table class="tbl"><thead><tr><th colspan="2">Pharmacie</th></tr></thead><tbody>
        <tr><td>Livraison de vos médicaments</td><td class="r num p">${fcfa(P.pharmacy)}</td></tr>
        <tr><td colspan="2" class="small muted">Les médicaments sont payés en plus, au prix de la pharmacie. Le montant vous est confirmé avant la livraison.</td></tr>
      </tbody></table></div>
      <div class="notice">${ic('info', 20)}<div>Les prix peuvent être modifiés par l'équipe. Le prix affiché au moment de la commande fait foi.</div></div>
      ${NZ.session ? btn({ label: 'Commander maintenant', href: '#/new', full: true, size: 'lg' }) : btn({ label: 'Se connecter pour commander', href: '#/login', full: true, size: 'lg' })}
    </div>`);
  }, { public: true });

  const FAQ = [
    ['Comment passer une commande ?', 'Sur l\'accueil, touchez un des trois grands dessins : « Envoyer un colis », « Récupérer un colis » ou « Pharmacie ». Il n\'y a qu\'une question par écran. Le bouton rond avec le haut-parleur lit l\'écran à voix haute. À la fin vous recevez un numéro de commande, par exemple NZ-20261018-001-K7QF : gardez-le en entier, il sert au suivi.'],
    ['Combien coûte la livraison ?', 'Le prix dépend de la taille du colis : de 1 000 FCFA pour un petit colis jusqu\'à 2 500 FCFA pour un grand colis. Au-delà de 20 kg, le prix est confirmé sur devis. Un petit supplément s\'ajoute si vous êtes loin du centre d\'Agadez. Le prix est toujours visible avant d\'envoyer la commande.'],
    ['Comment envoyer un colis à l\'agence ?', 'Touchez « Envoyer un colis », choisissez l\'agence de transport et la ville, puis la taille du colis. Donnez votre prénom, votre nom et votre numéro, puis ceux de la personne qui reçoit. Partagez votre position avec le téléphone : un livreur vient chercher le colis directement chez vous et le dépose à l\'agence. Pas besoin de carte d\'identité pour envoyer.'],
    ['Comment récupérer un colis arrivé à l\'agence ?', 'Touchez « Récupérer un colis », choisissez l\'agence, puis prenez en photo votre carte d\'identité : elle est obligatoire, et votre nom y est déjà écrit. Ajoutez votre numéro et partagez votre position. Le livreur retire le colis à l\'agence et vous le livre à domicile.'],
    ['Que devient la photo de ma carte d\'identité ?', 'Elle sert seulement à retirer votre colis. Seuls l\'équipe et le livreur de votre course peuvent la voir, et elle est effacée automatiquement peu après la fin de la commande.'],
    ['Comment parler à l\'équipe ?', 'Touchez « Discussion » en bas de l\'écran : vous écrivez directement à l\'équipe, avec des messages ou des photos. Les messages et les photos disparaissent automatiquement après 24 heures.'],
    ['Comment et quand payer ?', 'Vous payez au livreur, en espèces. Selon le service, le paiement se fait à l\'enlèvement (envoi à l\'agence) ou à la livraison (retrait à l\'agence, pharmacie). Le livreur ne demande jamais d\'argent avant d\'avoir récupéré votre colis.'],
    ['Comment fonctionne la livraison de pharmacie ?', 'Choisissez la pharmacie, puis photographiez votre ordonnance ou écrivez votre liste de médicaments. Nous confirmons le prix avec la pharmacie, puis un livreur récupère la commande fermée et vous la livre. Le contenu de votre commande reste confidentiel : le livreur ne voit pas la liste.'],
    ['Puis-je annuler une commande ?', 'Oui, tant que la commande est « Reçue » ou « Validée », depuis la page de la commande. Ensuite, écrivez-nous dans la discussion.'],
    ['Quelles zones desservez-vous ?', 'Nous livrons à Agadez. Si vous êtes loin du centre, un petit supplément s\'ajoute : il est affiché avant d\'envoyer la commande. Si votre téléphone ne trouve pas votre position, touchez « Appelez-moi à la place » : nous vous appelons pour confirmer l\'endroit.'],
    ['Comment partager ma position ?', 'Touchez le grand bouton vert « Partager ma position », puis « Autoriser » quand le téléphone le demande. Le GPS (la localisation) du téléphone doit être allumé. Si cela ne marche pas, sortez dehors et réessayez. Seuls l\'équipe et le livreur de votre course voient votre position, et seulement quand il prend la course.'],
    ['J\'ai oublié mon code secret', 'Écrivez-nous dans la discussion ou sur WhatsApp avec votre numéro : l\'équipe peut vous donner un nouveau code provisoire.'],
  ];
  NZ.route('/help', (ctx) => {
    publicShell(ctx, 'Aide et questions', 'account');
    const wa = NZ.waHref('Bonjour ' + NZ.company().name + ', j\'ai besoin d\'aide.');
    ctx.main(html`<div class="stack"><div class="list faq">${FAQ.map(([q, a]) => html`<details><summary>${q}</summary><p>${a}</p></details>`)}</div>
      ${wa ? html`<div class="card"><div class="h2">Une autre question ?</div><p class="muted" style="margin:4px 0 12px">Notre équipe vous répond sur WhatsApp.</p>${btn({ label: 'Écrire sur WhatsApp', href: wa, kind: 'wa', full: true, icon: 'wa' })}</div>` : ''}</div>`);
  }, { public: true });

  NZ.route('/about', async (ctx) => {
    publicShell(ctx, 'À propos', 'account');
    try { await NZ.loadConfig(); } catch (e) { /* facultatif */ }
    const co = NZ.company();
    const wa = NZ.waHref('Bonjour ' + co.name + ',');
    ctx.main(html`<div class="stack"><div class="card center" style="padding:28px 16px">
        <svg width="84" height="68" style="color:var(--green);margin:0 auto 6px;display:block" aria-hidden="true"><use href="#logo-mark"/></svg>
        <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em">${co.name}</div>
        <div class="muted" style="margin-top:4px">${co.tagline}</div>
        <div class="chip plain" style="margin-top:12px">Version ${NZ.VERSION}</div></div>
      <div class="card"><p>${co.name} livre vos colis, vos envois vers les agences de transport et vos médicaments de pharmacie partout à Agadez, de la porte du client à la porte du destinataire.</p>
        <p class="muted" style="margin-top:10px">Un service fait à Agadez, pour Agadez. Ensemble pour une Agadez plus connectée !</p>
        <p style="margin-top:10px;font-weight:700;color:var(--green-d)">Votre satisfaction, notre priorité !</p></div>
      ${wa ? btn({ label: 'Nous écrire sur WhatsApp', href: wa, kind: 'wa', full: true, icon: 'wa' }) : ''}</div>`);
  }, { public: true });

  /* =====================================================================
     Partager l'application : code QR, lien, WhatsApp
     ===================================================================== */
  const appUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
  NZ.appUrl = appUrl;
  NZ.route('/share', (ctx) => {
    publicShell(ctx, 'Partager l\'application', 'account');
    const url = appUrl(), co = NZ.company();
    const msg = co.name + ' : livraison de colis et de médicaments à Agadez, dès 1 000 FCFA. Ouvre l\'application ici : ' + url;
    ctx.main(html`<div class="stack">
      <div class="card center shr-card"><div class="shr-qr" data-vid="share-qr">${V.qrSvg(url, 'Code QR : ouvrir ' + co.name)}</div>
        <div class="shr-t">Scannez pour ouvrir ${co.name}</div>
        <div class="shr-u" data-vid="share-url">${url.replace(/^https?:\/\//, '')}</div></div>
      ${btn({ label: 'Envoyer sur WhatsApp', href: 'https://wa.me/?text=' + encodeURIComponent(msg), kind: 'wa', full: true, size: 'lg', icon: 'wa' })}
      ${btn({ label: 'Copier le lien', kind: 'ghost', full: true, icon: 'copy', act: 'share-copy' })}
      <p class="small muted center">Plus qu'une livraison, un service de confiance !</p></div>`);
  }, { public: true });
  NZ.act('share-copy', () => U.copyText(appUrl()));

  /* =====================================================================
     Suivi public : numéro de commande + téléphone
     ===================================================================== */
  let TRK = { code: '', phone: '', res: null, err: '' };
  const trackView = () => html`<div class="stack">
    <form class="card" data-submit="track" novalidate>
      <p class="muted" style="margin-bottom:14px">Entrez le numéro de la commande et un des numéros de téléphone de la livraison (expéditeur ou destinataire).</p>
      ${V.errBox(TRK.err)}
      ${field({ label: 'Numéro de commande', name: 'code', value: TRK.code, placeholder: 'NZ-20261018-001-K7QF', attrs: 'autocapitalize="characters" spellcheck="false" style="text-transform:uppercase"', maxlength: 40, hint: 'Le numéro complet, avec les 4 lettres de la fin.' })}
      ${field({ label: 'Numéro de téléphone', kind: 'phone', name: 'phone', value: TRK.phone })}
      <div style="margin-top:16px">${btn({ label: 'Suivre', type: 'submit', full: true, size: 'lg' })}</div>
    </form>
    ${TRK.res ? trackResult(TRK.res) : ''}</div>`;
  function trackResult(r) {
    const s = SERVICE[r.service] || SERVICE.parcel;
    const from = r.service === 'agency_pickup' || r.service === 'pharmacy' ? (r.partner_name || '—') : (r.pickup_quartier || '—');
    const to = r.service === 'agency_drop' ? (r.partner_name || 'Agence') + (r.agency_dest ? ' → ' + r.agency_dest : '') : (r.drop_quartier || '—');
    return html`<div class="card"><div class="code-card" style="justify-content:space-between"><div><div class="muted small">${s.long}</div><div class="h2 num">${r.code}</div></div>${statusChip(r.status)}</div>
      ${V.kv([['Trajet', from + ' → ' + to], ['À payer', fcfa(r.to_collect) + (r.collect_at === 'pickup' ? ' à l\'enlèvement' : ' à la livraison')], ['Commandé', fwhen(r.created_at)]])}
      <div style="margin-top:16px">${V.timeline(r.status, r.events, r.service)}</div>
      ${r.driver ? html`<div class="h-sec" style="margin-bottom:6px">Votre livreur</div><div style="font-weight:700">${r.driver.name}</div>${V.callRow(r.driver.phone, 'Bonjour, je vous contacte pour la commande ' + r.code + '.')}` : ''}</div>`;
  }
  NZ.route('/track', (ctx) => {
    publicShell(ctx, 'Suivre une commande', 'home');
    TRK = { code: ctx.query.code || '', phone: '', res: null, err: '' };
    ctx.main(trackView());
  }, { public: true });
  NZ.submit('track', async (form) => {
    const d = U.formData(form);
    TRK = { code: d.code, phone: d.phone, res: null, err: '' };
    const redraw = () => { const m = document.getElementById('main'); if (m) m.innerHTML = str(trackView()); };
    if (!d.code.trim() || d.phone.length < 8) { TRK.err = 'Entrez le numéro de commande en entier et vos 8 chiffres de téléphone.'; return redraw(); }
    await U.busy(form.querySelector('button[type=submit]'), async () => {
      try { TRK.res = await NZ.api('track', { code: d.code, phone: d.phone }, { anon: true }); } catch (e) { TRK.err = e.message; }
      redraw();
    });
  });

  /* =====================================================================
     Messages (notifications)
     ===================================================================== */
  let MSG = { filter: 'all', items: [], unread: 0 };
  const msgView = () => {
    const f = MSG.filter;
    const chip = (v, t) => html`<button type="button" class="fchip${f === v ? ' on' : ''}" data-act="msg-filter" data-v="${v}">${t}</button>`;
    const items = MSG.items.filter((n) => f === 'all' || n.kind === f);
    return html`<div class="filters" role="tablist">${chip('all', 'Toutes')}${chip('order', 'Commandes')}${chip('info', 'Annonces')}</div>
      ${items.length ? html`<div class="list">${items.map((n) => row({
        icon: n.kind === 'info' ? 'mega' : 'box', tone: n.kind === 'info' ? 'amber' : '', title: n.title, sub: n.body || '', unread: !n.read, wrap: true,
        act: 'notif-open', id: n.id, noArrow: true,
        end: html`<span>${fwhen(n.created_at)}</span>${!n.read ? html`<span class="dot">1</span>` : ''}`,
      }))}</div>` : empty('chat', 'Aucun message', f === 'info' ? 'Les annonces de l\'équipe apparaîtront ici.' : 'Vous serez prévenu ici de chaque étape de vos commandes.')}`;
  };
  NZ.route('/messages', async (ctx) => {
    ctx.shell({
      title: 'Messages', tab: 'messages',
      right: html`<button type="button" class="icon-btn" data-act="msg-readall" aria-label="Tout marquer comme lu">${ic('dcheck', 22)}</button>`,
    });
    let sig = '';
    const load = async () => {
      const r = await NZ.api('notif.list', { limit: 60 });
      MSG.items = r.items; MSG.unread = r.unread;
      const s = JSON.stringify(r.items);
      if (s !== sig) { sig = s; NZ.scrollKeep(() => ctx.main(msgView())); }
    };
    MSG.filter = 'all';
    try { await load(); NZ.refreshMe(); } catch (e) { return ctx.fail(e); }
    ctx.poll(15000, load);
  });
  NZ.act('msg-filter', (el) => { MSG.filter = el.dataset.v; const m = document.getElementById('main'); if (m) m.innerHTML = str(msgView()); });
  NZ.act('msg-readall', async (el) => {
    await U.busy(el, async () => {
      try { await NZ.api('notif.read', { all: true }); MSG.items.forEach((n) => { n.read = true; }); MSG.unread = 0; const m = document.getElementById('main'); if (m) m.innerHTML = str(msgView()); NZ.refreshMe(); } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.act('notif-open', (el) => {
    const n = MSG.items.find((x) => x.id === el.dataset.id);
    if (!n) return;
    if (!n.read) {
      n.read = true;
      NZ.api('notif.read', { ids: [n.id] }).then(() => NZ.refreshMe()).catch(() => {});
    }
    if (n.order_id) { location.hash = orderHref(n.order_id); return; }
    const m = document.getElementById('main'); if (m) m.innerHTML = str(msgView());
    U.openOverlay(html`<h2>${n.title}</h2><p class="muted small">${fwhen(n.created_at)}</p><p style="margin:12px 0 18px;white-space:pre-wrap">${n.body || ''}</p>${btn({ label: 'Fermer', kind: 'ghost', full: true, act: 'overlay-close' })}`, { focus: false });
  });

  /* =====================================================================
     Compte
     ===================================================================== */
  const ROLE_LABEL = { client: 'Client', driver: 'Livreur', admin: 'Administrateur' };
  NZ.route('/account', async (ctx) => {
    if (NZ.role() === 'client') return NZ.clientAccount(ctx);
    ctx.shell({ title: 'Mon compte', tab: 'account', skeleton: false });
    await NZ.refreshMe();
    const u = NZ.user(), role = NZ.role();
    const wa = NZ.waHref('Bonjour ' + NZ.company().name + ',');
    const installed = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    const installable = !installed;
    const staffRows = role === 'admin' ? [
      row({ icon: 'list', title: 'Espace administrateur', sub: 'Commandes, tarifs, équipe', href: '#/admin' }),
      row({ icon: 'plus', title: 'Passer une commande', sub: 'Créer une commande comme un client', href: '#/new' }),
    ] : role === 'driver' ? [
      row({ icon: 'truck', title: 'Mes courses', sub: 'Courses à prendre et à livrer', href: '#/driver' }),
    ] : [];
    ctx.main(html`<div class="profile"><div class="avatar">${U.initials(u.name)}</div><div><div style="font-size:21px;font-weight:800">${u.name}</div><div class="muted">+227 ${U.fphone(u.phone)}</div><span class="chip plain" style="margin-top:6px">${ROLE_LABEL[u.role] || u.role}</span></div></div>
      <div class="list">
        ${staffRows}
        ${row({ icon: 'bell', title: 'Notifications', sub: 'Mes alertes', href: '#/messages' })}
        ${row({ icon: 'share', title: 'Partager l\'application', sub: 'Code QR et lien WhatsApp', href: '#/share' })}
        ${installable ? row({ icon: 'download', title: 'Installer l\'application', sub: 'L\'ajouter à l\'écran d\'accueil', act: 'install-app', noArrow: true }) : ''}
        ${row({ icon: 'help', title: 'Aide et questions', sub: 'Questions fréquentes', href: '#/help' })}
        ${row({ icon: 'info', title: 'À propos', sub: NZ.company().name + ' v' + NZ.VERSION, href: '#/about' })}
      </div>
      <div class="h-sec">Sécurité</div>
      <div class="list">
        ${row({ icon: 'edit', title: 'Modifier mon nom', sub: u.name, act: 'edit-name' })}
        ${row({ icon: 'lock', title: 'Changer mon code PIN', sub: 'Sécurisez votre compte', act: 'change-pin' })}
      </div>
      ${wa ? html`<div style="margin-top:16px">${btn({ label: 'Nous écrire sur WhatsApp', href: wa, kind: 'wa', full: true, icon: 'wa' })}</div>` : ''}
      <div style="margin-top:12px">${btn({ label: 'Se déconnecter', kind: 'danger', full: true, icon: 'out', act: 'logout' })}</div>`);
  });
  NZ.act('edit-name', () => {
    U.openOverlay(html`<h2>Modifier mon nom</h2><form data-submit="save-name" novalidate>${field({ label: 'Votre nom', name: 'name', value: NZ.user().name, maxlength: 60, autocomplete: 'name' })}
      <div class="btn-row" style="margin-top:16px">${btn({ label: 'Annuler', kind: 'ghost', act: 'overlay-close' })}${btn({ label: 'Enregistrer', type: 'submit' })}</div></form>`);
  });
  NZ.submit('save-name', async (form) => {
    const d = U.formData(form);
    if (d.name.trim().length < 2) return U.toast('Entrez votre nom (2 lettres minimum).', 'err');
    await U.busy(form.querySelector('button[type=submit]'), async () => {
      try { const r = await NZ.api('profile.update', { name: d.name }); NZ.session.user = r.user; NZ.store.set('nz.s', NZ.session); U.closeOverlay(); U.toast('Nom mis à jour', 'ok'); NZ.dispatch(); } catch (e) { U.toast(e.message, 'err'); }
    });
  });
  NZ.act('change-pin', () => {
    const staff = NZ.isStaff();
    U.openOverlay(html`<h2>Changer mon code PIN</h2><form data-submit="save-pin" novalidate>
      ${field({ label: 'Ancien code PIN', kind: 'pin', name: 'old', autocomplete: 'current-password' })}
      ${field({ label: 'Nouveau code PIN', kind: 'pin', name: 'new', autocomplete: 'new-password', hint: (staff ? '6 à 10 chiffres' : '4 à 8 chiffres') + ', pas trop simple (évitez 1234, 0000).' })}
      ${field({ label: 'Confirmez le nouveau code PIN', kind: 'pin', name: 'new2', autocomplete: 'new-password' })}
      <p class="small muted" style="margin-top:12px">Vous resterez connecté sur cet appareil ; les autres appareils seront déconnectés.</p>
      <div class="btn-row" style="margin-top:16px">${btn({ label: 'Annuler', kind: 'ghost', act: 'overlay-close' })}${btn({ label: 'Enregistrer', type: 'submit' })}</div></form>`);
  });
  NZ.submit('save-pin', async (form) => {
    const d = U.formData(form);
    const re = NZ.isStaff() ? /^[0-9]{6,10}$/ : /^[0-9]{4,8}$/;
    if (!d.old) return U.toast('Entrez votre ancien code PIN.', 'err');
    if (!re.test(d.new)) return U.toast(NZ.isStaff() ? 'Le nouveau code doit contenir 6 à 10 chiffres.' : 'Le nouveau code doit contenir 4 à 8 chiffres.', 'err');
    if (NZ.weakPin(d.new)) return U.toast(NZ.WEAK_PIN_MSG, 'err');
    if (d.new !== d.new2) return U.toast('Les deux nouveaux codes ne sont pas identiques.', 'err');
    await U.busy(form.querySelector('button[type=submit]'), async () => {
      try { await NZ.api('pin.change', { old: d.old, new: d.new }); U.closeOverlay(); U.toast('Code PIN modifié', 'ok'); } catch (e) { U.toast(e.message, 'err'); }
    });
  });
})((window.NZ = window.NZ || {}));
