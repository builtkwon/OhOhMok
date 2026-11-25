// Team-mode E2E: 4 browsers, needs network (public PeerJS broker). Run: npm run test:team
import { chromium } from 'playwright';
const url = new URL('../index.html', import.meta.url).href;
const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
const T0 = Date.now(), LOG = []; // peer/migration trace, printed only on failure
const ok = (n, c) => { console.log(c ? 'PASS' : 'FAIL', n); if (!c) process.exitCode = 1; };
// photo: install a stub Profile that the real profile.js cannot replace (docs/profile-stones.md §6.1)
const mk = async (name, rule, photo) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  if (photo !== undefined) await ctx.addInitScript(src => {
    let fn = null; window.__ph = { src, hide: false, stones: { 1: null, 2: null }, set(v, h = false) { this.src = v; this.hide = h; fn && fn(); } };
    const stub = { photo: () => __ph.src, hideOthers: () => __ph.hide, onChange: f => { fn = f; }, setStone: (c, s) => { __ph.stones[c] = s; },
      name: () => null, signedIn: () => false, hasUpload: () => false, renderButton: () => Promise.resolve() }; // rest of §6.1 that app.js calls
    Object.defineProperty(window, 'Profile', { get: () => stub, set: () => {}, configurable: true }); // keep the stub when the real profile.js assigns window.Profile
  }, photo);
  const p = await ctx.newPage(); p.ctx = ctx; p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.text().startsWith('[tm]')) LOG.push(`${((Date.now() - T0) / 1000).toFixed(1)}s ${name} ${m.text().slice(5)}`); });
  await p.goto(url);
  await p.evaluate(() => { // trace Peer events and migration steps (diagnostics only)
    const P0 = window.Peer, L = (...a) => console.log('[tm]', ...a);
    window.Peer = function (id, o) { const x = new P0(id, o); x.on('open', i => L('open', i)); x.on('error', e => L('error', id || 'guest', e.type)); return x; };
    const step = window.tmMigrateStep; window.tmMigrateStep = () => { if (TM && TM.migr && !TM.busy) L('step cand=' + (TeamLogic.successor(TM.players, TM.hostId, Math.floor((Date.now() - TM.migr.since) / TM_PICK_MS)) || {}).name); step(); };
    const tk = window.tmTakeover; window.tmTakeover = () => { L('takeover'); tk(); };
  });
  await p.click('#mode-overlay .mode-card >> nth=1'); await p.click(`#rule-overlay .mode-card >> nth=${rule === 'b' ? 1 : 0}`); await p.fill('#team-name', name); return p;
};
const join = async (p, code) => { await p.fill('#team-code', code); await p.evaluate(() => teamJoin()); await p.waitForFunction(() => TM && TM.joined, null, { timeout: 20000 }); };
const players = (p) => p.evaluate(() => TM.players.map(x => `${x.name}:${x.team}:${x.online ? 1 : 0}`).join(','));
const W = { timeout: 25000 };
const H = await mk('Host'), A = await mk('Ann'), B = await mk('Bob'), C = await mk('Cat');
try {
  await H.evaluate(() => teamCreate(1)); await H.waitForFunction(() => TM && TM.joined, null, W);
  const code = await H.evaluate(() => TM.code); ok('code ' + code, /^[A-Z2-9]{6}$/.test(code));
  ok('host on black team', (await players(H)) === 'Host:1:1');
  ok('start disabled with one team', await H.evaluate(() => document.getElementById('team-start').disabled));
  await join(A, code); await join(B, code);
  await H.waitForFunction(() => TM.players.length === 3, null, W);
  ok('3/4 shown', (await H.textContent('#team-count')) === '3/4' && (await B.textContent('#team-count')) === '3/4');
  ok('auto-balance Host+Bob vs Ann', (await players(H)) === 'Host:1:1,Ann:2:1,Bob:1:1');
  ok('guest has no start button', await A.evaluate(() => getComputedStyle(document.getElementById('team-start')).display === 'none'));
  ok('start enabled at 3/4', await H.evaluate(() => !document.getElementById('team-start').disabled));
  // 3:1 allowed: Ann -> black makes 3:0 (start blocked), Cat joins white
  await A.evaluate(() => teamPick(1)); await H.waitForFunction(() => TM.players[1].team === 1, null, W);
  ok('3:0 cannot start', await H.evaluate(() => document.getElementById('team-start').disabled));
  await join(C, code); await H.waitForFunction(() => TM.players.length === 4, null, W);
  ok('4/4 + 3:1 layout', (await players(H)) === 'Host:1:1,Ann:1:1,Bob:1:1,Cat:2:1' && (await H.textContent('#team-count')) === '4/4');
  await C.evaluate(() => teamPick(1)); await C.waitForTimeout(800);
  ok('full team (3) rejects 4th', (await players(H)).endsWith('Cat:2:1'));
  const late = await mk('Late'); await late.fill('#team-code', code); await late.evaluate(() => teamJoin());
  await late.waitForFunction(() => document.getElementById('team-status').textContent.includes('가득'), null, W); ok('5th player rejected', true);
  await late.ctx.close();
  await H.evaluate(() => teamStart());
  for (const p of [H, A, B, C]) await p.waitForFunction(() => TM.started && !document.getElementById('team-overlay').classList.contains('show'), null, W);
  ok('all started, lobby closed', true);
  // rotation: black team Host, Ann, Bob alternate; white = Cat
  const mv = async (r, c) => { const who = [H, A, B, C]; for (const p of who) if (!p.isClosed() && await p.evaluate(() => tmMyTurn())) { await p.evaluate(([r, c]) => handleClick(r, c), [r, c]); return p; } throw new Error('nobody can move'); };
  const order = [];
  for (let i = 0; i < 6; i++) { const p = await mv(7 + (i % 2 ? 1 : 0), i); order.push(await p.evaluate(() => TM.name)); await H.waitForFunction(n => board.flat().filter(Boolean).length === n, i + 1, W); }
  ok('rotation ' + order, order.join() === 'Host,Cat,Ann,Cat,Bob,Cat');
  ok('moves synced', await C.evaluate(() => board.flat().filter(Boolean).length === 6));
  // out-of-turn / invalid moves ignored
  await C.evaluate(() => tmSend({ type: 'move', row: 0, col: 0 })); await B.evaluate(() => tmSend({ type: 'move', row: 99, col: 0 })); await H.waitForTimeout(800);
  ok('invalid moves ignored', await H.evaluate(() => board[0][0] === 0 && board.flat().filter(Boolean).length === 6));
  // teammate leaves: game continues, offline member skipped
  await B.ctx.close();
  await H.waitForFunction(() => TM.players[2].online === false, null, W);
  ok('game continues after teammate leaves', await H.evaluate(() => !gameOver && TM.started));
  ok('count shows 3/4', (await H.textContent('#conn-text')).includes('3/4'));
  // host leaves -> next online player (Ann) becomes host
  await H.ctx.close();
  await A.waitForFunction(() => TM.role === 'host' && TM.joined, null, { timeout: 40000 }); ok('Ann became host', true);
  await C.waitForFunction(() => TM.hostId === TM.players.find(p => p.name === 'Ann').id && !TM.migr, null, { timeout: 40000 }); ok('Cat reconnected to new host', true);
  ok('state preserved after migration', await C.evaluate(() => board.flat().filter(Boolean).length === 6 && TM.started));
  // new host can still run the game: whoever is to move plays
  const p2 = await mv(10, 10); await A.waitForFunction(() => board[10][10] !== 0, null, W); ok('moves work under new host', true);
  // white team (Cat only) leaves: 30s countdown (also right after a takeover), then black wins
  await C.ctx.close();
  await A.waitForFunction(() => /초 후 패배/.test(document.getElementById('team-banner').textContent), null, W); ok('countdown shown', true);
  ok('wipe grace is 30s', /(2[5-9]|30)초 후 패배/.test(await A.textContent('#team-banner')));
  await A.waitForFunction(() => gameOver && TM.result && TM.result.winner === 1, null, { timeout: 45000 }); ok('wiped team loses', true);
  ok('win overlay names team', await A.waitForFunction(() => document.getElementById('modal-winner').textContent.includes('흑팀 승리'), null, W).then(() => true));
  ok('no page errors', A.errs.length + H.errs.length + B.errs.length + C.errs.length === 0);
  // 1:1 blitz room (5s): host picks it, guest gets the rule; nobody moves -> black loses on time
  const X = await mk('Xa', 'b'), Y = await mk('Yu');
  await X.evaluate(() => teamCreate(1)); await X.waitForFunction(() => TM && TM.joined, null, W);
  await join(Y, await X.evaluate(() => TM.code)); await X.waitForFunction(() => TM.players.length === 2, null, W);
  ok('1:1 room can start', await X.evaluate(() => !document.getElementById('team-start').disabled));
  ok('guest sees room rule', (await Y.textContent('#team-rule')) === '속기전 · 한 수 5초');
  await X.evaluate(() => teamStart()); await Y.waitForFunction(() => TM.started && CLK, null, W);
  ok('guest shows blitz clock', /⚡/.test(await Y.textContent('#clock-1')));
  await Y.waitForFunction(() => gameOver && TM.result && TM.result.winner === 2 && TM.result.reason === 'time', null, { timeout: 15000 }); ok('blitz timeout: black loses', true);
  ok('loser sees time-out text', await X.waitForFunction(() => document.getElementById('modal-sub').textContent === '시간 초과로 졌습니다.', null, W).then(() => true));
  ok('no page errors (blitz)', X.errs.length + Y.errs.length === 0);
  // draw / resign votes (docs/draw-resign.md §4): 2:2 room, black = Va (host) + Zu, white = Wo + Xe
  const V = await mk('Va'), Wo = await mk('Wo'), Zu = await mk('Zu'), Xe = await mk('Xe');
  for (const p of [V, Wo, Zu, Xe]) p.on('dialog', d => d.accept()); // resign confirm
  await V.evaluate(() => teamCreate(1)); await V.waitForFunction(() => TM && TM.joined, null, W);
  const vc = await V.evaluate(() => TM.code); await join(Wo, vc); await join(Zu, vc); await join(Xe, vc);
  await V.waitForFunction(() => TM.players.length === 4, null, W);
  ok('vote room 2:2', (await players(V)) === 'Va:1:1,Wo:2:1,Zu:1:1,Xe:2:1');
  const cnt = (p, s) => p.waitForFunction(s => document.getElementById('vote-text').textContent.includes('동의 ' + s), s, W).then(() => true, () => false);
  const start = async () => { await V.evaluate(() => teamStart()); for (const p of [V, Wo, Zu, Xe]) await p.waitForFunction(() => TM.started && !gameOver && !document.getElementById('team-overlay').classList.contains('show'), null, W); };
  const asked = (p) => p.waitForFunction(() => !document.getElementById('vote-box').hidden && !document.getElementById('vote-btns').hidden, null, W).then(() => true, () => false);
  const waiting = (p) => p.evaluate(() => !document.getElementById('vote-box').hidden && document.getElementById('vote-btns').hidden);
  const vend = (p, f) => p.waitForFunction(f, null, W).then(() => true, () => false);
  // the cancel note reaches every client (checked at once: it goes away after 4 s)
  const noted = (ps, s) => Promise.all(ps.map(p => p.waitForFunction(s => document.getElementById('vote-note').textContent === s + ' — 게임이 계속됩니다!', s, W).then(() => true, () => false))).then(a => a.every(Boolean));
  await start();
  await Wo.evaluate(() => tmSend({ type: 'vote-start', kind: 'draw' })); await V.waitForTimeout(800);
  ok('draw offer off-turn ignored', await V.evaluate(() => !TM.vh && !TM.offers.draw[TM.players[1].id]));
  ok('draw usable only for the team to move (always shown)', await Zu.evaluate(() => !document.getElementById('draw-btn').disabled) && await Wo.evaluate(() => { const d = document.getElementById('draw-btn'); return !d.hidden && d.disabled && d.title === '내 차례에 제안할 수 있습니다'; }));
  // 1) draw passes: Zu offers -> Va, Wo, Xe asked at the same time; count 1/4 -> 2/4 -> 3/4 for everyone
  await Zu.evaluate(() => offerDraw());
  ok('draw: everyone else asked at once', await asked(V) && await asked(Wo) && await asked(Xe) && await waiting(Zu));
  ok('draw: 동의 1/4 for all', await cnt(V, '1/4') && await cnt(Wo, '1/4') && await cnt(Zu, '1/4') && await cnt(Xe, '1/4'));
  await V.click('#vote-btns .btn >> nth=0');
  ok('draw: 동의 2/4, Va has no buttons now', await cnt(Zu, '2/4') && await cnt(Xe, '2/4') && await vend(V, () => document.getElementById('vote-btns').hidden && !gameOver));
  await Xe.click('#vote-btns .btn >> nth=0');
  ok('draw: 동의 3/4, still waiting for Wo', await cnt(Zu, '3/4') && await asked(Wo) && await V.evaluate(() => !gameOver));
  await Wo.click('#vote-btns .btn >> nth=0');
  for (const p of [V, Wo, Zu, Xe]) ok('draw agreed on ' + await p.evaluate(() => TM.name), await vend(p, () => gameOver && TM.result.draw && TM.result.reason === 'agreed' && document.getElementById('modal-sub').textContent.includes('합의 무승부') && document.getElementById('vote-box').hidden));
  await V.evaluate(() => tmRematch()); await V.waitForTimeout(500); await start();
  ok('offers reset each game', await V.evaluate(() => JSON.stringify(TM.offers) === '{"draw":{}}'));
  // 2) draw refused by the other team
  await V.evaluate(() => offerDraw()); await asked(Zu); await asked(Xe); await asked(Wo); await Wo.click('#vote-btns .btn >> nth=1'); // one refusal is enough
  ok('refusal note (who refused) on every client', await noted([V, Wo, Zu, Xe], 'Wo님이 무승부 제안을 거절했습니다'));
  ok('draw refused: cancelled, game goes on', await vend(V, () => !TM.vh && !gameOver && document.getElementById('vote-box').hidden) && await vend(Zu, () => document.getElementById('vote-box').hidden && !gameOver));
  // 3) timeout (shortened) cancels; Va's 2 offers are then used up
  await V.evaluate(() => { TM_VOTE_MS = 1500; offerDraw(); });
  ok('vote shown to guests', await asked(Zu));
  ok('timeout cancels the vote', await vend(V, () => !TM.vh && !gameOver) && await vend(Zu, () => document.getElementById('vote-box').hidden));
  ok('timeout note on every client', await noted([V, Wo, Zu, Xe], '응답이 없어 무승부 제안이 취소되었습니다'));
  ok('2 draw offers per player: button stays, disabled with a reason; resign not limited', await V.evaluate(() => { TM_VOTE_MS = 20000; tmHostVoteStart(TM.me, 'draw'); const d = document.getElementById('draw-btn'), r = document.getElementById('resign-btn');
    return !TM.vh && TM.offers.draw[TM.me] === 2 && !d.hidden && d.disabled && d.title === '이번 판의 무승부 제안 기회를 모두 썼습니다' && !r.hidden && !r.disabled; }));
  // 4) resign has no limit: Zu resigns twice, Va refuses both; the 3rd one Va agrees -> white wins by resignation
  for (let i = 0; i < 2; i++) { await Zu.evaluate(() => resign()); await asked(V); await V.click('#vote-btns .btn >> nth=1'); ok('resign refused #' + (i + 1) + ', note on every client', await noted([V, Wo, Zu, Xe], 'Va님이 항복을 거절했습니다')); }
  await Zu.evaluate(() => resign());
  ok('resign: own team asked only, 동의 1/2', await asked(V) && await cnt(V, '1/2') && await cnt(Wo, '1/2') && await Wo.evaluate(() => document.getElementById('vote-btns').hidden));
  await V.click('#vote-btns .btn >> nth=0');
  ok('resign: white wins', await vend(Wo, () => gameOver && TM.result.winner === 2 && TM.result.reason === 'resign' && document.getElementById('modal-sub').textContent === '상대 팀이 항복했습니다!'));
  ok('resign: loser text', await vend(Zu, () => document.getElementById('modal-sub').textContent === '우리 팀이 항복했습니다.' && scores[2] === 1));
  // 5) alone on the team (Xe gone, offline players are not asked): confirm only
  await V.evaluate(() => tmRematch()); await V.waitForTimeout(500); await start();
  await Xe.ctx.close(); await V.waitForFunction(() => TM.players.find(p => p.name === 'Xe').online === false, null, W);
  await Wo.evaluate(() => resign());
  ok('team of one resigns at once, not counted', await vend(V, () => gameOver && TM.result.winner === 1 && TM.result.reason === 'resign' && !('resign' in TM.offers)));
  // 6) a draw needs the other team: opponent drops mid-vote -> cancelled; nobody of it online at start -> refused
  await V.evaluate(() => tmRematch()); await V.waitForTimeout(500);
  await V.evaluate(() => teamStart()); for (const p of [V, Wo, Zu]) await p.waitForFunction(() => TM.started && !gameOver, null, W);
  await V.evaluate(() => offerDraw()); ok('draw vote open', await asked(Wo) && await asked(Zu));
  await Zu.click('#vote-btns .btn >> nth=0'); await cnt(V, '2/3');
  await Wo.ctx.close(); await V.waitForFunction(() => !TM.players.find(p => p.name === 'Wo').online, null, W);
  ok('opponent drops mid-vote: cancelled, no draw', await vend(V, () => !TM.vh && !gameOver && !TM.result) && await vend(Zu, () => document.getElementById('vote-box').hidden && !gameOver));
  ok('left note on the remaining clients', await noted([V, Zu], '참가자가 나가 무승부 제안이 취소되었습니다'));
  await Zu.evaluate(() => offerDraw());
  ok('opponent offline at start: refused with a message', await vend(Zu, () => document.getElementById('turn-text').textContent.includes('접속한 사람이 없어')));
  ok('opponent offline at start: no vote, not counted', await V.evaluate(() => !TM.vh && !gameOver && !TM.offers.draw[TM.players.find(p => p.name === 'Zu').id]));
  ok('no page errors (vote)', V.errs.length + Wo.errs.length + Zu.errs.length + Xe.errs.length === 0);
  for (const p of [V, Wo, Zu]) await p.ctx.close();
  // photo stones: team rep = first player of each team; relay, late joiner, validation, host turn-off, hide, leave
  const img = (c) => 'data:image/png;base64,' + c.repeat(8);
  const st = (p) => p.evaluate(() => JSON.stringify(__ph.stones));
  const want = (p, s) => p.waitForFunction(s => JSON.stringify(__ph.stones) === s, JSON.stringify(s), W);
  const P = await mk('Pa', 'n', img('A')), Q = await mk('Qu', 'n', img('B')), R = await mk('Ro', 'n', img('C'));
  await P.evaluate(() => teamCreate(1)); await P.waitForFunction(() => TM && TM.joined, null, W);
  const pc = await P.evaluate(() => TM.code);
  await join(Q, pc); await want(P, { 1: img('A'), 2: img('B') }); await want(Q, { 1: img('A'), 2: img('B') }); ok('avatars relayed both ways', true);
  ok('host lobby shows turn-off button as soon as the photo arrives', await P.waitForFunction(() => document.querySelectorAll('#tl2 .av-off').length === 1, null, W).then(() => true, () => false));
  await join(R, pc); await want(R, { 1: img('A'), 2: img('B') }); ok('late joiner gets known avatars, 2nd black player is not rep', true);
  ok('avatar not in snap', await R.evaluate(() => !JSON.stringify(TM.players).includes('base64')));
  await Q.evaluate(s => __ph.set(s), img('D')); await want(R, { 1: img('A'), 2: img('D') }); ok('photo change relayed', true);
  await Q.evaluate(() => tmSend({ type: 'avatar', src: 'javascript:alert(1)' })); await Q.evaluate(() => tmSend({ type: 'avatar', src: 'data:image/png;base64,A");x:url(y' }));
  await R.waitForTimeout(800); ok('invalid avatar ignored', (await st(R)) === JSON.stringify({ 1: img('A'), 2: img('D') }));
  await R.evaluate(() => { window.__n = 0; TM.conn.on('data', d => { if (d && d.type === 'avatar') __n++; }); });
  await P.evaluate(() => { for (let i = 0; i < 4; i++) __ph.set(__ph.src, !__ph.hide); }); await Q.evaluate(() => { for (let i = 0; i < 4; i++) __ph.set(__ph.src, !__ph.hide); });
  await R.waitForTimeout(800); ok('hide toggles do not re-send own photo', (await R.evaluate(() => __n)) === 0);
  await Q.evaluate(() => { for (let k = 0; k < 30; k++) tmSend({ type: 'avatar', src: 'data:image/png;base64,' + (k % 2 ? 'X' : 'Y').repeat(4000) }); });
  await R.waitForTimeout(1500); const nf = await R.evaluate(() => __n); ok('avatar flood rate-limited (' + nf + ' relays)', nf >= 1 && nf <= 2);
  ok('host sees turn-off buttons for others only', await P.evaluate(() => document.querySelectorAll('#tl2 .av-off').length === 1 && document.querySelectorAll('#tl1 .av-off').length === 1 && !document.querySelector('li.me .av-off')));
  await P.click('#tl2 .av-off'); await want(R, { 1: img('A'), 2: null }); ok('host turn-off reaches guests', true);
  await Q.evaluate(s => __ph.set(s), img('E')); await R.waitForTimeout(800);
  ok('turned-off player stays off', (await st(R)) === JSON.stringify({ 1: img('A'), 2: null }) && (await st(P)).endsWith('null}'));
  ok('own photo still shows for turned-off player', (await st(Q)).includes(img('E')));
  await R.evaluate(() => __ph.set(__ph.src, true)); await want(R, { 1: null, 2: null }); ok('hideOthers hides others', true);
  await Q.evaluate(() => teamPick(1)); await want(Q, { 1: img('A'), 2: null }); ok('rep follows team change', true);
  await R.evaluate(() => tmLeave()); ok('departed player photo dropped', await P.waitForFunction(id => TM.players.length === 2 && !(id in TM.av), await R.evaluate(() => tmSid()), W).then(() => true, () => false));
  await P.evaluate(() => tmLeave()); ok('leaving clears stones', (await st(P)) === JSON.stringify({ 1: null, 2: null }));
  { const e = [P, Q, R].flatMap(x => x.errs); if (e.length) console.log('avatar errs', e); ok('no page errors (avatar)', P.errs.length + Q.errs.length + R.errs.length === 0); }
  // takeover that cannot open the room (stub Peer, no network): back to guest, and no takeover while the broker is unreachable
  const S = await mk('Solo');
  const tk = (mode) => S.evaluate(m => {
    if (TM) tmLeave();
    window.Peer = function (id) {
      const h = {}, f = { open: false, on(e, cb) { (h[e] = h[e] || []).push(cb); return f; }, connect() { return { on() {} }; }, destroy() {}, reconnect() {} };
      if (id && m === 'err') setTimeout(() => (h.error || []).forEach(cb => cb({ type: 'network' })), 500);
      return f;
    };
    TM = tmBase('guest', 'ABCDEF'); TM.joined = true; TM.hostId = 'oldhost';
    TM.players = [{ id: 'oldhost', name: 'o', team: 1, online: true }, { id: TM.me, name: 'me', team: 2, online: true }];
    tmTakeover();
  }, mode).then(() => S.waitForFunction(() => TM.role === 'guest' && !!TM.migr && TM.hostId === 'oldhost', null, W)).then(() => true, () => false);
  ok('takeover: host peer error -> back to guest', await tk('err'));
  ok('takeover: host peer never opens -> back to guest', await tk('hang'));
  await S.waitForTimeout(7000); ok('no takeover while broker unreachable', await S.evaluate(() => TM.role === 'guest' && !TM.takeover));
  await S.evaluate(() => tmLeave()); ok('no page errors (takeover stub)', S.errs.length === 0);
} catch (e) {
  console.error(e); process.exitCode = 1;
  for (const p of [H, A, B, C]) console.log(p.isClosed() ? 'closed' : await p.evaluate(() => TM ? JSON.stringify({ name: TM.name, me: TM.me, role: TM.role, joined: TM.joined, migr: TM.migr, busy: TM.busy, peer: !!TM.peer, conn: !!TM.conn, hostId: TM.hostId, p: TM.players.map(x => x.name + x.online) }) : 'TM null').catch(e => String(e)));
  console.log(LOG.join('\n'));
}
await b.close();
