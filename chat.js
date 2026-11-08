/* Nazari Express — discussion entre le client et l'équipe.
   Les messages et les photos disparaissent 24 h après leur envoi (la base les efface ; ici on ne les montre plus dès qu'ils sont périmés). */
(function (NZ) {
  'use strict';
  const U = NZ.ui, VO = NZ.voice, K = NZ.kit;
  const { html, raw, str, ic, il, fwhen } = U;
  const $ = (s) => document.querySelector(s);
  const SEEN = 'nz.chat.seen';

  const PHOTOS = {};                       // numéro du message -> photo (gardée en mémoire seulement)
  let CH = { staff: false, cid: '', order: '', items: [], last: 0, photo: '', sending: false, ctx: null };

  const alive = (m) => !m.exp || Date.parse(m.exp) > Date.now();
  const rightSide = (m) => (CH.staff ? m.team : m.mine);

  function bubble(m) {
    const right = rightSide(m);
    const who = m.team && (!right || CH.staff) ? (m.by || NZ.company().name) : '';
    const ph = m.photo ? (PHOTOS[m.id]
      ? html`<img class="cph" src="${PHOTOS[m.id]}" alt="Photo" data-act="chat-zoom" data-id="${m.id}">`
      : html`<button type="button" class="phbtn" data-act="chat-photo" data-id="${m.id}">${il('photo', 32)}Voir la photo</button>`) : '';
    return html`<div class="bub${right ? ' me' : ''}" data-mid="${m.id}">${who && !right ? html`<span class="who">${who}</span>` : ''}${m.order_code ? html`<span class="ord">${m.order_code}</span>` : ''}${ph}${m.text ? html`<span>${m.text}</span>` : ''}<span class="tm">${fwhen(m.at)}</span></div>`;
  }
  function quick() {
    const q = (icon, t) => html`<button type="button" data-act="chat-quick" data-t="${t}">${il(icon, 46)}<span>${t}</span></button>`;
    return html`<div class="chat-empty"><div style="text-align:center">${il('chat', 100)}<div style="font-size:21px;font-weight:800;margin:4px 0 2px;color:var(--forest)">Écrivez-nous ici</div><div style="color:var(--cl-soft);font-weight:600;font-size:16px">Nous répondons dès que possible.</div></div>
      <div class="quick">${q('parcel', 'Où est mon colis ?')}${q('phone', 'Merci de me rappeler')}${q('error', 'J\'ai un problème')}</div></div>`;
  }
  function listHtml() {
    CH.items = CH.items.filter(alive);
    const note = html`<div class="chat-note">${il('clock', 30)}<span>${CH.staff ? 'Les messages et les photos disparaissent après 24 heures.' : 'Les messages et les photos disparaissent après 24 heures.'}</span></div>`;
    if (!CH.items.length) return html`${note}${CH.staff ? html`<p class="muted center" style="padding:30px 0">Aucun message.</p>` : quick()}`;
    return html`${note}${CH.items.map(bubble)}`;
  }
  function paintList(force) {
    const box = document.getElementById('chat-list');
    if (!box) return;
    const nearBottom = (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 140;
    box.innerHTML = str(listHtml());
    if (force || nearBottom) window.scrollTo(0, document.body.scrollHeight);
    pullPhotos();
  }
  /* les trois dernières photos se chargent toutes seules ; les autres au toucher */
  let pulling = false;
  async function pullPhotos() {
    if (pulling) return;
    const need = CH.items.filter((m) => m.photo && !PHOTOS[m.id]).slice(-3);
    if (!need.length) return;
    pulling = true;
    try {
      for (const m of need) { await loadPhoto(m.id, true); }
    } finally { pulling = false; }
  }
  async function loadPhoto(id, quiet) {
    try {
      const r = await NZ.api('chat.photo', { id });
      PHOTOS[id] = r.img;
      const keep = window.scrollY;
      const el = document.querySelector('.bub[data-mid="' + id + '"]');
      const m = CH.items.find((x) => x.id === id);
      if (el && m) { el.outerHTML = str(bubble(m)); window.scrollTo(0, keep); }
    } catch (e) { if (!quiet) U.toast(e.message, 'err'); }
  }

  function composeHtml() {
    return html`<div class="compose${CH.staff ? '' : ''}" id="compose">
      <div class="pv" id="chat-pv" hidden><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><span>Photo prête</span><button type="button" class="icon-btn" data-act="chat-unphoto" aria-label="Enlever la photo">${ic('x', 22)}</button></div>
      <label class="cb" aria-label="Prendre une photo"><input type="file" accept="image/*" capture="environment" hidden data-photo="chat">${ic('camera', 26)}</label>
      <label class="cb" aria-label="Choisir une photo"><input type="file" accept="image/*" hidden data-photo="chat">${ic('image', 26)}</label>
      <textarea id="chat-text" rows="1" maxlength="1000" placeholder="Écrivez ici…" aria-label="Votre message"></textarea>
      <button type="button" class="cb send" data-act="chat-send" aria-label="Envoyer">${ic('send', 26)}</button></div>`;
  }
  function autosize() { const t = $('#chat-text'); if (t) { t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px'; } }
  document.addEventListener('input', (e) => { if (e.target && e.target.id === 'chat-text') autosize(); });

  function add(items) {
    const have = new Set(CH.items.map((m) => m.id));
    let fresh = 0;
    (items || []).forEach((m) => { if (!have.has(m.id)) { CH.items.push(m); fresh++; } });
    CH.items.sort((a, b) => a.id - b.id);
    CH.last = CH.items.reduce((x, m) => Math.max(x, m.id), CH.last);
    return fresh;
  }
  function markSeen() {
    if (CH.staff) return;
    const t = CH.items.filter((m) => m.team).reduce((x, m) => Math.max(x, m.id), 0);
    if (t > NZ.store.get(SEEN, 0)) NZ.store.set(SEEN, t);
    NZ.chatUnread = 0; NZ.paintBadges();
  }
  async function pull(first) {
    const r = await NZ.api('chat.list', Object.assign({ after: first ? 0 : CH.last, limit: 100 }, CH.staff ? { client_id: CH.cid } : {}));
    const fresh = add(r.items);
    markSeen();
    return { r, fresh };
  }

  /* ---------- côté client ---------- */
  NZ.route('/chat', async (ctx) => {
    CH = { staff: false, cid: '', order: ctx.query.order || '', items: [], last: 0, photo: '', sending: false, ctx };
    ctx.shell({ title: NZ.company().name, tab: 'chat', cls: 'cl chatpg', skeleton: false });
    ctx.main(html`<div class="chat" id="chat-list"></div>${composeHtml()}`);
    VO.screen(() => {
      const parts = [{ t: 'Discussion avec ' + NZ.company().name + '. Écrivez un message, ou touchez l\'appareil photo pour envoyer une photo.' }];
      const lastTeam = CH.items.filter((m) => m.team && m.text).slice(-1)[0];
      if (lastTeam) parts.push({ t: 'Dernier message de l\'équipe : ' + lastTeam.text, sel: '.bub[data-mid="' + lastTeam.id + '"]' });
      return parts;
    });
    try { await pull(true); } catch (e) { return ctx.fail(e); }
    paintList(true);
    ctx.poll(4000, async () => { const { fresh } = await pull(false); if (fresh) paintList(false); });
  }, { roles: ['client'] });

  /* ---------- côté équipe ---------- */
  const thread = (t) => html`<a class="thread${t.waiting ? ' wait' : ''}" href="#/admin/chat/${t.client_id}"><span class="av">${U.initials(t.name)}</span>
    <span class="tb"><b>${t.name}</b><span>${t.last_team ? 'Vous : ' : ''}${t.last_photo && !t.last_text ? 'Photo' : t.last_text}</span></span>
    <span class="te">${fwhen(t.at)}${t.waiting ? html`<br><span class="dot">!</span>` : ''}</span></a>`;
  NZ.route('/admin/chats', async (ctx) => {
    ctx.shell({ title: 'Discussions', tab: 'chat' });
    const load = async () => {
      const r = await NZ.api('chat.threads', {});
      NZ.chatUnread = r.items.filter((t) => t.waiting).length; NZ.paintBadges();
      NZ.scrollKeep(() => ctx.main(r.items.length ? html`<div class="notice" style="margin-bottom:14px">${ic('clock', 20)}<div>Les messages et les photos disparaissent après 24 heures.</div></div>${r.items.map(thread)}`
        : U.empty('chat', 'Aucune discussion', 'Les messages des clients apparaîtront ici. Ils disparaissent après 24 heures.')));
    };
    try { await load(); } catch (e) { return ctx.fail(e); }
    ctx.poll(8000, load);
  }, { roles: ['admin'] });

  NZ.route('/admin/chat/:cid', async (ctx) => {
    CH = { staff: true, cid: ctx.params.cid, order: '', items: [], last: 0, photo: '', sending: false, ctx };
    ctx.shell({ title: 'Discussion', back: '#/admin/chats', tab: 'chat', cls: 'chatpg' });
    let info;
    try { info = (await pull(true)).r; } catch (e) { return ctx.fail(e); }
    const c = info.client || {};
    ctx.shell({ title: c.name || 'Client', back: '#/admin/chats', tab: 'chat', cls: 'chatpg', skeleton: false,
      right: c.phone ? html`<a class="icon-btn" href="${U.telLink(c.phone)}" aria-label="Appeler">${ic('phone', 22)}</a>` : '' });
    ctx.main(html`<div class="chat" id="chat-list"></div>${composeHtml()}`);
    paintList(true);
    ctx.poll(5000, async () => { const { fresh } = await pull(false); if (fresh) paintList(false); });
  }, { roles: ['admin'] });

  /* ---------- gestes ---------- */
  K.onPhotoChat = (url) => {
    CH.photo = url;
    const pv = $('#chat-pv');
    if (pv) { pv.hidden = false; const im = pv.querySelector('img'); if (im) im.src = url; }
  };
  const prevOnPhoto = () => K.onPhoto;
  (function hook() {
    const base = K.onPhoto;
    K.onPhoto = function (key, url) { if (key === 'chat') return K.onPhotoChat(url); if (base) return base(key, url); return null; };
    /* simple.js se charge avant ce fichier : on garde sa fonction pour les autres photos */
    void prevOnPhoto;
  })();
  NZ.act('chat-unphoto', () => { CH.photo = ''; const pv = $('#chat-pv'); if (pv) pv.hidden = true; });
  NZ.act('chat-photo', (el) => loadPhoto(Number(el.dataset.id), false));
  NZ.act('chat-zoom', (el) => { const src = PHOTOS[Number(el.dataset.id)]; if (src) K.viewPhoto(src, 'Photo'); });

  async function send(text, photo) {
    if (CH.sending) return false;
    if (!text && !photo) return false;
    CH.sending = true;
    const args = { text: text || '' };
    if (photo) args.photo = photo;
    if (CH.order && !CH.staff) args.order_id = CH.order;
    if (CH.staff) args.client_id = CH.cid;
    try {
      const r = await NZ.api('chat.send', args, { timeout: 45000 });
      if (photo) PHOTOS[r.message.id] = photo;
      add([r.message]);
      paintList(true);
      return true;
    } catch (e) {
      U.toast(e.message, 'err'); VO.say(e.message);
      return false;
    } finally { CH.sending = false; }
  }
  NZ.act('chat-send', async (el) => {
    const ta = $('#chat-text');
    const text = ta ? ta.value.trim() : '';
    if (!text && !CH.photo) return;
    el.disabled = true;
    const ok = await send(text, CH.photo);
    el.disabled = false;
    if (ok) {
      if (ta) { ta.value = ''; autosize(); }
      CH.photo = ''; const pv = $('#chat-pv'); if (pv) pv.hidden = true;
    }
  });
  NZ.act('chat-quick', async (el) => { await send(el.dataset.t, ''); });
})((window.NZ = window.NZ || {}));
