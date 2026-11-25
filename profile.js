// Profile photo stones: upload/Google photo, matting (MediaPipe, lazy), --stone-*-img. Design: docs/profile-stones.md
// Pure helpers are under Profile._ and tested in tests/profile.test.js.
(function (root) {
  const KEY = 'ohohmok-profile', HIDE = 'ohohmok-hide-avatars', MAX = 44000, SIZE = 128, BUDGET = 3000;
  const CLIENT_ID = '923238134204-skkpl84vtimf60a8s1sl00562tqlr7b9.apps.googleusercontent.com';
  const GIS = 'https://accounts.google.com/gsi/client', MP = 'vendor/mediapipe/';
  const AVATAR = [/^https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_\-/=]+$/, /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/];

  // ---- pure ----
  // shortcut: local copy of the §5 check until room-dev's TeamLogic.validAvatar is merged; integrator drops the fallback then
  const validAvatar = (s) => (typeof TeamLogic !== 'undefined' && TeamLogic.validAvatar) ? TeamLogic.validAvatar(s)
    : typeof s === 'string' && s.length <= MAX && AVATAR.some(r => r.test(s));
  const stoneValue = (s) => validAvatar(s) ? 'url("' + s + '")' : null;
  // payload only, signature not checked: used for display (photo, name), never for permissions
  function decodeJwt(t) {
    try {
      const s = String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(s + '='.repeat(-s.length & 3));
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    } catch (e) { return null; }
  }
  const bigPicture = (u) => u.replace(/=s96-c$/, '=s128-c');
  function fromClaims(p) {
    if (!p || typeof p.sub !== 'string' || !p.sub) return null;
    const pic = typeof p.picture === 'string' ? bigPicture(p.picture) : null;
    return { name: typeof p.name === 'string' ? p.name : null, google: { sub: p.sub, picture: validAvatar(pic) ? pic : null } };
  }
  function firstFit(tries, encode) {
    for (const x of tries) { const v = encode(x); if (typeof v === 'string' && v.length <= MAX) return v; }
    return null;
  }
  function readStore(raw) {
    let o = null;
    try { o = JSON.parse(raw); } catch (e) {}
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
    const g = o.google, m = o.matted;
    return {
      name: typeof o.name === 'string' ? o.name : null,
      google: g && typeof g.sub === 'string' ? { sub: g.sub, picture: validAvatar(g.picture) ? g.picture : null } : null,
      upload: validAvatar(o.upload) ? o.upload : null,
      matted: m && typeof m.from === 'string' && validAvatar(m.png) ? { from: m.from, png: m.png } : null,
    };
  }
  const sourceOf = (s) => s.upload || (s.google && s.google.picture) || null;
  function photoOf(s) {
    const src = sourceOf(s);
    return s.matted && src && s.matted.from === src ? s.matted.png : src;
  }
  // alpha = person confidence. Under 5% person on average the model found nobody: keep the plain photo.
  function applyMask(rgba, mask) {
    let sum = 0;
    for (let i = 0; i < mask.length; i++) sum += mask[i];
    if (sum / mask.length < 0.05) return null;
    for (let i = 0; i < mask.length; i++) rgba[i * 4 + 3] = mask[i] * 255;
    return rgba;
  }

  // ---- browser ----
  let S = null, gis = null, seg = null;
  const listeners = [];
  const store = () => S || (S = readStore(get(KEY)));
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(patch) {
    Object.assign(store(), patch);
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} // full/blocked storage: keep it for this tab only
    listeners.forEach(f => f());
  }
  const loadScript = (src) => new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = no;
    document.head.appendChild(s);
  });
  const loadImg = (src) => new Promise((ok, no) => {
    const i = new Image();
    i.crossOrigin = 'anonymous'; // Google photo: without CORS the canvas is tainted and matting falls back
    i.onload = () => ok(i); i.onerror = no; i.src = src;
  });
  function square(img, size) {
    const c = document.createElement('canvas'), w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h);
    c.width = c.height = size;
    c.getContext('2d').drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
    return c;
  }
  const segmenter = () => seg || (seg = loadScript(MP + 'vision_bundle.js')
    .then(() => root.Vision.FilesetResolver.forVisionTasks(new URL(MP, document.baseURI).href.replace(/\/$/, '')))
    .then(fs => root.Vision.ImageSegmenter.createFromOptions(fs, {
      baseOptions: { modelAssetPath: MP + 'selfie_segmenter.tflite' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
    }))
    .catch(e => { seg = null; throw e; }));
  // 128px PNG with the background cut out, or null (no person, tainted canvas, load error)
  async function matte(src) {
    const c = square(await loadImg(src), SIZE), ctx = c.getContext('2d');
    const px = ctx.getImageData(0, 0, SIZE, SIZE); // throws on a tainted canvas
    const r = (await segmenter()).segment(c);
    const mask = r.confidenceMasks[0].getAsFloat32Array();
    r.close();
    if (mask.length !== SIZE * SIZE || !applyMask(px.data, mask)) return null;
    ctx.putImageData(px, 0, 0);
    return firstFit([128, 112, 96, 80, 64], n => {
      const d = document.createElement('canvas');
      d.width = d.height = n;
      d.getContext('2d').drawImage(c, 0, 0, n, n);
      return d.toDataURL('image/png');
    });
  }
  // 3 s budget; the segmenter keeps loading after a timeout, so the next photo is faster
  const budgeted = (src) => Promise.race([matte(src), new Promise(ok => setTimeout(ok, BUDGET, null))]).catch(() => null);
  async function refreshMatte() {
    const src = sourceOf(store());
    if (!src || (S.matted && S.matted.from === src)) return;
    const png = await budgeted(src);
    if (png && sourceOf(store()) === src) save({ matted: { from: src, png } });
  }
  const fail = (m) => { throw new Error(m); };

  async function upload(file) {
    if (!file || !/^image\//.test(file.type)) fail('이미지 파일을 골라 주세요');
    let img;
    try {
      // data: not blob: (CSP img-src allows only 'self' data:)
      img = await loadImg(await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); }));
    } catch (e) { fail('사진을 읽지 못했습니다. 다른 사진을 골라 주세요'); }
    const c = square(img, SIZE);
    const jpeg = firstFit([0.8, 0.6, 0.4], q => c.toDataURL('image/jpeg', q));
    if (!jpeg || !validAvatar(jpeg)) fail('사진이 너무 큽니다. 다른 사진을 골라 주세요');
    const png = await budgeted(jpeg);
    save({ upload: jpeg, matted: png ? { from: jpeg, png } : null });
  }
  function clearUpload() { save({ upload: null, matted: null }); refreshMatte(); }

  function login() {
    gis = gis || loadScript(GIS).catch(() => { gis = null; fail('Google 로그인을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요'); });
    return gis.then(() => new Promise((ok, no) => {
      const id = root.google.accounts.id;
      id.initialize({
        client_id: CLIENT_ID, use_fedcm_for_prompt: true,
        callback: (r) => {
          const c = fromClaims(decodeJwt(r && r.credential));
          if (!c) return no(new Error('Google 로그인 정보를 읽지 못했습니다'));
          save(c);
          refreshMatte();
          ok();
        },
      });
      id.prompt(n => { if ((n.isNotDisplayed && n.isNotDisplayed()) || (n.isSkippedMoment && n.isSkippedMoment())) no(new Error('Google 로그인 창이 열리지 않았습니다. 잠시 후 다시 시도해 주세요')); });
    }));
  }
  // Google name goes too (it came from Google); the upload stays until clearUpload
  function logout() {
    const s = store(), pic = s.google && s.google.picture;
    save({ google: null, name: null, matted: s.matted && s.matted.from === pic ? null : s.matted });
  }

  function setHideOthers(on) {
    try { on ? localStorage.setItem(HIDE, 'true') : localStorage.removeItem(HIDE); } catch (e) {}
    listeners.forEach(f => f());
  }
  function setStone(color, src) {
    const v = stoneValue(src), p = color === 1 ? '--stone-black-img' : '--stone-white-img', st = document.documentElement.style;
    v ? st.setProperty(p, v) : st.removeProperty(p);
  }

  const api = {
    photo: () => photoOf(store()), name: () => store().name, signedIn: () => !!store().google,
    login, logout, upload, clearUpload,
    hideOthers: () => get(HIDE) === 'true', setHideOthers,
    onChange: (fn) => { listeners.push(fn); }, setStone,
    _: { validAvatar, stoneValue, decodeJwt, bigPicture, fromClaims, firstFit, readStore, sourceOf, photoOf, applyMask },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Profile = api;
})(typeof window !== 'undefined' ? window : globalThis);
