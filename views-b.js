/* Nazari Express — écrans client : commande en étapes, liste et suivi des commandes. */
(function (NZ) {
  'use strict';
  const U = NZ.ui, V = NZ.v;
  const { html, raw, str, ic, btn, field, fcfa, fwhen, empty, statusChip, SERVICE } = U;
  const $ = (s) => document.querySelector(s);

  /* =====================================================================
     Commande en étapes
     ===================================================================== */
  const FLOWS = {
    parcel: { title: 'Envoyer un colis', steps: [{ id: 'colis', label: 'Colis' }, { id: 'sender', label: 'Expéditeur' }, { id: 'recipient', label: 'Destinataire' }, { id: 'pay', label: 'Paiement' }] },
    agency_drop: { title: 'Déposer à une agence', steps: [{ id: 'colis', label: 'Colis' }, { id: 'sender', label: 'Enlèvement' }, { id: 'agency', label: 'Agence' }, { id: 'pay', label: 'Paiement' }] },
    agency_pickup: { title: 'Retirer à une agence', steps: [{ id: 'agency', label: 'Agence' }, { id: 'recipient', label: 'Livraison' }, { id: 'pay', label: 'Paiement' }] },
    pharmacy: { title: 'Pharmacie', steps: [{ id: 'pharm', label: 'Pharmacie' }, { id: 'recipient', label: 'Livraison' }, { id: 'pay', label: 'Paiement' }] },
  };
  let WCTX = null;

  function newDraft(service) {
    const u = NZ.user();
    const own = service !== 'parcel';
    return {
      service, step: 0, key: NZ.newKey(), errors: {},
      weight: '2', dims: { l: '', w: '', h: '' }, desc: '', express: false, note: '',
      pickup: { quartier: '', other: '', details: '', name: u.name, phone: u.phone },
      drop: { quartier: '', other: '', details: '', name: own ? u.name : '', phone: own ? u.phone : '' },
      partner: { id: '', name: '', quartier: '', other: '', details: '' },
      dest: { city: '', other: '', name: '', phone: '' },
      agency_ref: '',
      payer: service === 'agency_drop' ? 'sender' : 'recipient',
      pay_method: 'cash',
    };
  }
  const parseW = (s) => { const n = Number(String(s == null ? '' : s).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const validW = (s) => /^[0-9]{1,3}([.,][0-9]{1,2})?$/.test(String(s).trim()) && parseW(s) >= 0.1 && parseW(s) <= 500;
  const partners = (kind) => ((NZ.config && NZ.config.partners) || []).filter((p) => p.kind === kind);
  const partnerOf = (D) => ((NZ.config && NZ.config.partners) || []).find((p) => p.id === D.partner.id) || null;
  const partnerQ = (D) => { const p = partnerOf(D); return p ? p.quartier || '' : D.partner.id === '__other' ? V.effQ(D.partner) : ''; };
  const effCity = (D) => (D.dest.city === '__other' ? String(D.dest.other || '').trim() : String(D.dest.city || '').trim());

  /* estimation (le serveur recalcule le vrai prix) */
  function estimate(D) {
    const P = NZ.prices();
    let tier = 'small', base, quote = false;
    if (D.service === 'pharmacy') base = P.pharmacy;
    else { const w = parseW(D.weight); tier = U.tierOf(w > 0 ? w : 1); base = P[tier]; quote = tier === 'xl'; }
    const pq = D.service === 'parcel' || D.service === 'agency_drop' ? V.effQ(D.pickup) : partnerQ(D);
    const dq = D.service === 'agency_drop' ? partnerQ(D) : V.effQ(D.drop);
    const zs = [NZ.zone(pq), NZ.zone(dq)];
    const far = zs.includes('far'), unknown = zs.includes('unknown');
    const express = D.service !== 'pharmacy' && D.express ? P.express : 0;
    return { tier, base, quote, far, unknown, express, farFee: far ? P.far : 0, delivery: base + express + (far ? P.far : 0) };
  }
  function priceBox(D) {
    const e = estimate(D);
    const range = (U.TIERS.find((t) => t.key === e.tier) || { range: '' }).range;
    return html`<div class="price-box">
      <div class="line"><span>${D.service === 'pharmacy' ? 'Livraison pharmacie' : 'Livraison (' + range + ')'}</span><span class="num">${e.quote ? 'sur devis' : fcfa(e.base)}</span></div>
      ${e.express ? html`<div class="line"><span>Express (même jour)</span><span class="num">+ ${fcfa(e.express)}</span></div>` : ''}
      ${e.far ? html`<div class="line"><span>Zone éloignée</span><span class="num">+ ${fcfa(e.farFee)}</span></div>` : ''}
      <div class="line tot"><span>${e.quote ? 'À partir de' : 'Total livraison'}</span><span class="num">${fcfa(e.delivery)}</span></div>
      ${D.service === 'pharmacy' ? html`<div class="small muted" style="margin-top:6px">+ le prix des médicaments, confirmé avant la livraison.</div>` : ''}
      ${e.quote ? html`<div class="small muted" style="margin-top:6px">Colis de plus de 20 kg : l'équipe confirme le prix final avant l'enlèvement.</div>` : ''}
      ${e.unknown ? html`<div class="small muted" style="margin-top:6px">Quartier hors de la liste : un supplément de zone éloignée peut s'appliquer, confirmé par message.</div>` : ''}</div>`;
  }
  function estLine(D) {
    const e = estimate(D);
    return D.service === 'pharmacy' ? 'Livraison : ' + fcfa(e.delivery) + ' + médicaments' : (e.quote ? 'Prix à partir de ' : 'Livraison estimée : ') + fcfa(e.delivery);
  }
  function updatePrice() {
    const D = NZ.draft; if (!D) return;
    const a = $('#wz-est'); if (a) a.textContent = estLine(D);
    const b = $('#wz-price'); if (b) b.innerHTML = str(priceBox(D));
    const c = $('#wz-recap'); if (c) c.innerHTML = str(recap(D));
  }

  /* ----- blocs réutilisables ----- */
  function addrChips(side) {
    if (!NZ.addrs || !NZ.addrs.length) return '';
    return html`<div class="field"><div class="lbl"><span>Mes adresses</span></div><div class="addr-chips">${NZ.addrs.map((a) => html`<button type="button" data-act="wiz-addr" data-side="${side}" data-id="${a.id}">${ic('pin', 16)}${a.label}</button>`)}</div></div>`;
  }
  function addrBody(D, E, side, o) {
    const A = D[side];
    return html`<div class="h2" style="margin-bottom:12px">${o.title}</div>
      ${addrChips(side)}
      ${V.quartierField({ label: 'Quartier', id: 'wz-' + side + '-other', value: A.quartier, other: A.other, bindQ: side + '.quartier', bindO: side + '.other', error: E[side + '.quartier'] })}
      ${field({ label: 'Précisions sur l\'adresse', bind: side + '.details', value: A.details, optional: true, placeholder: 'Ex. près de la grande mosquée', maxlength: 160 })}
      <div class="h2" style="margin:22px 0 12px">${o.who}</div>
      ${field({ label: 'Nom', bind: side + '.name', value: A.name, error: E[side + '.name'], autocomplete: 'name', maxlength: 60 })}
      ${field({ label: 'Téléphone', kind: 'phone', bind: side + '.phone', value: A.phone, error: E[side + '.phone'] })}`;
  }
  function weightBlock(D, E) {
    const w = parseW(D.weight);
    const tier = U.tierOf(w > 0 ? w : 1);
    return html`${field({ label: 'Type de colis', kind: 'select', value: tier, bind: 'tierSel', options: U.TIERS.map((t) => ({ v: t.key, t: t.label })), attrs: 'id="wz-tier"' })}
      <div class="field${E.weight ? ' err' : ''}"><div class="lbl"><span>Poids estimé (kg)</span></div>
        <div class="qty"><input class="input" id="wz-weight" inputmode="decimal" autocomplete="off" data-bind="weight" value="${D.weight}" aria-label="Poids en kilos">
          <button type="button" data-act="wiz-w" data-d="-1" aria-label="Moins">${ic('minus', 20)}</button><button type="button" data-act="wiz-w" data-d="1" aria-label="Plus">${ic('plus', 20)}</button></div>
        ${E.weight ? html`<div class="msg" role="alert">${E.weight}</div>` : ''}</div>`;
  }
  function partnerPick(D, E, kind) {
    const list = partners(kind);
    const P = D.partner;
    const none = list.length === 0;
    if (none) P.id = '__other';
    const isOther = P.id === '__other';
    const label = kind === 'pharmacy' ? 'Pharmacie' : 'Agence de transport';
    const sel = none ? '' : field({
      label, kind: 'select', value: P.id, bind: 'partner.id', error: isOther ? '' : E.partner, attrs: 'data-other="wz-partner-other"',
      options: [{ v: '', t: 'Choisir' }].concat(list.map((p) => ({ v: p.id, t: p.name + (p.quartier ? ' — ' + p.quartier : '') })), [{ v: '__other', t: kind === 'pharmacy' ? 'Autre pharmacie…' : 'Autre agence…' }]),
    });
    const other = html`<div id="wz-partner-other"${isOther ? '' : raw(' hidden')}>
      ${field({ label: none ? label : 'Nom', bind: 'partner.name', value: P.name, placeholder: kind === 'pharmacy' ? 'Ex. Pharmacie du Marché' : 'Ex. Rimbo Transport', error: isOther ? E.partner : '', maxlength: 60 })}
      ${V.quartierField({ label: 'Quartier', id: 'wz-partner-q-other', value: P.quartier, other: P.other, bindQ: 'partner.quartier', bindO: 'partner.other' })}</div>`;
    return html`${sel}${other}`;
  }

  /* ----- les étapes ----- */
  const STEP = {
    colis: (D, E) => html`<div class="h2" style="margin-bottom:12px">Informations du colis</div>
      ${weightBlock(D, E)}
      <div class="field${E.dims ? ' err' : ''}"><div class="lbl"><span>Dimensions</span><i>facultatif</i></div>
        <div class="grid3"><input class="input" inputmode="numeric" data-bind="dims.l" value="${D.dims.l}" placeholder="Longueur (cm)" aria-label="Longueur en centimètres">
          <input class="input" inputmode="numeric" data-bind="dims.w" value="${D.dims.w}" placeholder="Largeur (cm)" aria-label="Largeur en centimètres">
          <input class="input" inputmode="numeric" data-bind="dims.h" value="${D.dims.h}" placeholder="Hauteur (cm)" aria-label="Hauteur en centimètres"></div>
        ${E.dims ? html`<div class="msg" role="alert">${E.dims}</div>` : ''}</div>
      ${field({ label: 'Contenu du colis', kind: 'textarea', bind: 'desc', value: D.desc, rows: 2, optional: true, placeholder: 'Ex. vêtements, documents, pièce détachée…', maxlength: 600 })}`,

    sender: (D, E) => addrBody(D, E, 'pickup', { title: 'Adresse d\'enlèvement', who: 'Qui remet le colis ?' }),

    recipient: (D, E) => addrBody(D, E, 'drop', D.service === 'parcel'
      ? { title: 'Adresse de livraison', who: 'Destinataire' }
      : { title: 'Où devons-nous livrer ?', who: 'Personne qui réceptionne' }),

    agency: (D, E) => {
      if (D.service === 'agency_drop') {
        const p = partnerOf(D);
        const cities = p && p.destinations && p.destinations.length ? p.destinations : ((NZ.config && NZ.config.cities) || []);
        if (D.dest.city && D.dest.city !== '__other' && !cities.includes(D.dest.city)) D.dest.city = '';
        const isOther = D.dest.city === '__other';
        return html`<div class="h2" style="margin-bottom:12px">Agence de transport</div>
          ${partnerPick(D, E, 'agency')}
          <div class="h2" style="margin:22px 0 12px">Destinataire dans l'autre ville</div>
          ${field({ label: 'Ville de destination', kind: 'select', value: D.dest.city, bind: 'dest.city', error: isOther ? '' : E['dest.city'], attrs: 'data-other="wz-city-other"',
            options: [{ v: '', t: 'Choisir la ville' }].concat(cities.map((c) => ({ v: c, t: c })), [{ v: '__other', t: 'Autre ville…' }]) })}
          <div id="wz-city-other"${isOther ? '' : raw(' hidden')}>${field({ label: 'Nom de la ville', bind: 'dest.other', value: D.dest.other, error: isOther ? E['dest.city'] : '', maxlength: 40 })}</div>
          ${field({ label: 'Nom du destinataire', bind: 'dest.name', value: D.dest.name, error: E['dest.name'], maxlength: 60 })}
          ${field({ label: 'Téléphone du destinataire', kind: 'phone', bind: 'dest.phone', value: D.dest.phone, error: E['dest.phone'] })}
          ${V.notice('Nous déposons le colis à l\'agence. Les frais de transport de l\'agence se règlent à l\'agence.', '')}`;
      }
      return html`<div class="h2" style="margin-bottom:12px">Colis à retirer</div>
        ${partnerPick(D, E, 'agency')}
        ${field({ label: 'Nom ou numéro de reçu', bind: 'agency_ref', value: D.agency_ref, error: E.agency_ref, placeholder: 'Ex. colis au nom de Abdou / reçu n° 4521', maxlength: 80, hint: 'Ce que le livreur doit dire à l\'agence pour retirer le colis.' })}
        ${weightBlock(D, E)}
        ${field({ label: 'Description du colis', kind: 'textarea', bind: 'desc', value: D.desc, rows: 2, optional: true, placeholder: 'Ex. 2 cartons blancs', maxlength: 600 })}`;
    },

    pharm: (D, E) => html`<div class="h2" style="margin-bottom:12px">Pharmacie</div>
      ${partnerPick(D, E, 'pharmacy')}
      ${field({ label: 'Liste des médicaments ou produits', kind: 'textarea', bind: 'desc', value: D.desc, rows: 5, error: E.desc, maxlength: 600, placeholder: 'Ex. Paracétamol 500 mg × 2 boîtes, sirop contre la toux…', hint: 'Nom, dosage et quantité. Cette liste reste confidentielle : le livreur ne la voit pas.' })}`,

    pay: (D, E) => {
      const P = NZ.prices();
      const seg = (path, cur, opts) => html`<div class="seg" role="group">${opts.map(([v, t]) => html`<button type="button" class="${cur === v ? 'on' : ''}" data-act="wiz-set" data-path="${path}" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`)}</div>`;
      const notice = D.service === 'agency_drop' ? 'Vous réglez la livraison au livreur lors de l\'enlèvement.'
        : D.service === 'agency_pickup' ? 'Vous réglez la livraison au livreur à la réception du colis.'
          : D.service === 'pharmacy' ? 'Vous réglez le livreur à la livraison : livraison + médicaments.' : '';
      return html`<div class="h2" style="margin-bottom:12px">Paiement</div>
        ${D.service !== 'pharmacy' ? html`<label class="check${D.express ? ' on' : ''}"><input type="checkbox" data-bind="express"${D.express ? raw(' checked') : ''}><div><div class="t">Livraison express (même jour)</div><div class="s">+ ${fcfa(P.express)} · votre colis part en priorité</div></div></label>` : ''}
        ${D.service === 'parcel'
          ? html`<div class="field" style="margin-top:14px"><div class="lbl"><span>Qui paie la livraison ?</span></div>${seg('payer', D.payer, [['recipient', 'Le destinataire'], ['sender', 'Moi (à l\'enlèvement)']])}</div>`
          : html`<div style="margin-top:14px">${V.notice(notice)}</div>`}
        <div class="field" style="margin-top:14px"><div class="lbl"><span>Mode de paiement</span></div>${seg('pay_method', D.pay_method, [['cash', 'Espèces'], ['mobile', 'Mobile money']])}
          ${D.pay_method === 'mobile' ? html`<div class="hint">Le livreur vous indiquera le numéro à utiliser.</div>` : ''}</div>
        ${field({ label: 'Message pour l\'équipe', kind: 'textarea', bind: 'note', value: D.note, rows: 2, optional: true, placeholder: 'Ex. appeler avant de passer', maxlength: 400 })}
        <div class="h2" style="margin:22px 0 10px">Récapitulatif</div>
        <div class="card flat" id="wz-recap">${recap(D)}</div>
        <div id="wz-price" style="margin-top:12px">${priceBox(D)}</div>`;
    },
  };
  function recap(D) {
    const s = SERVICE[D.service];
    const from = D.service === 'agency_pickup' || D.service === 'pharmacy' ? (partnerOf(D) ? partnerOf(D).name : D.partner.name) : V.effQ(D.pickup);
    const to = D.service === 'agency_drop' ? (partnerOf(D) ? partnerOf(D).name : D.partner.name) + (effCity(D) ? ' → ' + effCity(D) : '') : V.effQ(D.drop);
    return html`${V.kv([
      ['Service', s.long],
      ['De', from], ['Vers', to],
      D.service !== 'pharmacy' ? ['Colis', parseW(D.weight) + ' kg' + (D.desc.trim() && D.service !== 'pharmacy' ? ' · ' + D.desc.trim().slice(0, 40) : '')] : ['Commande', 'Liste confidentielle'],
      D.service === 'agency_drop' ? ['Destinataire', D.dest.name + ' · ' + U.fphone(D.dest.phone)] : (D.service === 'parcel' ? ['Destinataire', D.drop.name + ' · ' + U.fphone(D.drop.phone)] : null),
    ])}`;
  }

  /* ----- validation de l'étape ----- */
  function validate(D) {
    const E = {};
    const id = FLOWS[D.service].steps[D.step].id;
    const addr = (side) => {
      if (V.effQ(D[side]).length < 2) E[side + '.quartier'] = D[side].quartier === '__other' ? 'Écrivez le nom du quartier.' : 'Choisissez le quartier.';
      if (String(D[side].name).trim().length < 2) E[side + '.name'] = 'Entrez un nom (2 lettres minimum).';
      if (!/^\d{8}$/.test(String(D[side].phone || ''))) E[side + '.phone'] = 'Entrez les 8 chiffres du numéro.';
    };
    const weight = () => {
      if (!validW(D.weight)) E.weight = 'Entrez un poids valide (ex. 2 ou 2,5).';
    };
    const partner = (kind) => {
      const P = D.partner;
      if (!P.id) E.partner = kind === 'pharmacy' ? 'Choisissez la pharmacie.' : 'Choisissez l\'agence.';
      else if (P.id === '__other' && String(P.name).trim().length < 2) E.partner = kind === 'pharmacy' ? 'Indiquez le nom de la pharmacie.' : 'Indiquez le nom de l\'agence.';
    };
    if (id === 'colis') {
      weight();
      const bad = ['l', 'w', 'h'].some((k) => { const v = String(D.dims[k]).trim(); return v && !(/^\d{1,3}$/.test(v) && +v >= 1 && +v <= 500); });
      if (bad) E.dims = 'Les dimensions sont des nombres en cm (1 à 500).';
    }
    if (id === 'sender') addr('pickup');
    if (id === 'recipient') addr('drop');
    if (id === 'agency') {
      partner('agency');
      if (D.service === 'agency_drop') {
        if (effCity(D).length < 2) E['dest.city'] = D.dest.city === '__other' ? 'Écrivez le nom de la ville.' : 'Choisissez la ville de destination.';
        if (String(D.dest.name).trim().length < 2) E['dest.name'] = 'Entrez le nom du destinataire.';
        if (!/^\d{8}$/.test(String(D.dest.phone || ''))) E['dest.phone'] = 'Entrez les 8 chiffres du numéro.';
      } else {
        if (String(D.agency_ref).trim().length < 2) E.agency_ref = 'Indiquez le nom ou le numéro de reçu.';
        weight();
      }
    }
    if (id === 'pharm') {
      partner('pharmacy');
      if (String(D.desc).trim().length < 3) E.desc = 'Écrivez la liste des médicaments ou produits.';
    }
    return E;
  }

  function buildPayload(D) {
    const s = D.service;
    const p = { service: s, client_key: D.key, express: s !== 'pharmacy' && !!D.express, pay_method: D.pay_method };
    if (D.note.trim()) p.note = D.note.trim();
    if (s !== 'pharmacy') p.weight_kg = String(D.weight).trim().replace(',', '.');
    if (s !== 'pharmacy') {
      const dm = {};
      ['l', 'w', 'h'].forEach((k) => { if (String(D.dims[k]).trim()) dm[k] = String(D.dims[k]).trim(); });
      if (Object.keys(dm).length) p.dims = dm;
    }
    if (D.desc.trim()) p.desc = D.desc.trim();
    if (s === 'parcel' || s === 'agency_drop') p.pickup = { quartier: V.effQ(D.pickup), details: D.pickup.details.trim(), name: D.pickup.name.trim(), phone: D.pickup.phone };
    if (s === 'parcel' || s === 'agency_pickup' || s === 'pharmacy') p.drop = { quartier: V.effQ(D.drop), details: D.drop.details.trim(), name: D.drop.name.trim(), phone: D.drop.phone };
    if (s !== 'parcel') {
      p.partner = D.partner.id && D.partner.id !== '__other'
        ? { id: D.partner.id }
        : { name: D.partner.name.trim(), quartier: V.effQ(D.partner), details: (D.partner.details || '').trim() };
    }
    if (s === 'agency_drop') p.dest = { city: effCity(D), name: D.dest.name.trim(), phone: D.dest.phone };
    if (s === 'agency_pickup') p.agency_ref = D.agency_ref.trim();
    if (s === 'parcel') p.payer = D.payer;
    return p;
  }

  /* ----- affichage ----- */
  function wizHtml(D) {
    const F = FLOWS[D.service];
    const last = D.step === F.steps.length - 1;
    const E = D.errors || {};
    return html`<div class="steps">${F.steps.map((s, i) => html`<div class="step ${i === D.step ? 'on' : i < D.step ? 'done' : ''}"><span class="n">${i < D.step ? ic('check', 16) : i + 1}</span>${s.label}</div>`)}</div>
      ${NZ.company().maintenance ? html`<div style="margin-bottom:14px">${V.notice('Les commandes sont suspendues pour le moment. Vous ne pourrez pas confirmer avant la reprise.', 'warn')}</div>` : ''}
      ${V.errBox(E.general)}
      <form data-submit="wiz-next" novalidate>${STEP[F.steps[D.step].id](D, E)}
        <div class="sticky-foot"><div id="wz-est" class="small muted center" style="margin-bottom:8px">${estLine(D)}</div>
          <div class="btn-row">${D.step > 0 ? btn({ label: 'Retour', kind: 'ghost', act: 'wiz-back' }) : ''}${last ? btn({ label: 'Confirmer la commande', type: 'submit', icon: 'check' }) : btn({ label: 'Suivant', type: 'submit', iconRight: 'next' })}</div></div>
      </form>`;
  }
  function drawStep() {
    const D = NZ.draft;
    WCTX.shell({ title: FLOWS[D.service].title, backAct: 'wiz-back', skeleton: false });
    WCTX.main(wizHtml(D));
    NZ.bindTarget = D; NZ.onBind = wizBind;
  }
  function redraw() {
    const D = NZ.draft;
    NZ.scrollKeep(() => WCTX.main(wizHtml(D)));
    NZ.bindTarget = D; NZ.onBind = wizBind;
  }
  function wizBind(path, el, v) {
    const D = NZ.draft;
    if (!D) return;
    if (path === 'tierSel') {
      const t = U.TIERS.find((x) => x.key === v);
      if (t && U.tierOf(parseW(D.weight) > 0 ? parseW(D.weight) : 1) !== v) { D.weight = String(t.def); const wi = $('#wz-weight'); if (wi) wi.value = D.weight; }
    } else if (path === 'weight') {
      const ts = $('#wz-tier'); if (ts) ts.value = U.tierOf(parseW(D.weight) > 0 ? parseW(D.weight) : 1);
    } else if (path === 'express') {
      const c = el.closest('.check'); if (c) c.classList.toggle('on', !!v);
    } else if (path === 'partner.id' && D.service === 'agency_drop') {
      redraw(); return;
    }
    updatePrice();
  }

  NZ.route('/new/:service', async (ctx) => {
    const svc = ctx.params.service;
    if (!FLOWS[svc]) return NZ.go('/new', { replace: true });
    WCTX = ctx;
    if (!NZ.draft || NZ.draft.service !== svc) NZ.draft = newDraft(svc);
    ctx.shell({ title: FLOWS[svc].title, backAct: 'wiz-back', skeleton: true });
    try { await Promise.all([NZ.loadConfig(), NZ.loadAddresses().catch(() => null)]); } catch (e) { return ctx.fail(e); }
    if (!ctx.alive()) return;
    drawStep();
  }, { roles: ['client', 'driver', 'admin'] });

  NZ.act('wiz-back', () => {
    const D = NZ.draft;
    if (!D || D.step === 0) { NZ.go('/new'); return; }
    D.step -= 1; D.errors = {}; drawStep();
  });
  NZ.act('wiz-w', (el) => {
    const D = NZ.draft;
    const cur = parseW(D.weight) > 0 ? parseW(D.weight) : 1;
    const n = Math.min(500, Math.max(1, Math.round((cur + Number(el.dataset.d)) * 10) / 10));
    D.weight = String(n).replace('.', ',');
    const wi = $('#wz-weight'); if (wi) wi.value = D.weight;
    wizBind('weight', wi, D.weight);
  });
  NZ.act('wiz-set', (el) => { U.setPath(NZ.draft, el.dataset.path, el.dataset.v); redraw(); });
  NZ.act('wiz-addr', (el) => {
    const D = NZ.draft;
    const a = (NZ.addrs || []).find((x) => x.id === el.dataset.id);
    if (!a) return;
    const A = D[el.dataset.side];
    const known = ((NZ.config && NZ.config.quartiers) || []).find((q) => q.name.toLowerCase() === a.quartier.toLowerCase());
    A.quartier = known ? known.name : '__other'; A.other = known ? '' : a.quartier;
    A.details = a.details || '';
    if (a.contact_name) A.name = a.contact_name;
    if (a.contact_phone) A.phone = a.contact_phone;
    redraw();
  });
  NZ.submit('wiz-next', async (form) => {
    const D = NZ.draft;
    if (!D) return;
    const last = D.step === FLOWS[D.service].steps.length - 1;
    D.errors = validate(D);
    if (Object.keys(D.errors).length) {
      redraw();
      const f = document.querySelector('.field.err, .notice.bad');
      if (f && f.scrollIntoView) f.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (!last) { D.step += 1; drawStep(); return; }
    if (NZ.company().maintenance) { D.errors = { general: 'Les commandes sont suspendues pour le moment. Écrivez-nous sur WhatsApp.' }; redraw(); return; }
    await U.busy(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await NZ.api('order.create', buildPayload(D), { retry: 2, timeout: 25000 });
        NZ.draft = null;
        NZ.refreshMe();
        location.hash = '#/order/' + r.order.id + '?new=1';
      } catch (e) {
        D.errors = { general: e.message + (e.network ? ' Votre commande n\'a pas été perdue : réessayez, il n\'y aura pas de doublon.' : '') };
        redraw();
        const f = document.querySelector('.notice.bad'); if (f && f.scrollIntoView) f.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  });

  /* =====================================================================
     Mes commandes
     ===================================================================== */
  let OL = { scope: 'active', items: [] };
  const olView = () => {
    const chip = (v, t) => html`<button type="button" class="fchip${OL.scope === v ? ' on' : ''}" data-act="ol-scope" data-v="${v}">${t}</button>`;
    return html`<div class="filters">${chip('active', 'En cours')}${chip('done', 'Terminées')}${chip('all', 'Toutes')}</div>
      ${OL.items.length ? OL.items.map((o) => V.orderCard(o, '#/order/' + o.id))
        : empty('box', OL.scope === 'active' ? 'Aucune commande en cours' : 'Aucune commande', 'Vos commandes apparaîtront ici avec leur suivi.', btn({ label: 'Nouvelle commande', href: '#/new', icon: 'plus' }))}`;
  };
  NZ.route('/orders', async (ctx) => {
    ctx.shell({ title: 'Mes commandes', back: NZ.homeHash(), tab: 'home' });
    let sig = '';
    const load = async (force) => {
      const r = await NZ.api('order.list', { scope: OL.scope, limit: 60 });
      OL.items = r.items;
      const s = OL.scope + JSON.stringify(r.items);
      if (force || s !== sig) { sig = s; NZ.scrollKeep(() => ctx.main(olView())); }
    };
    NZ.olLoad = load;
    try { await load(true); } catch (e) { return ctx.fail(e); }
    ctx.poll(15000, () => load(false));
  });
  NZ.act('ol-scope', async (el) => {
    OL.scope = el.dataset.v;
    const m = document.getElementById('main'); if (m) m.innerHTML = str(olView());
    try { await NZ.olLoad(true); } catch (e) { U.toast(e.message, 'err'); }
  });

  /* =====================================================================
     Suivi d'une commande
     ===================================================================== */
  const FINAL = ['delivered', 'cancelled'];
  function orderView(r, isNew) {
    const o = r.order;
    const s = SERVICE[o.service] || SERVICE.parcel;
    const co = NZ.company();
    const flags = [o.express ? 'Express' : '', o.far ? 'Zone éloignée' : '', o.quote ? 'Prix sur devis' : ''].filter(Boolean);
    const dims = o.dims ? [o.dims.l, o.dims.w, o.dims.h].filter(Boolean).join(' × ') + ' cm' : '';
    const waCo = NZ.waHref('Bonjour ' + co.name + ', à propos de ma commande ' + o.code + ' : ');
    const drv = o.driver;
    const route = V.fromText(o)[0] + ' → ' + V.toText(o)[0];
    const shareMsg = 'Bonjour ' + co.name + ', je viens de passer la commande ' + o.code + ' (' + s.t + ' : ' + route + '). Merci de la valider.';
    const waNew = NZ.waHref(shareMsg);
    return html`<div class="stack">
      ${isNew && o.status === 'received' ? html`<div class="card" style="text-align:center;border-color:var(--green)"><span class="disc solid" style="margin:0 auto 10px">${ic('check', 28)}</span><div class="h2">Commande envoyée !</div>
        <p class="muted" style="margin:6px 0 0">Nous l'avons bien reçue sous le numéro <b class="num">${o.code}</b>. L'équipe la valide dans quelques minutes et vous prévient ici.</p>
        ${waNew ? html`<div style="margin-top:14px">${btn({ label: 'Prévenir l\'équipe sur WhatsApp', href: waNew, kind: 'wa', full: true, icon: 'wa' })}</div>` : ''}</div>` : ''}
      <div class="card"><div class="code-card" style="justify-content:space-between"><div style="display:flex;gap:12px;align-items:center"><span class="disc sm solid">${ic(s.icon, 20)}</span><div><div class="muted small">Commande n°</div><div class="h2 num">${o.code}</div></div></div>${statusChip(o.status)}</div>
        ${V.kv([['Type', V.serviceLine(o)], ['Montant', V.amountText(o)], ['Paiement', V.payText(o)], ['Date', fwhen(o.created_at)], o.status === 'delivered' && o.delivered_at ? ['Livrée', fwhen(o.delivered_at)] : null])}
        ${flags.length ? html`<div class="actions" style="margin-top:10px">${flags.map((f) => html`<span class="chip plain">${f}</span>`)}</div>` : ''}</div>
      <div class="card"><div class="h2" style="margin-bottom:12px">Suivi</div>${V.timeline(o.status, r.events, o.service)}</div>
      ${drv && o.status !== 'cancelled' ? html`<div class="card"><div class="h2" style="margin-bottom:8px">Votre livreur</div><div style="display:flex;gap:12px;align-items:center"><span class="avatar" style="width:46px;height:46px;font-size:17px;border-width:2px">${U.initials(drv.name)}</span><div><div style="font-weight:700">${drv.name}</div><div class="muted small">+227 ${U.fphone(drv.phone)}</div></div></div>${V.callRow(drv.phone, 'Bonjour, je vous contacte pour ma commande ' + o.code + '.')}</div>` : ''}
      <div class="card"><div class="h2" style="margin-bottom:12px">Adresses</div>${V.routeBlock(o)}
        ${o.desc || dims || o.note ? V.kv([[o.service === 'pharmacy' ? 'Ma liste' : 'Contenu', o.desc], ['Dimensions', dims], ['Message', o.note]]) : ''}</div>
      ${o.fees.total > 0 || o.service === 'pharmacy' ? V.feeBox(o, 'Détail du prix') : ''}
      ${o.can_cancel ? btn({ label: 'Annuler la commande', kind: 'danger', full: true, act: 'order-cancel', id: o.id }) : ''}
      ${waCo ? btn({ label: drv && !FINAL.includes(o.status) ? 'Contacter l\'équipe' : 'Contacter ' + co.name, href: waCo, kind: drv && !FINAL.includes(o.status) ? 'ghost' : 'wa', full: true, icon: 'wa' }) : ''}
    </div>`;
  }
  NZ.route('/order/:id', async (ctx) => {
    ctx.shell({ title: 'Suivi de la commande', back: '#/orders', tab: 'home' });
    let sig = '', final = false;
    const isNew = ctx.query.new === '1';
    const load = async () => {
      if (final) return;
      const r = await NZ.api('order.get', { id: ctx.params.id });
      final = FINAL.includes(r.order.status);
      NZ.currentOrder = r;
      const s = JSON.stringify(r);
      if (s !== sig) { sig = s; NZ.scrollKeep(() => ctx.main(orderView(r, isNew))); }
    };
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
  NZ.orderView = orderView;
})((window.NZ = window.NZ || {}));
