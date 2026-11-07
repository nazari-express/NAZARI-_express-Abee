/* Nazari Express — côté client, pensé pour ceux qui lisent peu :
   bienvenue, connexion au clavier à gros chiffres, accueil en dessins, commande en étapes (une question par écran),
   suivi, compte. Tout peut être lu à voix haute (bouton haut-parleur). */
(function (NZ) {
  'use strict';
  const U = NZ.ui, V = NZ.v, VO = NZ.voice, K = NZ.kit;
  const { html, raw, str, ic, il, btn, fcfa, fwhen } = U;
  const $ = (s) => document.querySelector(s);

  const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const nm = (x) => cleanName(x).length >= 2;
  const ph8 = (x) => /^\d{8}$/.test(String(x || ''));
  const autoName = (n) => /^Client \d+$/.test(String(n || ''));
  const realName = (u) => (u && u.name && !autoName(u.name) ? u.name : '');
  const firstOf = (u) => cleanName(realName(u)).split(' ')[0] || '';
  const splitName = (full) => { const p = cleanName(full).split(' '); return [p[0] || '', p.slice(1).join(' ')]; };
  const joinName = (a, b) => cleanName(cleanName(a) + ' ' + cleanName(b));
  const setReady = (id, ok) => { const b = document.getElementById(id); if (b) b.disabled = !ok; };
  const errBox = (m) => (m ? html`<div class="err-box" role="alert">${ic('alert', 26)}<div>${m}</div></div>` : '');
  const bigNext = (id, act, ok, label) => html`<div class="foot"><button type="button" class="btn primary xl full" id="${id}" data-act="${act}"${ok ? '' : raw(' disabled')}>${label || 'Suivant'}${ic('next', 28)}</button></div>`;

  /* =====================================================================
     Bienvenue, connexion, création de compte (numéro + code secret, au clavier à gros chiffres)
     ===================================================================== */
  let AU = { mode: 'login', phone: '', pin: '', err: '' };
  const freshAU = (mode) => { AU = { mode, phone: '', pin: '', err: '' }; };

  NZ.route('/login', (ctx) => {
    const [a, b] = NZ.brandParts();
    ctx.plain(html`<div class="shell cl"><div class="land">
      <svg class="scene" aria-hidden="true" preserveAspectRatio="xMidYMax slice"><use href="#scene-splash" width="100%" height="100%"/></svg><div class="veil"></div>
      <div class="top"><svg class="logo" aria-hidden="true"><use href="#logo-mark"/></svg><div class="wm">${a}${b ? html`<b>${b}</b>` : ''}</div><div class="tag">${NZ.company().tagline}</div><div class="where">${ic('pin', 18)}Agadez</div></div>
      <div class="lhero" aria-hidden="true"><div class="lbadge">${il('send', 200)}</div></div>
      <div class="sheet2">
        <div class="hi"><h1>Bienvenue !</h1>${VO.btn()}</div>
        <button type="button" class="btn primary xl full" data-act="au-start" data-mode="login" data-vid="l1">${il('lock', 46)}J'ai un compte</button>
        <button type="button" class="btn ghost xl full" data-act="au-start" data-mode="register" data-vid="l2">${il('hello', 46)}Je suis nouveau</button>
        <div class="mini"><a href="#/track">Suivre un colis</a><a href="#/staff">Équipe Nazari</a></div>
      </div></div></div>`);
    VO.screen(() => [
      { t: 'Bienvenue chez ' + NZ.company().name + '.' },
      { t: 'Si vous avez déjà un compte, touchez ce bouton.', sel: '[data-vid="l1"]' },
      { t: 'Si vous êtes nouveau, touchez celui-ci.', sel: '[data-vid="l2"]' },
    ]);
  }, { public: true, guestOnly: true });
  NZ.act('au-start', (el) => { freshAU(el.dataset.mode); NZ.go(el.dataset.mode === 'login' ? '/login/phone' : '/register'); });

  function phoneScreen(ctx, o) {
    ctx.shell({ title: o.title, back: o.back, cls: 'cl', skeleton: false });
    ctx.main(html`<div>
      <div class="qrow"><span class="qill">${il('phone', 78)}</span><div class="qtxt"><h1 class="qt">${o.q}</h1></div>${VO.btn()}</div>
      ${errBox(AU.err)}
      ${K.keypad({ kind: 'phone', value: AU.phone, onChange: (v) => { AU.phone = v; setReady('au-next', v.length === 8); } })}
      ${bigNext('au-next', 'au-next', AU.phone.length === 8)}
    </div>`);
    VO.screen(() => [{ t: o.q }, { t: 'Touchez les huit chiffres de votre numéro, puis le bouton vert.' }]);
  }
  NZ.route('/login/phone', (ctx) => { AU.mode = 'login'; phoneScreen(ctx, { title: 'Connexion', back: '#/login', q: 'Quel est votre numéro de téléphone ?' }); }, { public: true, guestOnly: true });
  NZ.route('/register', (ctx) => { AU.mode = 'register'; phoneScreen(ctx, { title: 'Nouveau compte', back: '#/login', q: 'Quel est votre numéro de téléphone ?' }); }, { public: true, guestOnly: true });
  NZ.act('au-next', () => {
    if (!ph8(AU.phone)) return;
    AU.err = ''; AU.pin = '';
    NZ.go(AU.mode === 'login' ? '/login/pin' : '/register/pin');
  });

  function pinScreen(ctx, o) {
    ctx.shell({ title: o.title, back: o.back, cls: 'cl', skeleton: false });
    const wa = NZ.waHref('Bonjour, j\'ai oublié mon code secret Nazari Express. Mon numéro : ' + AU.phone);
    ctx.main(html`<div>
      <div class="qrow"><span class="qill">${il('lock', 78)}</span><div class="qtxt"><h1 class="qt">${o.q}</h1>${o.sub ? html`<p class="qs">${o.sub}</p>` : ''}</div>${VO.btn()}</div>
      ${errBox(AU.err)}
      ${K.keypad({ kind: 'pin', value: '', min: 4, max: o.max || 8, onChange: (v) => { setReady('au-go', v.length >= 4); } })}
      <div class="foot"><button type="button" class="btn primary xl full" id="au-go" data-act="${o.act}" disabled>${o.label}${ic('next', 28)}</button>
        ${o.random ? html`<button type="button" class="btn ghost xl full" data-act="au-random">${il('hello', 40)}Choisissez pour moi</button>` : ''}
        ${o.forgot && wa ? html`<a class="link-big" href="${wa}" target="_blank" rel="noopener noreferrer">J'ai oublié mon code</a>` : ''}</div>
    </div>`);
    VO.screen(() => [{ t: o.q }, { t: o.say }]);
  }
  NZ.route('/login/pin', (ctx) => {
    if (!ph8(AU.phone)) return NZ.go('/login/phone', { replace: true });
    pinScreen(ctx, { title: 'Connexion', back: '#/login/phone', q: 'Quel est votre code secret ?', label: 'Entrer', act: 'au-login', forgot: true, say: 'Touchez vos chiffres secrets, puis le bouton vert.' });
  }, { public: true, guestOnly: true });
  NZ.act('au-login', async (el) => {
    const pin = K.keypadValue();
    if (pin.length < 4) return;
    await U.busy(el, async () => {
      try { await NZ.afterAuth(await NZ.api('login', { phone: AU.phone, pin }, { anon: true })); } catch (e) {
        AU.err = e.message; VO.say(e.message);
        NZ.dispatch();
      }
    });
  });

  NZ.route('/register/pin', (ctx) => {
    if (!ph8(AU.phone)) return NZ.go('/register', { replace: true });
    pinScreen(ctx, { title: 'Nouveau compte', back: '#/register', q: 'Choisissez un code secret', sub: '4 chiffres que vous retenez bien.', max: 4, label: 'Suivant', act: 'au-pin1', random: true, say: 'Touchez quatre chiffres que vous retenez bien. Ou touchez le bouton du bas : nous choisissons pour vous.' });
  }, { public: true, guestOnly: true });
  NZ.act('au-pin1', () => {
    const pin = K.keypadValue();
    if (pin.length !== 4) { AU.err = 'Le code doit avoir 4 chiffres.'; return NZ.dispatch(); }
    if (NZ.weakPin(pin)) { AU.err = NZ.WEAK_PIN_MSG; VO.say(AU.err); return NZ.dispatch(); }
    AU.pin = pin; AU.err = '';
    NZ.go('/register/again');
  });
  NZ.route('/register/again', (ctx) => {
    if (!ph8(AU.phone) || AU.pin.length !== 4) return NZ.go('/register', { replace: true });
    pinScreen(ctx, { title: 'Nouveau compte', back: '#/register/pin', q: 'Refaites le même code', sub: 'Pour être sûr de ne pas se tromper.', max: 4, label: 'Créer mon compte', act: 'au-pin2', say: 'Touchez le même code une deuxième fois.' });
  }, { public: true, guestOnly: true });
  NZ.act('au-pin2', async (el) => {
    const again = K.keypadValue();
    if (again.length !== 4) return;
    if (again !== AU.pin) { AU.err = 'Les deux codes sont différents. Recommencez.'; AU.pin = ''; VO.say(AU.err); return NZ.go('/register/pin', { replace: true }); }
    await createAccount(el);
  });
  NZ.act('au-random', () => {
    let c = '';
    for (let i = 0; i < 40; i++) {
      const a = new Uint8Array(4);
      try { crypto.getRandomValues(a); } catch (e) { for (let j = 0; j < 4; j++) a[j] = Math.floor(Math.random() * 256); }
      c = Array.from(a, (x) => String(x % 10)).join('');
      if (!NZ.weakPin(c)) break;
    }
    AU.pin = c; AU.err = '';
    NZ.go('/register/code');
  });
  NZ.route('/register/code', (ctx) => {
    if (!ph8(AU.phone) || AU.pin.length !== 4) return NZ.go('/register', { replace: true });
    ctx.shell({ title: 'Votre code secret', back: '#/register/pin', cls: 'cl', skeleton: false });
    ctx.main(html`<div>
      <div class="qrow"><span class="qill">${il('lock', 78)}</span><div class="qtxt"><h1 class="qt">Votre code secret</h1></div>${VO.btn()}</div>
      ${errBox(AU.err)}
      <div class="code-big" aria-label="Votre code secret">${AU.pin.split('').map((d) => html`<span>${d}</span>`)}</div>
      <div class="note-soft" style="margin-top:0">${ic('info', 24)}<span>Notez ces 4 chiffres ou prenez une photo de l'écran. Vous en aurez besoin pour vous connecter.</span></div>
      <div class="foot"><button type="button" class="btn primary xl full" data-act="au-code-ok">J'ai noté mon code${ic('check', 28)}</button></div>
    </div>`);
    VO.screen(() => [{ t: 'Votre code secret est : ' + AU.pin.split('').join(', ') + '. Notez-le bien. Quand c\'est fait, touchez le bouton vert.' }]);
  }, { public: true, guestOnly: true });
  NZ.act('au-code-ok', (el) => createAccount(el));

  async function createAccount(el) {
    await U.busy(el, async () => {
      try {
        const r = await NZ.api('register', { name: 'Client ' + AU.phone.slice(-4), phone: AU.phone, pin: AU.pin, invite: '' }, { anon: true });
        U.toast('Compte créé. Bienvenue !', 'ok');
        await NZ.afterAuth(r);
      } catch (e) {
        if (e.code === 'phone_taken') { AU.mode = 'login'; AU.pin = ''; AU.err = 'Ce numéro a déjà un compte. Entrez votre code secret.'; VO.say(AU.err); return NZ.go('/login/pin'); }
        AU.err = e.message; VO.say(e.message);
        NZ.go(e.code === 'invalid_phone' ? '/register' : '/register/pin', { replace: true });
      }
    });
  }

  /* =====================================================================
     Accueil : trois gros choix en dessins
     ===================================================================== */
  const ST = {
    received: { il: 'st-received', t: 'Commande reçue', s: 'Nous la validons très vite.', cls: 'amber', w: 0 },
    accepted: { il: 'st-accepted', t: 'Commande validée', s: 'Un livreur va s\'en occuper.', cls: 'blue', w: 1 },
    preparing: { il: 'st-accepted', t: 'En préparation', s: 'Nous préparons votre commande.', cls: 'blue', w: 1 },
    in_delivery: { il: 'st-moving', t: 'Le livreur est en route', s: 'Gardez votre téléphone près de vous.', cls: '', w: 2 },
    delivered: { il: 'st-delivered', t: 'Livré', s: 'Merci de votre confiance.', cls: '', w: 3 },
    cancelled: { il: 'st-cancelled', t: 'Annulée', s: 'Cette commande a été annulée.', cls: 'red', w: -1 },
  };
  const orderTitle = (o) => (o.service === 'agency_drop' ? 'Colis vers ' + (o.agency_dest || 'une autre ville')
    : o.service === 'agency_pickup' ? 'Retrait à l\'agence' : o.service === 'pharmacy' ? 'Pharmacie' : 'Colis en ville');
  const orderSub = (o) => {
    const [a] = V.fromText(o), [b] = V.toText(o);
    return o.service === 'agency_drop' ? 'Agence ' + (o.partner_name || '') : a + ' → ' + b;
  };
  const priceShort = (o) => (o.service === 'pharmacy' && !(o.fees && o.fees.items) ? fcfa((o.fees && (o.fees.delivery || o.fees.total)) || 0) : fcfa((o.fees && o.fees.total) || 0));

  function orderCard(o) {
    const st = ST[o.status] || ST.received;
    return html`<a class="oc" href="#/order/${o.id}" data-vid="o-${o.id}"><span class="oi">${il(st.il, 64)}</span>
      <span class="ob"><span class="ot">${orderTitle(o)}</span><span class="os">${orderSub(o)}</span><span class="ost ${st.cls}">${st.t}</span></span>
      <span class="op">${priceShort(o)}</span></a>`;
  }
  function services(P) {
    return html`
      <button type="button" class="svc g" data-act="start" data-flow="send" data-vid="h1"><span class="ilbox">${il('send', 92)}</span><span class="st"><b>Envoyer un colis</b><small>à l'agence de transport</small><em>dès ${fcfa(P.small)}</em></span>${ic('chev', 28)}</button>
      <button type="button" class="svc t" data-act="start" data-flow="pickup" data-vid="h2"><span class="ilbox">${il('pickup', 92)}</span><span class="st"><b>Récupérer un colis</b><small>arrivé à l'agence</small><em>dès ${fcfa(P.small)}</em></span>${ic('chev', 28)}</button>
      <button type="button" class="svc b" data-act="start" data-flow="pharma" data-vid="h3"><span class="ilbox">${il('pharmacy', 92)}</span><span class="st"><b>Pharmacie</b><small>vos médicaments chez vous</small><em>dès ${fcfa(P.pharmacy)}</em></span>${ic('chev', 28)}</button>`;
  }
  function homeView(hello) {
    const P = NZ.prices(), co = NZ.company();
    const first = firstOf(NZ.user());
    return html`<div class="home">
      ${hello ? html`<div class="hello"><div class="ht"><h1>Bonjour${first ? ' ' + first : ''} !</h1><p>Que voulez-vous faire ?</p></div>${VO.btn()}</div>` : ''}
      ${co.maintenance ? html`<div class="err-box">${ic('alert', 26)}<div>Les nouvelles commandes sont suspendues pour le moment.</div></div>` : ''}
      ${services(P)}
    </div>`;
  }
  NZ.route('/', async (ctx) => {
    ctx.shell({ brand: true, menu: false, right: '', cls: 'cl', tab: 'home', skeleton: false });
    ctx.main(homeView(true));
    const P = NZ.prices();
    VO.screen(() => [
      { t: 'Bonjour. Que voulez-vous faire ?' },
      { t: 'Envoyer un colis à l\'agence de transport. À partir de ' + VO.fcfa(P.small) + '.', sel: '[data-vid="h1"]' },
      { t: 'Récupérer un colis arrivé à l\'agence. À partir de ' + VO.fcfa(P.small) + '.', sel: '[data-vid="h2"]' },
      { t: 'Pharmacie : vos médicaments chez vous. À partir de ' + VO.fcfa(P.pharmacy) + '.', sel: '[data-vid="h3"]' },
    ]);
    /* seuls changements possibles sur cet écran : la mise en maintenance et les prix */
    const sigOf = () => String(!!NZ.company().maintenance) + JSON.stringify(NZ.prices());
    let sig = sigOf();
    const load = async () => {
      await NZ.loadConfig();
      const s = sigOf();
      if (s !== sig) { sig = s; NZ.scrollKeep(() => ctx.main(homeView(true))); }
    };
    try { await Promise.all([load(), NZ.refreshMe()]); } catch (e) { return ctx.fail(e); }
    ctx.poll(60000, load);
  }, { roles: ['client'] });

  /* équipe : « passer une commande pour un client » */
  NZ.route('/new', (ctx) => {
    ctx.shell({ title: 'Nouvelle commande', back: NZ.homeHash(), cls: 'cl', tab: 'home', skeleton: false });
    ctx.main(homeView(false));
    VO.screen(() => [{ t: 'Choisissez le type de commande.' }]);
  });

  /* =====================================================================
     Commande en étapes : une question par écran
     ===================================================================== */
  const SIZES = [
    { key: 'small', il: 'size-s', name: 'Petit', range: '0 à 5 kg', w: 2 },
    { key: 'medium', il: 'size-m', name: 'Moyen', range: '5 à 10 kg', w: 7 },
    { key: 'large', il: 'size-l', name: 'Grand', range: '10 à 20 kg', w: 15 },
    { key: 'xl', il: 'size-xl', name: 'Très grand', range: 'plus de 20 kg', w: 25 },
  ];
  const sizeOf = (D) => SIZES.find((s) => s.key === D.size) || SIZES[0];
  const FLOWS = {
    send: { svc: 'agency_drop', title: 'Envoyer un colis', steps: ['agency', 'city', 'size', 'sender', 'recip', 'where', 'review'] },
    pickup: { svc: 'agency_pickup', title: 'Récupérer un colis', steps: ['agency', 'size', 'idcard', 'myphone', 'where', 'review'] },
    pharma: { svc: 'pharmacy', title: 'Pharmacie', steps: ['pharmacy', 'list', 'where', 'review'] },
  };
  const CALL_ME = 'À préciser (appelez-moi)';
  const partners = (kind) => ((NZ.config && NZ.config.partners) || []).filter((p) => p.kind === kind);
  const partnerCfg = (D) => ((NZ.config && NZ.config.partners) || []).find((p) => D.partner && p.id === D.partner.id) || null;
  const partnerName = (D) => { const p = partnerCfg(D); return p ? p.name : cleanName(D.partner && D.partner.name); };
  const partnerQ = (D) => { const p = partnerCfg(D); return p ? p.quartier || '' : ''; };

  function newDraft(flow) {
    const u = NZ.user() || {};
    const [fn, ln] = realName(u) ? splitName(u.name) : ['', ''];
    return {
      flow, key: NZ.newKey(), partner: null, other: false, partnerName: '', city: '', cityOther: false, cityName: '', size: '',
      sender: { first: fn, last: ln, phone: u.phone || '' }, recip: { first: '', last: '', phone: '' },
      quartier: '', loc: null, locState: '', locErr: '', myPhone: u.phone || '', photo: '', rxMode: '', list: '', rxPhoto: '', err: '',
    };
  }

  /* prix estimé (la base recalcule le vrai prix) */
  function estimate(D) {
    const P = NZ.prices();
    let tier = 'small', base, quote = false;
    if (D.flow === 'pharma') base = P.pharmacy; else { tier = sizeOf(D).key; base = P[tier]; quote = tier === 'xl'; }
    const pq = D.flow === 'send' ? D.quartier : partnerQ(D);
    const dq = D.flow === 'send' ? partnerQ(D) : D.quartier;
    const side = (q) => (D.loc && q === D.quartier ? (D.loc.far ? 'far' : 'near') : NZ.zone(q));
    const zs = [side(pq), side(dq)];
    const far = zs.includes('far'), unknown = zs.includes('unknown');
    return { base, quote, far, unknown, farFee: far ? P.far : 0, total: base + (far ? P.far : 0) };
  }

  const READY = {
    agency: (D) => nm(D.partnerName), pharmacy: (D) => nm(D.partnerName),
    city: (D) => nm(D.cityName), size: () => false,
    sender: (D) => nm(D.sender.first) && nm(D.sender.last) && ph8(D.sender.phone),
    recip: (D) => nm(D.recip.first) && nm(D.recip.last) && ph8(D.recip.phone),
    where: (D) => !!D.loc || !!D.quartier, idcard: (D) => !!D.photo, myphone: (D) => ph8(D.myPhone),
    list: (D) => (D.rxMode === 'photo' ? !!D.rxPhoto : D.rxMode === 'text' ? cleanName(D.list).length >= 3 : false),
    review: () => true,
  };
  const COMMIT = {
    agency(D) { D.partner = { id: '', name: cleanName(D.partnerName) }; },
    pharmacy(D) { D.partner = { id: '', name: cleanName(D.partnerName) }; },
    city(D) { D.city = cleanName(D.cityName); },
  };

  function partnerStep(D, kind) {
    const isPh = kind === 'pharmacy';
    const list = partners(kind);
    const q = isPh ? 'Quelle pharmacie ?' : D.flow === 'send' ? 'Quelle agence de transport ?' : 'Dans quelle agence est votre colis ?';
    const showOther = D.other || list.length === 0;
    const tiles = list.map((p, i) => html`<button type="button" class="tile${D.partner && D.partner.id === p.id ? ' sel' : ''}" data-act="pick-partner" data-id="${p.id}" data-vid="p${i}">${il(isPh ? 'pharmacy' : 'agency', 76)}<span class="tt">${p.name}</span>${p.quartier ? html`<span class="ts">${p.quartier}</span>` : ''}</button>`);
    const other = showOther
      ? html`<div class="card-who" style="margin-top:16px">${U.field({ label: isPh ? 'Nom de la pharmacie' : 'Nom de l\'agence', bind: 'partnerName', value: D.partnerName, maxlength: 60, placeholder: isPh ? 'Ex. Pharmacie du Marché' : 'Ex. Rimbo Transport' })}</div>`
      : html`<button type="button" class="tile other" data-act="partner-other" style="margin-top:16px;width:100%;min-height:76px;flex-direction:row" data-vid="po">${ic('plus', 30)}<span class="tt">${isPh ? 'Une autre pharmacie' : 'Une autre agence'}</span></button>`;
    return {
      q, body: html`<div class="${list.length > 1 ? 'grid2' : 'grid1'}">${tiles}</div>${other}`,
      foot: showOther ? bigNext('wz-next', 'wiz-next', READY[isPh ? 'pharmacy' : 'agency'](D)) : '',
      voice: [{ t: q }].concat(list.map((p, i) => ({ t: p.name + (p.quartier ? ', ' + p.quartier : ''), sel: '[data-vid="p' + i + '"]' })), [{ t: showOther ? 'Ou écrivez le nom ici.' : (isPh ? 'Ou une autre pharmacie.' : 'Ou une autre agence.'), sel: showOther ? null : '[data-vid="po"]' }]),
    };
  }
  function whoStep(D, side, q, sayText) {
    const P = D[side];
    return {
      q, il: side === 'sender' ? 'from' : 'to',
      body: html`${side === 'recip' && K.canContacts ? html`<button type="button" class="btn ghost full contact-btn" data-act="pick-contact">${il('contacts', 44)}Choisir dans mes contacts</button>` : ''}
        <div class="card-who">
          ${U.field({ label: 'Prénom', bind: side + '.first', value: P.first, autocomplete: 'given-name', maxlength: 30 })}
          ${U.field({ label: 'Nom', bind: side + '.last', value: P.last, autocomplete: 'family-name', maxlength: 30 })}
          ${U.field({ label: 'Numéro de téléphone', kind: 'phone', bind: side + '.phone', value: P.phone })}
        </div>`,
      foot: bigNext('wz-next', 'wiz-next', READY[side](D)),
      voice: [{ t: q }, { t: sayText }],
    };
  }

  const STEPS = {
    agency: (D) => partnerStep(D, 'agency'),
    pharmacy: (D) => partnerStep(D, 'pharmacy'),

    city(D) {
      const p = partnerCfg(D);
      const cities = p && p.destinations && p.destinations.length ? p.destinations : ((NZ.config && NZ.config.cities) || []);
      const q = 'Le colis va dans quelle ville ?';
      const showOther = D.cityOther || cities.length === 0;
      const tiles = cities.map((c, i) => html`<button type="button" class="tile q${D.city === c ? ' sel' : ''}" data-act="pick-city" data-v="${c}" data-vid="c${i}">${ic('pin', 26)}<span class="tt">${c}</span></button>`);
      const other = showOther
        ? html`<div class="card-who" style="margin-top:16px">${U.field({ label: 'Nom de la ville', bind: 'cityName', value: D.cityName, maxlength: 40 })}</div>`
        : html`<button type="button" class="tile other" data-act="city-other" style="margin-top:16px;width:100%;min-height:68px;flex-direction:row" data-vid="co">${ic('plus', 28)}<span class="tt">Une autre ville</span></button>`;
      return {
        q, body: html`<div class="grid2">${tiles}</div>${other}`,
        foot: showOther ? bigNext('wz-next', 'wiz-next', READY.city(D)) : '',
        voice: [{ t: q }].concat(cities.map((c, i) => ({ t: c, sel: '[data-vid="c' + i + '"]' })), [{ t: 'Ou une autre ville.', sel: showOther ? null : '[data-vid="co"]' }]),
      };
    },

    size(D) {
      const P = NZ.prices();
      const q = 'Quelle est la taille du colis ?';
      const tiles = SIZES.map((s, i) => html`<button type="button" class="tile size${D.size === s.key ? ' sel' : ''}" data-act="pick-size" data-v="${s.key}" data-vid="s${i}">${il(s.il, 136)}<span class="tt">${s.name}</span><span class="ts">${s.range}</span><span class="tp">${s.key === 'xl' ? html`dès ${fcfa(P.xl)}` : fcfa(P[s.key])}</span></button>`);
      return {
        q, sub: 'Touchez le dessin qui ressemble à votre colis.', body: html`<div class="grid2">${tiles}</div>`, foot: '',
        voice: [{ t: q }].concat(SIZES.map((s, i) => ({ t: s.name + ', ' + s.range.replace(' à ', ' à ') + '. ' + VO.fcfa(s.key === 'xl' ? P.xl : P[s.key]) + (s.key === 'xl' ? ', prix confirmé par l\'équipe' : '') + '.', sel: '[data-vid="s' + i + '"]' }))),
      };
    },

    sender: (D) => whoStep(D, 'sender', 'Qui envoie le colis ?', 'Écrivez le prénom, le nom et le numéro de téléphone de celui qui envoie.'),
    recip: (D) => whoStep(D, 'recip', 'Qui reçoit le colis ?', 'Écrivez le prénom, le nom et le numéro de téléphone de celui qui reçoit.'),

    where(D) {
      const q = D.flow === 'send' ? 'Où venons-nous prendre le colis ?' : D.flow === 'pickup' ? 'Où apportons-nous le colis ?' : 'Où devons-nous livrer ?';
      const wait = D.locState === 'wait';
      const foot = READY.where(D) && !wait ? bigNext('wz-next', 'wiz-next', true) : '';
      const callSel = D.quartier === CALL_ME && !D.loc;
      /* l'équipe qui passe une commande pour un client choisit son quartier dans la liste */
      if (NZ.role() !== 'client') {
        const Q = ((NZ.config && NZ.config.quartiers) || []).filter((x) => !V.isGeoName(x.name));
        return {
          q, il: 'location', sub: 'Choisissez le quartier du client.',
          body: html`<div class="grid2">${Q.map((x, i) => html`<button type="button" class="tile q${D.quartier === x.name ? ' sel' : ''}" data-act="pick-q" data-v="${x.name}" data-vid="q${i}">${ic('pin', 26)}<span class="tt">${x.name}</span></button>`)}
            <button type="button" class="tile call${callSel ? ' sel' : ''}" data-act="loc-callme" data-vid="qc">${ic('phone', 28)}<span class="tt">À préciser : appeler le client</span></button></div>`,
          foot,
          voice: [{ t: q }].concat(Q.map((x, i) => ({ t: x.name, sel: '[data-vid="q' + i + '"]' })), [{ t: 'Ou touchez ce bouton si le quartier est à préciser par téléphone.', sel: '[data-vid="qc"]' }]),
        };
      }
      const err = D.locErr ? html`<div class="err-box" style="margin-bottom:14px">${ic('alert', 26)}<div>${D.locErr}</div></div>` : '';
      let main, voice;
      if (wait) {
        main = html`<div class="locbox wait"><span class="spin dark" style="width:34px;height:34px;border-width:4px"></span><b>Je cherche votre position…</b><span>Cela peut prendre quelques secondes.</span></div>`;
        voice = [{ t: 'Je cherche votre position. Patientez quelques secondes.' }];
      } else if (D.loc) {
        const poor = D.loc.acc > 500;
        const note = (D.loc.far ? 'Vous êtes loin du centre : un petit supplément s\'ajoute. ' : '') + (poor ? 'La précision est faible (environ ' + D.loc.acc + ' mètres). Pour mieux faire, sortez dehors puis touchez « Changer ma position ». Sinon, continuez : le livreur vous appellera.' : D.loc.acc ? 'Précision : environ ' + D.loc.acc + ' mètres.' : '');
        main = html`${err}<div class="locbox ok">${ic('check', 46)}<b>Position enregistrée</b>${note ? html`<span>${note}</span>` : ''}</div>
          <button type="button" class="btn ghost full" data-act="loc-get" data-vid="lg" style="margin-top:14px">${ic('pin', 26)}Changer ma position</button>`;
        voice = [{ t: q }, { t: 'Votre position est enregistrée. Touchez le bouton vert Suivant pour continuer.', sel: '#wz-next' }];
      } else {
        main = html`<div class="lochero">${il('location', 156)}</div>${err}
          <button type="button" class="btn primary xl full" data-act="loc-get" data-vid="lg">${ic('pin', 30)}${D.locErr ? 'Réessayer' : 'Partager ma position'}</button>`;
        voice = [{ t: q }, { t: 'Touchez le grand bouton vert pour partager votre position. Le livreur viendra directement chez vous.', sel: '[data-vid="lg"]' }];
      }
      const callMe = html`<button type="button" class="btn ghost full callme${callSel ? ' sel' : ''}" data-act="loc-callme" data-vid="qc" style="margin-top:14px">${il('phone', 40)}Appelez-moi à la place</button>`;
      if (!D.loc) voice.push({ t: 'Si votre téléphone ne trouve pas votre position, touchez ce bouton : nous vous appelons.', sel: '[data-vid="qc"]' });
      return {
        q, sub: D.loc || wait ? '' : 'Le téléphone va demander la permission : touchez « Autoriser ».',
        body: html`${main}${D.loc ? '' : callMe}`,
        foot, voice,
      };
    },

    idcard(D) {
      const q = 'Photo de votre carte d\'identité';
      return {
        q, sub: 'Obligatoire pour retirer le colis.',
        body: html`<div class="pframe${D.photo ? ' ok' : ''}">${D.photo ? html`<img src="${D.photo}" alt="Votre carte d'identité"><span class="okbadge">${ic('check', 28)}</span><span class="pcap">Photo prête</span>` : il('id-card', 150)}</div>
          ${K.photoButtons('id', { cam: D.photo ? 'Reprendre la photo' : 'Prendre la photo' })}
          <div class="note-soft">${ic('lock', 24)}<span>Seuls Nazari Express et votre livreur la voient. La photo est effacée un jour après la livraison.</span></div>`,
        foot: bigNext('wz-next', 'wiz-next', READY.idcard(D)),
        voice: [{ t: q }, { t: 'Posez la carte sur une table, bien à plat. Touchez le bouton vert pour la photographier. Tout le texte doit être lisible.' }],
      };
    },

    myphone(D) {
      const q = 'Votre numéro de téléphone';
      return {
        q, il: 'phone', sub: 'Le livreur vous appelle à ce numéro.',
        body: K.keypad({ kind: 'phone', value: D.myPhone, onChange: (v) => { D.myPhone = v; setReady('wz-next', ph8(v)); } }),
        foot: bigNext('wz-next', 'wiz-next', READY.myphone(D)),
        voice: [{ t: q }, { t: 'Vérifiez votre numéro. Vous pouvez le changer avec les chiffres.' }],
      };
    },

    list(D) {
      const q = 'Que voulez-vous acheter ?';
      const tiles = html`<div class="grid2">
        <button type="button" class="tile${D.rxMode === 'photo' ? ' sel' : ''}" data-act="rx-mode" data-v="photo" data-vid="r1">${il('rx', 84)}<span class="tt">Photo de l'ordonnance</span></button>
        <button type="button" class="tile${D.rxMode === 'text' ? ' sel' : ''}" data-act="rx-mode" data-v="text" data-vid="r2">${il('chat', 84)}<span class="tt">Écrire la liste</span></button></div>`;
      let more = '';
      if (D.rxMode === 'photo') {
        more = html`<div style="margin-top:18px"><div class="pframe${D.rxPhoto ? ' ok' : ''}">${D.rxPhoto ? html`<img src="${D.rxPhoto}" alt="Votre ordonnance"><span class="okbadge">${ic('check', 28)}</span><span class="pcap">Photo prête</span>` : il('rx', 140)}</div>
          ${K.photoButtons('rx', { cam: D.rxPhoto ? 'Reprendre la photo' : 'Prendre la photo' })}</div>`;
      } else if (D.rxMode === 'text') {
        more = html`<div class="card-who" style="margin-top:18px">${U.field({ label: 'Votre liste', kind: 'textarea', bind: 'list', value: D.list, rows: 4, maxlength: 600, placeholder: 'Ex. Paracétamol 500 mg, 2 boîtes' })}</div>`;
      }
      return {
        q, sub: 'Nom des médicaments ou photo de l\'ordonnance. Seule l\'équipe voit votre liste.', body: html`${tiles}${more}`,
        foot: D.rxMode ? bigNext('wz-next', 'wiz-next', READY.list(D)) : '',
        voice: [{ t: q }, { t: 'Touchez ici pour photographier votre ordonnance.', sel: '[data-vid="r1"]' }, { t: 'Ou ici pour écrire la liste.', sel: '[data-vid="r2"]' }],
      };
    },

    review(D) {
      const e = estimate(D);
      const placeText = (d) => (d.loc ? 'Votre position (GPS)' : d.quartier === CALL_ME ? 'À préciser : nous vous appelons' : d.quartier);
      const placeSub = (d) => (d.loc && d.loc.acc ? 'précision environ ' + d.loc.acc + ' m' : '');
      const row = (ilName, label, main, sub) => html`<div class="r">${il(ilName, 54)}<div class="rt"><small>${label}</small><b>${main}</b>${sub ? html`<span>${sub}</span>` : ''}</div></div>`;
      const rows = [];
      let say = '';
      if (D.flow === 'send') {
        rows.push(row('agency', 'Agence de transport', partnerName(D), 'vers ' + D.city));
        rows.push(row(sizeOf(D).il, 'Colis', sizeOf(D).name + ' · ' + sizeOf(D).range));
        rows.push(row('from', 'Celui qui envoie', joinName(D.sender.first, D.sender.last), '+227 ' + U.fphone(D.sender.phone)));
        rows.push(row('to', 'Celui qui reçoit', joinName(D.recip.first, D.recip.last), '+227 ' + U.fphone(D.recip.phone)));
        rows.push(row('location', 'Nous venons prendre le colis à', placeText(D), placeSub(D)));
        say = 'Un colis ' + sizeOf(D).name.toLowerCase() + ' pour l\'agence ' + partnerName(D) + ', vers ' + D.city + '. De la part de ' + joinName(D.sender.first, D.sender.last) + ', pour ' + joinName(D.recip.first, D.recip.last) + '.';
      } else if (D.flow === 'pickup') {
        rows.push(row('agency', 'Agence', partnerName(D)));
        rows.push(row(sizeOf(D).il, 'Colis', sizeOf(D).name + ' · ' + sizeOf(D).range));
        rows.push(row('id-card', 'Carte d\'identité', 'Photo prête'));
        rows.push(row('phone', 'Votre numéro', '+227 ' + U.fphone(D.myPhone)));
        rows.push(row('location', 'Nous apportons le colis à', placeText(D), placeSub(D)));
        say = 'Nous allons chercher votre colis à l\'agence ' + partnerName(D) + ' et nous vous l\'apportons.';
      } else {
        rows.push(row('pharmacy', 'Pharmacie', partnerName(D)));
        rows.push(row(D.rxMode === 'photo' ? 'rx' : 'chat', 'Votre liste', D.rxMode === 'photo' ? 'Photo de l\'ordonnance' : cleanName(D.list).slice(0, 70)));
        rows.push(row('location', 'Nous livrons à', placeText(D), placeSub(D)));
        say = 'Nous achetons vos médicaments à la pharmacie ' + partnerName(D) + ' et nous vous les apportons.';
      }
      const cnt = D.flow === 'pharma' ? 'Vous payez aussi les médicaments au livreur, au prix de la pharmacie.' : '';
      return {
        q: 'C\'est bon ?', sub: 'Vérifiez, puis touchez le bouton vert.',
        body: html`${errBox(D.err)}<div class="rec">${rows}</div>
          <div class="price-big"><small>${D.flow === 'pharma' ? 'Livraison' : e.quote ? 'Prix à partir de' : 'Prix de la livraison'}</small><span class="n">${U.fnum(e.total)}<u>FCFA</u></span>
            <span class="x">${e.far ? 'dont ' + fcfa(e.farFee) + (D.loc ? ' parce que vous êtes loin du centre. ' : ' pour un quartier éloigné. ') : ''}${e.quote ? 'Prix confirmé par l\'équipe avant le départ. ' : ''}${e.unknown ? 'Un supplément peut s\'ajouter, confirmé par téléphone.' : ''}</span></div>
          <div class="pay-row">${il('cash', 54)}<span>Vous payez le livreur.${cnt ? ' ' + cnt : ''}</span></div>
          ${NZ.company().maintenance ? html`<div class="err-box" style="margin-top:14px">${ic('alert', 26)}<div>Les commandes sont suspendues pour le moment.</div></div>` : ''}`,
        foot: html`<div class="foot"><button type="button" class="btn primary xl full" data-act="wiz-send">${ic('check', 30)}Envoyer ma commande</button></div>`,
        voice: [{ t: 'Voici votre commande.' }, { t: say }, { t: 'Le prix est de ' + VO.fcfa(e.total) + (D.flow === 'pharma' ? ', plus les médicaments' : '') + '. Vous payez le livreur.', sel: '.price-big' }, { t: 'Si tout est bon, touchez le grand bouton vert pour envoyer.', sel: '[data-act="wiz-send"]' }],
      };
    },
  };

  let WZ = null;
  const NBSP = String.fromCharCode(160);
  const nbsp = (t) => (typeof t === 'string' ? t.replace(/ ([?!:;»])/g, NBSP + '$1').replace(/« /g, '«' + NBSP) : t);
  function frame(F, n, S, D) {
    const foot = S.foot !== undefined ? S.foot : bigNext('wz-next', 'wiz-next', READY[F.steps[n]](D));
    return html`<div class="wz">
      <div class="dots" aria-hidden="true">${F.steps.map((s, i) => html`<i class="${i < n ? 'done' : i === n ? 'now' : ''}"></i>`)}</div>
      <div class="qrow">${S.il ? html`<span class="qill">${il(S.il, 74)}</span>` : ''}<div class="qtxt"><h1 class="qt">${nbsp(S.q)}</h1>${S.sub ? html`<p class="qs">${S.sub}</p>` : ''}</div>${VO.btn()}</div>
      ${S.body}${foot}</div>`;
  }
  function onBind() {
    if (!WZ || !NZ.draft) return;
    const fn = READY[WZ.id];
    if (fn) setReady('wz-next', fn(NZ.draft));
  }
  function renderStep() {
    if (!WZ || !NZ.draft) return;
    const D = NZ.draft;
    const S = STEPS[WZ.id](D);
    if (!WZ.ctx.main(frame(WZ.F, WZ.n, S, D))) return;
    NZ.bindTarget = D; NZ.onBind = onBind;
    VO.screen(() => S.voice);
  }
  NZ.route('/new/:flow/:n', async (ctx) => {
    const flow = ctx.params.flow, F = FLOWS[flow], n = parseInt(ctx.params.n, 10);
    if (!F || !(n >= 0 && n < F.steps.length)) return NZ.go('/', { replace: true });
    if (!NZ.draft || NZ.draft.flow !== flow) {
      if (n !== 0) return NZ.go('/new/' + flow + '/0', { replace: true });
      NZ.draft = newDraft(flow);
    }
    WZ = { ctx, flow, F, n, id: F.steps[n] };
    ctx.shell({ title: F.title, backAct: 'wiz-back', cls: 'cl', skeleton: false });
    if (!NZ.config) { try { await NZ.loadConfig(); } catch (e) { return ctx.fail(e); } }
    NZ.draft.err = '';
    renderStep();
  });
  const goStep = (k) => NZ.go('/new/' + WZ.flow + '/' + k);
  const advance = () => goStep(WZ.n + 1);
  NZ.act('start', (el) => { NZ.draft = newDraft(el.dataset.flow); NZ.go('/new/' + el.dataset.flow + '/0'); });
  NZ.act('wiz-back', () => { if (WZ && WZ.n > 0) goStep(WZ.n - 1); else NZ.go(NZ.role() === 'client' ? '/' : '/new'); });
  NZ.act('wiz-next', () => {
    const D = NZ.draft; if (!D || !WZ) return;
    if (!READY[WZ.id](D)) return;
    if (COMMIT[WZ.id]) COMMIT[WZ.id](D);
    advance();
  });
  NZ.act('pick-partner', (el) => {
    const p = ((NZ.config && NZ.config.partners) || []).find((x) => x.id === el.dataset.id);
    if (!p) return;
    NZ.draft.partner = { id: p.id, name: p.name }; NZ.draft.other = false; NZ.draft.partnerName = '';
    if (NZ.draft.flow === 'send') NZ.draft.city = NZ.draft.city || '';
    advance();
  });
  NZ.act('partner-other', () => { NZ.draft.other = true; NZ.scrollKeep(renderStep); const i = $('input[data-bind="partnerName"]'); if (i) i.focus(); });
  NZ.act('pick-city', (el) => { NZ.draft.city = el.dataset.v; NZ.draft.cityOther = false; advance(); });
  NZ.act('city-other', () => { NZ.draft.cityOther = true; NZ.scrollKeep(renderStep); const i = $('input[data-bind="cityName"]'); if (i) i.focus(); });
  NZ.act('pick-size', (el) => { NZ.draft.size = el.dataset.v; advance(); });
  NZ.act('pick-q', (el) => { NZ.draft.quartier = el.dataset.v; NZ.draft.loc = null; advance(); });
  NZ.act('loc-callme', () => { const D = NZ.draft; if (!D) return; D.quartier = CALL_ME; D.loc = null; D.locState = ''; D.locErr = ''; advance(); });
  const GEO_ERR = {
    1: 'La localisation est bloquée pour ce site. Autorisez-la dans les réglages du navigateur (touchez le cadenas à côté de l\'adresse), puis réessayez.',
    2: 'Je ne trouve pas votre position. Activez la localisation (GPS) du téléphone, puis réessayez.',
    3: 'Cela prend trop de temps. Allez dehors ou près d\'une fenêtre, puis réessayez.',
  };
  NZ.act('loc-get', () => {
    const D = NZ.draft; if (!D) return;
    const here = () => NZ.draft === D && WZ && WZ.id === 'where';
    const fail = (msg) => { D.locState = ''; D.locErr = msg; VO.say(msg); if (here()) NZ.scrollKeep(renderStep); };
    if (!navigator.geolocation) return fail('Ce téléphone ne permet pas de partager la position. Touchez « Appelez-moi à la place ».');
    D.locState = 'wait'; D.locErr = ''; NZ.scrollKeep(renderStep);
    VO.say('Je cherche votre position.');
    const onPos = (pos) => {
      if (!here()) { D.locState = ''; return; }
      const c = pos.coords;
      if (!(Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180)) return fail(GEO_ERR[2]);
      const km = V.geoKm(c.latitude, c.longitude);
      if (km > V.GEO.outKm) return fail('Votre position n\'est pas à Agadez : nous livrons seulement à Agadez. Si vous voulez quand même commander, touchez « Appelez-moi à la place ».');
      D.loc = { lat: +c.latitude.toFixed(6), lng: +c.longitude.toFixed(6), acc: Math.max(1, Math.round(c.accuracy || 0)), far: km > V.GEO.farKm };
      D.quartier = D.loc.far ? V.GEO.farName : V.GEO.name;
      D.locState = ''; D.locErr = '';
      NZ.scrollKeep(renderStep);
    };
    const onErr = (err) => { if (!here()) { D.locState = ''; return; } fail(GEO_ERR[err && err.code] || GEO_ERR[2]); };
    /* d'abord le GPS précis ; s'il n'y arrive pas (dans une maison, par exemple), la position approximative du réseau */
    navigator.geolocation.getCurrentPosition(onPos, (err) => {
      if (!err || err.code === 1 || !here()) return onErr(err);
      navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 });
    }, { enableHighAccuracy: true, timeout: 14000, maximumAge: 0 });
  });
  NZ.act('rx-mode', (el) => { NZ.draft.rxMode = el.dataset.v; NZ.scrollKeep(renderStep); });
  NZ.act('pick-contact', async () => {
    const c = await K.pickContact();
    if (!c || !NZ.draft) return;
    const [f, l] = splitName(c.name);
    NZ.draft.recip = { first: f, last: l, phone: c.phone || '' };
    NZ.scrollKeep(renderStep);
  });
  K.onPhoto = (key, url) => {
    if (!NZ.draft) return;
    if (key === 'id') NZ.draft.photo = url; else if (key === 'rx') NZ.draft.rxPhoto = url;
    NZ.scrollKeep(renderStep);
    VO.say('Photo prête');
  };

  function buildPayload(D) {
    const F = FLOWS[D.flow];
    const p = { service: F.svc, client_key: D.key, pay_method: 'cash' };
    p.partner = D.partner && D.partner.id ? { id: D.partner.id } : { name: cleanName(D.partner && D.partner.name), quartier: '', details: '' };
    if (D.flow !== 'pharma') p.weight_kg = String(sizeOf(D).w);
    const place = { quartier: D.quartier };
    if (D.loc) place.details = V.geoText(D.loc);
    if (D.flow === 'send') {
      p.pickup = Object.assign({ name: joinName(D.sender.first, D.sender.last), phone: D.sender.phone }, place);
      p.dest = { city: D.city, name: joinName(D.recip.first, D.recip.last), phone: D.recip.phone };
    } else if (D.flow === 'pickup') {
      p.drop = Object.assign({ phone: D.myPhone }, place);
    } else {
      p.drop = Object.assign({}, place);
      p.desc = D.rxMode === 'photo' ? 'Ordonnance en photo (voir la discussion)' : cleanName(D.list);
    }
    return p;
  }
  NZ.act('wiz-send', async (el) => {
    const D = NZ.draft; if (!D) return;
    if (NZ.company().maintenance) { D.err = 'Les commandes sont suspendues pour le moment.'; return renderStep(); }
    await U.busy(el, async () => {
      let rxFail = false;
      try {
        let r;
        if (D.flow === 'pickup') r = await NZ.api('pickup.create', Object.assign(buildPayload(D), { photo: D.photo }), { retry: 2, timeout: 45000 });
        else r = await NZ.api('order.create', buildPayload(D), { retry: 2, timeout: 25000 });
        if (D.flow === 'pharma' && D.rxMode === 'photo' && D.rxPhoto) {
          try { await NZ.api('chat.send', { photo: D.rxPhoto, text: 'Mon ordonnance', order_id: r.order.id }, { retry: 1, timeout: 45000 }); } catch (e) { rxFail = true; }
        }
        /* si le client n'avait pas encore de vrai nom, celui de l'expéditeur devient le sien */
        if (D.flow === 'send' && !realName(NZ.user()) && D.sender.phone === NZ.user().phone && nm(D.sender.first) && nm(D.sender.last)) {
          NZ.api('profile.update', { name: joinName(D.sender.first, D.sender.last) }).then((x) => { NZ.session.user = x.user; NZ.store.set('nz.s', NZ.session); }).catch(() => {});
        }
        NZ.draft = null; NZ.refreshMe();
        location.hash = '#/order/' + r.order.id + '?new=1' + (rxFail ? '&rx=0' : '');
      } catch (e) {
        D.err = e.message + (e.network ? ' Votre commande n\'est pas perdue : touchez encore le bouton, il n\'y aura pas de doublon.' : '');
        VO.say(D.err);
        renderStep();
        const b = $('.err-box'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  });

  /* =====================================================================
     Mes colis
     ===================================================================== */
  let OL = { scope: 'active', items: [] };
  const olView = () => html`<div class="seg-big"><button type="button" class="${OL.scope === 'active' ? 'on' : ''}" data-act="ol-scope" data-v="active">En cours</button><button type="button" class="${OL.scope === 'done' ? 'on' : ''}" data-act="ol-scope" data-v="done">Terminés</button></div>
    ${OL.items.length ? OL.items.map(orderCard)
      : html`<div class="empty" style="padding:24px 10px">${il('empty', 150, 'c')}<div class="t" style="font-size:22px;margin-top:6px">${OL.scope === 'active' ? 'Aucun colis en cours' : 'Aucun colis terminé'}</div>
        <div style="margin-top:16px"><a class="btn primary xl full" href="#/">Faire une commande</a></div></div>`}`;
  NZ.route('/orders', async (ctx) => {
    ctx.shell({ title: 'Mes colis', tab: 'mine', cls: 'cl', skeleton: false });
    let sig = '';
    const load = async (force) => {
      const r = await NZ.api('order.list', { scope: OL.scope, limit: 60 });
      OL.items = r.items;
      const s = OL.scope + JSON.stringify(r.items);
      if (force || s !== sig) { sig = s; NZ.scrollKeep(() => ctx.main(olView())); }
    };
    NZ.olLoad = load;
    ctx.main(olView());
    VO.screen(() => [{ t: 'Vos colis.' }].concat(OL.items.map((o) => ({ t: orderTitle(o) + '. ' + (ST[o.status] || ST.received).t + '.', sel: '[data-vid="o-' + o.id + '"]' }))));
    try { await load(true); } catch (e) { return ctx.fail(e); }
    ctx.poll(15000, () => load(false));
  });
  NZ.act('ol-scope', async (el) => {
    OL.scope = el.dataset.v;
    OL.items = [];
    const m = document.getElementById('main'); if (m) m.innerHTML = str(olView());
    try { await NZ.olLoad(true); } catch (e) { U.toast(e.message, 'err'); }
  });

  /* =====================================================================
     Suivi d'un colis
     ===================================================================== */
  const FINAL = ['delivered', 'cancelled'];
  function orderPage(r, isNew, rxFail) {
    const o = r.order, st = ST[o.status] || ST.received;
    const drv = o.driver;
    const nodes = [['Reçue', 0], ['Validée', 1], ['En route', 2], ['Livrée', 3]];
    const track = o.status === 'cancelled' ? '' : html`<div class="trk">${nodes.map(([t, i]) => html`<div class="tn ${i < st.w ? 'done' : i === st.w ? 'now' : ''}"><i>${i < st.w || o.status === 'delivered' ? ic('check', 24) : i === st.w ? ic('clock', 22) : ''}</i>${t}</div>`)}</div>`;
    return html`<div>
      ${isNew && o.status === 'received' ? html`<div class="stp" style="margin-bottom:16px">${il('success', 130)}<h1>Commande envoyée !</h1><p>Nous la validons très vite. Vous suivrez tout ici.</p></div>` : ''}
      ${isNew && rxFail ? html`<div class="err-box">${ic('alert', 26)}<div>Votre ordonnance n'est pas partie. Envoyez-la en photo dans la discussion.</div></div>` : ''}
      <div class="stp ${st.cls}" data-vid="stp">${il(st.il, 140)}<h1>${st.t}</h1><p>${st.s}</p><span class="code num">${o.code}</span>${track}</div>
      ${drv && !FINAL.includes(o.status) ? html`<div class="cbox"><h2>Votre livreur</h2><div class="drv"><span class="av">${U.initials(drv.name)}</span><div><b>${drv.name}</b><span>+227 ${U.fphone(drv.phone)}</span></div></div>
        <div style="margin-top:14px">${btn({ href: U.telLink(drv.phone), label: 'Appeler le livreur', kind: 'primary', full: true, icon: 'phone', size: 'xl' })}</div></div>` : ''}
      <div class="cbox"><h2>${orderTitle(o)}</h2>
        <div class="pay-row" style="margin-top:0">${il('cash', 54)}<span>À payer au livreur : ${V.amountText(o)}</span></div>
        ${o.service === 'agency_pickup' ? html`<div class="note-soft">${il('id-card', 40)}<span>Photo de votre carte envoyée. Elle sera effacée un jour après la livraison.</span></div>` : ''}
        <details style="margin-top:14px"><summary style="font-weight:800;font-size:17px;padding:8px 0">Voir les détails</summary>${V.routeBlock(o)}${o.fees && (o.fees.total > 0 || o.service === 'pharmacy') ? V.feeBox(o) : ''}</details></div>
      <div class="cbox"><a class="btn primary xl full" href="#/chat?order=${o.id}">${il('chat', 44)}Écrire à ${NZ.company().name}</a></div>
      ${o.can_cancel ? html`<div style="margin-top:18px">${btn({ label: 'Annuler la commande', kind: 'danger', full: true, act: 'order-cancel', id: o.id })}</div>` : ''}
    </div>`;
  }
  NZ.route('/order/:id', async (ctx) => {
    ctx.shell({ title: 'Mon colis', back: '#/orders', tab: 'mine', cls: 'cl' });
    let sig = '', final = false;
    const isNew = ctx.query.new === '1', rxFail = ctx.query.rx === '0';
    const load = async () => {
      if (final) return;
      const r = await NZ.api('order.get', { id: ctx.params.id });
      final = FINAL.includes(r.order.status);
      NZ.currentOrder = r;
      const s = JSON.stringify(r);
      if (s !== sig) { sig = s; NZ.scrollKeep(() => ctx.main(orderPage(r, isNew, rxFail))); }
    };
    VO.screen(() => {
      const o = NZ.currentOrder && NZ.currentOrder.order; if (!o) return [];
      const st = ST[o.status] || ST.received;
      return [{ t: orderTitle(o) + '. ' + st.t + '. ' + st.s, sel: '[data-vid="stp"]' }].concat(o.driver && !FINAL.includes(o.status) ? [{ t: 'Votre livreur s\'appelle ' + o.driver.name + '. Touchez le bouton vert pour l\'appeler.' }] : []);
    });
    try { await load(); } catch (e) { return ctx.fail(e); }
    ctx.poll(12000, load);
  });
  NZ.act('order-cancel', async (el) => {
    const id = el.dataset.id;
    const ok = await U.confirmBox({ title: 'Annuler cette commande ?', text: 'Cette action est définitive.', reason: 'Motif (facultatif)', ok: 'Annuler la commande', cancel: 'Garder', danger: true });
    if (!ok) return;
    try {
      await NZ.api('order.cancel', { id, reason: ok.reason });
      U.toast('Commande annulée', 'ok');
      NZ.refreshMe();
      NZ.dispatch();
    } catch (e) { U.toast(e.message, 'err'); }
  });

  /* =====================================================================
     Compte
     ===================================================================== */
  const arow = (o) => {
    const inner = html`<span class="ad">${ic(o.icon, 26)}</span><span class="grow">${o.t}${o.s ? html`<small>${o.s}</small>` : ''}</span>${o.noArrow ? '' : ic('chev', 22)}`;
    return o.href ? html`<a class="arow ${o.cls || ''}" href="${o.href}">${inner}</a>` : html`<button type="button" class="arow ${o.cls || ''}" data-act="${o.act}">${inner}</button>`;
  };
  NZ.clientAccount = function (ctx) {
    ctx.shell({ title: 'Mon compte', tab: 'account', cls: 'cl', skeleton: false });
    const u = NZ.user();
    const installed = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    ctx.main(html`<div class="accbox"><span class="av">${U.initials(realName(u) || '?')}</span><div><b>${realName(u) || 'Bienvenue'}</b><span>+227 ${U.fphone(u.phone)}</span></div></div>
      ${arow({ icon: 'edit', t: realName(u) ? 'Changer mon nom' : 'Ajouter mon nom', act: 'edit-name' })}
      ${arow({ icon: 'lock', t: 'Changer mon code secret', act: 'change-pin' })}
      ${arow({ icon: 'tag', t: 'Nos prix', href: '#/tarifs' })}
      ${arow({ icon: 'help', t: 'Aide', href: '#/help' })}
      ${installed ? '' : arow({ icon: 'download', t: 'Mettre sur mon écran d\'accueil', act: 'install-app', noArrow: true })}
      ${arow({ icon: 'out', t: 'Me déconnecter', act: 'logout', cls: 'red', noArrow: true })}`);
    VO.screen(() => [{ t: 'Votre compte. Votre numéro est le ' + VO.phone(u.phone) + '.' }]);
    NZ.refreshMe();
  };
})((window.NZ = window.NZ || {}));
