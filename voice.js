/* Nazari Express — outils pour tous : voix, clavier à gros chiffres, photo, contacts.
   Pensé pour ceux qui lisent peu : tout se touche, tout peut être lu à voix haute. */
(function (NZ) {
  'use strict';
  const U = NZ.ui;
  const { html, raw, str, ic } = U;

  /* =====================================================================
     Voix : le téléphone lit la question et les choix, un par un, en les éclairant.
     (synthèse vocale du navigateur : aucun fichier son, rien à télécharger)
     ===================================================================== */
  const synth = window.speechSynthesis;
  const canSpeak = !!(synth && window.SpeechSynthesisUtterance);
  const VO = { on: false, token: 0, speaking: false, fn: null };
  let frVoice = null;

  function pickVoice() {
    if (frVoice) return frVoice;
    try {
      const vs = synth.getVoices() || [];
      frVoice = vs.find((v) => /^fr[-_]FR$/i.test(v.lang)) || vs.find((v) => /^fr/i.test(v.lang)) || null;
    } catch (e) { /* ignore */ }
    return frVoice;
  }
  if (canSpeak) { try { synth.addEventListener('voiceschanged', () => { frVoice = null; pickVoice(); }); } catch (e) { /* ignore */ } }

  function speakOne(text, token) {
    return new Promise((resolve) => {
      if (!canSpeak || token !== VO.token) return resolve();
      let done = false, timer = null;
      const fin = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'fr-FR';
        const v = pickVoice(); if (v) u.voice = v;
        u.rate = 0.9; u.pitch = 1; u.volume = 1;
        u.onend = fin; u.onerror = fin;
        timer = setTimeout(fin, Math.max(2500, text.length * 110 + 2000));
        synth.speak(u);
      } catch (e) { fin(); }
    });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function clearHl() { document.querySelectorAll('.speaking').forEach((e) => e.classList.remove('speaking')); }
  function setBtns(on) { document.querySelectorAll('[data-act="say"]').forEach((b) => b.classList.toggle('on', !!on)); }

  function stop(keepOn) {
    VO.token++; VO.speaking = false;
    if (canSpeak) { try { synth.cancel(); } catch (e) { /* ignore */ } }
    clearHl(); setBtns(false);
    if (!keepOn) VO.on = false;
  }
  /* parts : [{ t: 'texte lu', sel: 'sélecteur de l\'élément à éclairer' }, …] */
  async function readParts(parts) {
    stop(true);
    await sleep(70);
    const my = ++VO.token;
    VO.speaking = true; setBtns(true);
    for (const p of parts || []) {
      if (my !== VO.token) return;
      const el = p.sel ? document.querySelector(p.sel) : null;
      clearHl();
      if (el) { el.classList.add('speaking'); try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ } }
      await speakOne(p.t, my);
      if (my !== VO.token) return;
      await sleep(180);
    }
    if (my === VO.token) { VO.speaking = false; clearHl(); setBtns(false); }
  }
  /* une phrase isolée (chiffre tapé, message d'erreur) ; force : même si la lecture automatique est coupée */
  function say(text, force) {
    if (!canSpeak || !text || (!VO.on && !force)) return;
    VO.token++;
    try { synth.cancel(); } catch (e) { /* ignore */ }
    const my = VO.token;
    setTimeout(() => { if (my === VO.token) speakOne(text, my); }, 50);
  }

  NZ.voice = {
    can: canSpeak,
    get on() { return VO.on; },
    /* chaque écran déclare ce qu'il faut lire ; si la voix est activée, la lecture commence toute seule */
    screen(fn) {
      VO.fn = fn;
      if (VO.on && canSpeak) setTimeout(() => { if (VO.fn === fn) readParts(fn()); }, 450);
    },
    say, stop,
    read: (parts) => readParts(parts),
    /* le bouton rond « écouter » */
    btn() {
      if (!canSpeak) return '';
      return html`<button type="button" class="say" data-act="say" aria-label="Écouter à voix haute">${ic('vol', 30)}</button>`;
    },
    /* « 96123456 » -> « 96, 12, 34, 56 » */
    phone(p) { return String(p || '').replace(/\D/g, '').replace(/(\d{2})(?=\d)/g, '$1, '); },
    fcfa(n) { return String(Math.round(Number(n) || 0)) + ' francs CFA'; },
  };
  NZ.act('say', () => {
    if (!canSpeak) { U.toast('La voix n\'est pas disponible sur ce téléphone.', 'err'); return; }
    if (VO.speaking) { stop(); return; }          // un deuxième appui coupe la voix (et la lecture automatique)
    VO.on = true;
    if (VO.fn) readParts(VO.fn());
  });
  NZ.on('route', () => { stop(true); VO.fn = null; });

  /* =====================================================================
     Clavier à gros chiffres (numéro de téléphone, code secret)
     ===================================================================== */
  const KP = { value: '', max: 8, min: 8, kind: 'phone', show: false, onChange: null };

  function dispHtml() {
    const d = KP.value;
    if (KP.kind === 'phone') {
      let out = '';
      for (let g = 0; g < 4; g++) {
        const a = g * 2;
        out += '<span class="dg">' + [a, a + 1].map((i) => '<span class="ds' + (i < d.length ? ' f' : '') + '">' + (i < d.length ? d[i] : '') + '</span>').join('') + '</span>';
      }
      return out;
    }
    const n = Math.max(KP.min, d.length);
    let out = '';
    for (let i = 0; i < n; i++) out += '<span class="ds pin' + (i < d.length ? ' f' : '') + '">' + (i < d.length ? (KP.show ? d[i] : '•') : '') + '</span>';
    return out;
  }
  function paint() {
    const el = document.getElementById('kp-disp');
    if (el) el.innerHTML = dispHtml();
    if (KP.onChange) KP.onChange(KP.value);
  }
  function key(k) { return '<button type="button" class="k" data-act="kp" data-k="' + k + '">' + k + '</button>'; }

  NZ.kit = {
    /* o : { kind: 'phone' | 'pin', value, max, min, onChange } */
    keypad(o) {
      KP.kind = o.kind || 'phone';
      KP.max = o.max || (KP.kind === 'phone' ? 8 : 8);
      KP.min = o.min || (KP.kind === 'phone' ? 8 : 4);
      KP.value = String(o.value || '').replace(/\D/g, '').slice(0, KP.max);
      KP.show = KP.kind === 'phone';
      KP.onChange = o.onChange || null;
      return html`<div class="kp">
        <div class="kp-top"><div class="kp-disp" id="kp-disp" aria-live="polite">${raw(dispHtml())}</div>${KP.kind === 'pin' ? html`<button type="button" class="kp-eye" data-act="kp-eye" aria-label="Voir ou cacher le code">${ic('eye', 26)}</button>` : ''}</div>
        <div class="kp-keys">${raw('123456789'.split('').map(key).join(''))}
          <button type="button" class="k fn" data-act="kp-del" aria-label="Effacer le dernier chiffre">${ic('del', 30)}</button>${raw(key('0'))}
          <button type="button" class="k fn" data-act="kp-say" aria-label="Écouter les chiffres">${ic('vol', 28)}</button></div></div>`;
    },
    keypadValue: () => KP.value,
  };
  NZ.act('kp', (el) => {
    if (KP.value.length >= KP.max) return;
    KP.value += el.dataset.k;
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) { /* ignore */ }
    NZ.voice.say(el.dataset.k);
    paint();
  });
  NZ.act('kp-del', () => { KP.value = KP.value.slice(0, -1); paint(); });
  NZ.act('kp-eye', (el) => { KP.show = !KP.show; el.innerHTML = str(ic(KP.show ? 'eyeoff' : 'eye', 26)); paint(); });
  NZ.act('kp-say', () => {
    if (!NZ.voice.can) return U.toast('La voix n\'est pas disponible sur ce téléphone.', 'err');
    if (KP.kind === 'pin' && !KP.show) return;      // un code secret ne se lit pas à voix haute
    say(KP.value ? NZ.voice.phone(KP.value) : 'Aucun chiffre', true);
  });

  /* =====================================================================
     Photo : appareil photo du téléphone, réduite avant l'envoi (JPEG)
     ===================================================================== */
  async function decode(file) {
    try { return await createImageBitmap(file); } catch (e) { /* ancien navigateur : on passe par l'image */ }
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error('lecture'));
      fr.onload = () => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('image')); im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  /* renvoie une « data URL » JPEG de moins de maxChars caractères (la base accepte 450 000) */
  async function fileToJpeg(file, o) {
    o = o || {};
    const maxChars = o.maxChars || 400000;
    let edge = o.edge || 1400, q = o.q || 0.75;
    const bmp = await decode(file);
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    if (!w0 || !h0) throw new Error('image');
    for (let i = 0; i < 7; i++) {
      const s = Math.min(1, edge / Math.max(w0, h0));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w0 * s)); c.height = Math.max(1, Math.round(h0 * s));
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(bmp, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', q);
      if (url.length <= maxChars) { if (bmp.close) { try { bmp.close(); } catch (e) { /* ignore */ } } return url; }
      q = Math.max(0.4, q - 0.08); edge = Math.round(edge * 0.82);
    }
    throw new Error('trop lourde');
  }
  NZ.kit.fileToJpeg = fileToJpeg;
  /* le formulaire qui reçoit la photo se déclare ici : NZ.kit.onPhoto = (clé, dataUrl) => … */
  NZ.kit.onPhoto = null;
  document.addEventListener('change', async (e) => {
    const inp = e.target;
    if (!inp || !inp.matches || !inp.matches('input[data-photo]')) return;
    const file = inp.files && inp.files[0];
    const key = inp.dataset.photo;
    inp.value = '';
    if (!file) return;
    U.toast('Photo en cours…', '');
    try {
      const url = await fileToJpeg(file, key === 'id' ? { edge: 1400, q: 0.78 } : { edge: 1280, q: 0.72 });
      if (NZ.kit.onPhoto) NZ.kit.onPhoto(key, url);
    } catch (err) { U.toast('Cette photo ne peut pas être utilisée. Reprenez-la.', 'err'); }
  });
  /* deux gros boutons : appareil photo, galerie */
  NZ.kit.photoButtons = function (key, o) {
    o = o || {};
    return html`<div class="pbtns">
      <label class="pbtn cam"><input type="file" accept="image/*" capture="environment" hidden data-photo="${key}">${U.il('camera', 56)}<span>${o.cam || 'Prendre la photo'}</span></label>
      <label class="pbtn gal"><input type="file" accept="image/*" hidden data-photo="${key}">${U.il('photo', 56)}<span>${o.gal || 'Ma galerie'}</span></label></div>`;
  };

  /* =====================================================================
     Contacts du téléphone (Chrome sur Android) : choisir le destinataire d'un geste
     ===================================================================== */
  NZ.kit.canContacts = !!(navigator.contacts && navigator.contacts.select && window.ContactsManager);
  function normPhone(t) {
    let d = String(t || '').replace(/\D/g, '');
    if (d.startsWith('00227')) d = d.slice(5); else if (d.startsWith('227') && d.length > 8) d = d.slice(3);
    return d.length > 8 ? d.slice(-8) : d;
  }
  NZ.kit.normPhone = normPhone;
  NZ.kit.pickContact = async function () {
    try {
      const r = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!r || !r.length) return null;
      const c = r[0];
      const phones = (c.tel || []).map(normPhone);
      return { name: ((c.name && c.name[0]) || '').replace(/\s+/g, ' ').trim(), phone: phones.find((p) => p.length === 8) || phones[0] || '' };
    } catch (e) { return null; }
  };

  /* une photo plein écran (carte d'identité, photo de la discussion) */
  NZ.kit.viewPhoto = function (src, title) {
    U.openOverlay(html`<h2>${title || 'Photo'}</h2><div class="pview"><img src="${src}" alt="${title || 'Photo'}"></div>
      <div style="margin-top:14px">${U.btn({ label: 'Fermer', kind: 'ghost', full: true, act: 'overlay-close' })}</div>`, { focus: false });
  };
})((window.NZ = window.NZ || {}));
