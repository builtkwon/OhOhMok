// ─── ROOM SYSTEM ──────────────────────────────────────────────
// ICE: STUN only by default. For strict NAT / mobile networks add a TURN entry below.
const ICE_SERVERS = [
  {urls: 'stun:stun.l.google.com:19302'},
  {urls: 'stun:global.stun.twilio.com:3478'},
  // {urls: 'turn:YOUR_TURN_HOST:443?transport=tcp', username: 'USER', credential: 'PASS'},
];
const PEER_OPTS = {debug: 0, config: {iceServers: ICE_SERVERS}};
const CODE_LEN = 6;


function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  return Array.from(buf, b => chars[b % chars.length]).join('');
}

function errText(err) {
  const t = err && err.type;
  if (t === 'peer-unavailable') return '방을 찾을 수 없습니다. 코드를 확인하세요.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return '서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.';
  if (t === 'webrtc') return '연결 설정에 실패했습니다. 네트워크 환경을 확인하세요.';
  if (err === 'timeout') return '연결 시간이 초과되었습니다.';
  return '연결 오류가 발생했습니다.';
}

function setConnStatus(online, text) {
  const s = document.getElementById('conn-status');
  const d = document.getElementById('conn-dot');
  const t = document.getElementById('conn-text');
  s.style.display = 'flex';
  d.className = 'conn-dot' + (online ? '' : ' offline');
  t.textContent = text || (online ? '연결됨' : '상대방 연결 끊김');
}

// ─── TEAM MODE (up to 4 players, host-authoritative star over PeerJS) ─────────
// Pure rules live in team.js. Host holds the truth and broadcasts a full snapshot on every change.
// If the host leaves, the next online player (join order) re-opens the same room id and everyone rejoins.
// ponytail: player id is public in the snapshot (needed for host migration) - fine for a friends' game, not for strangers.
const TEAM_PREFIX = 'ohohmok-team-';
const TM_HB = 2000, TM_DEAD = 6000, TM_PICK_MS = 8000, TM_TAKEOVER_WIPE_MS = 15000;
let TM = null;

function tmSid() {
  try { let v = sessionStorage.getItem('ohohmok-tid'); if (!v) { v = generateCode() + generateCode(); sessionStorage.setItem('ohohmok-tid', v); } return v; }
  catch (e) { return generateCode() + generateCode(); }
}
function tmBase(role, code) {
  return {role, code, me: tmSid(), name: TeamLogic.cleanName(document.getElementById('team-name').value) || 'Player',
    peer: null, conn: null, conns: {}, seen: {}, wipe: {}, until: {}, players: [], started: false, turn: null, result: null,
    hostId: '', av: {}, stones: '', rule: RULE, lastSeen: Date.now(), hb: null, tick: null, rejoin: null, migr: null, busy: false, joined: false, sig: '', ann: '', endShown: false};
}
const tmMe = () => TM && TM.players.find(p => p.id === TM.me);
const tmMyTeam = () => { const m = tmMe(); return m ? m.team : 1; };
function tmMover() { return TM && TM.started && TM.turn ? TeamLogic.mover(TM.players, TM.turn) : null; }
function tmMyTurn() { const m = tmMover(); return !!m && !gameOver && m.id === TM.me; }
function myTurn() { return gameMode === 'ai' ? currentPlayer === humanPlayer : tmMyTurn(); }
function myStoneColor() { return gameMode === 'ai' ? humanPlayer : tmMyTeam(); }
function tmTurnText() {
  if (!TM || !TM.started) return '팀전 대기 중';
  if (gameOver) return '대국 종료';
  const m = tmMover();
  return m ? `${m.name} 차례 (${currentPlayer === 1 ? '흑' : '백'})${m.id === TM.me ? ' — 나' : ''}` : '팀원 복귀 대기 중';
}
function tmSend(msg) { if (TM && TM.conn && TM.conn.open) { try { TM.conn.send(msg); } catch (e) {} } }
function tmStatus(msg) { document.getElementById('team-status').textContent = msg; }
function tmView(v) {
  document.getElementById('tv-entry').style.display = v === 'entry' ? '' : 'none';
  document.getElementById('tv-lobby').style.display = v === 'lobby' ? '' : 'none';
}

// ── entry / leave ──
function teamEntry() {
  tmLeave();
  tmView('entry'); tmStatus('');
  showOverlay('team-overlay');
}
function teamBack() { tmLeave(); hideOverlay('team-overlay'); showOverlay('rule-overlay'); }
function tmFatal(msg) {
  tmLeave(); hideOverlay('overlay');
  initBoard(); scores = {1: 0, 2: 0}; gameOver = false; updateScores(); updateTurn();
  tmView('entry'); tmStatus(msg);
  if (!document.getElementById('team-overlay').classList.contains('show')) showOverlay('team-overlay');
}
function tmClearLink() {
  if (!TM) return;
  for (const id of Object.keys(TM.conns)) { try { TM.conns[id].close(); } catch (e) {} }
  TM.conns = {};
  if (TM.conn) { const c = TM.conn; TM.conn = null; try { c.close(); } catch (e) {} }
  if (TM.peer) { const p = TM.peer; TM.peer = null; try { p.destroy(); } catch (e) {} }
}
function tmLeave() {
  if (!TM) return;
  const t = TM; tmClearLink(); TM = null;
  clearInterval(t.hb); clearInterval(t.tick); clearInterval(t.rejoin); clearTimeout(t.retry); clearTimeout(t.prune);
  Object.values(t.wipe).forEach(clearTimeout);
  document.getElementById('team-banner').textContent = '';
  document.getElementById('conn-status').style.display = 'none';
  clockStop();
  if (typeof Profile !== 'undefined') { Profile.setStone(1, null); Profile.setStone(2, null); }
}
function copyTeamCode() {
  const el = document.getElementById('team-code-display'), code = TM && TM.code;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => { el.textContent = '복사됨!'; setTimeout(() => { if (TM) el.textContent = TM.code; }, 1200); }).catch(() => {});
}

// ── host side ──
function teamCreate(team) {
  tmLeave();
  TM = tmBase('host', generateCode());
  TM.hostId = TM.me;
  TM.players = [{id: TM.me, name: TM.name, team, online: true}];
  tmHookProfile(); if (TeamLogic.validAvatar(tmPhoto())) TM.av[TM.me] = tmPhoto();
  initBoard(); scores = {1: 0, 2: 0}; gameOver = false; updateScores();
  tmStatus('방 만드는 중...');
  tmOpenHostPeer(true);
}
function tmOpenHostPeer(regen) {
  const p = TM.peer = new Peer(TEAM_PREFIX + TM.code, PEER_OPTS);
  p.on('open', () => { if (TM && TM.peer === p) tmHostReady(); });
  p.on('connection', tmOnConn);
  p.on('disconnected', () => { try { if (TM && TM.peer === p && !p.destroyed) p.reconnect(); } catch (e) {} });
  p.on('error', (err) => {
    if (!TM || TM.peer !== p) return;
    if (err.type === 'unavailable-id') { // regen: new code; takeover: someone else already re-opened the room
      TM.peer = null; try { p.destroy(); } catch (e) {}
      if (TM.takeover) { // back to guest: the other new host will accept us
        TM.takeover = false; TM.role = 'guest'; TM.players = TM.prevPlayers; TM.hostId = TM.prevHost; tmHostLost(); return;
      }
      if (regen) TM.code = generateCode();
      TM.retry = setTimeout(() => { if (TM && !TM.peer) tmOpenHostPeer(regen); }, regen ? 0 : 2000);
      return;
    }
    if (!TM.joined) tmStatus('오류: ' + errText(err));
  });
}
function tmHostReady() {
  TM.joined = true;
  tmHeartbeat();
  clearInterval(TM.tick); TM.tick = setInterval(tmBanner, 250);
  if (TM.takeover) { TM.takeover = false; tmUpdateWipe(TM_TAKEOVER_WIPE_MS); }
  tmBroadcast();
}
function tmOnConn(c) {
  c.on('data', (d) => tmHostData(c, d));
  c.on('close', () => tmHostDrop(c));
  c.on('error', () => tmHostDrop(c));
}
function tmReject(c, msg) {
  const send = () => { try { c.send({type: 'reject', msg}); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 300); };
  if (c.open) send(); else c.on('open', send);
}
function tmHostData(c, d) {
  if (!TM || TM.role !== 'host' || !d || typeof d.type !== 'string') return;
  if (d.type === 'hello') return tmHostHello(c, d);
  const id = c._tid;
  if (!id || TM.conns[id] !== c) return;
  TM.seen[id] = Date.now();
  if (d.type === 'team') tmHostPick(id, d.team);
  else if (d.type === 'move') tmHostMove(id, d);
  else if (d.type === 'avatar') tmHostAvatar(id, d.src);
}
function tmHostHello(c, d) {
  const id = d.id;
  if (typeof id !== 'string' || id.length < 4 || id.length > 16 || id === TM.me) return tmReject(c, '잘못된 요청입니다.');
  let p = TM.players.find(x => x.id === id);
  if (!p) {
    if (TM.started) return tmReject(c, '이미 시작된 방입니다.');
    if (TM.players.length >= TeamLogic.MAX_PLAYERS) return tmReject(c, '방이 가득 찼습니다.');
    p = {id, name: TeamLogic.cleanName(d.name) || 'Player', team: TeamLogic.autoTeam(TM.players), online: true};
    TM.players.push(p);
  } else p.online = true;
  const old = TM.conns[id];
  TM.conns[id] = c; TM.seen[id] = Date.now(); c._tid = id;
  if (old && old !== c) { try { old.close(); } catch (e) {} }
  tmUpdateWipe();
  tmBroadcast();
  for (const k of Object.keys(TM.av)) { try { c.send({type: 'avatar', id: k, src: TM.av[k]}); } catch (e) {} } // not in snap: 32KB each
}
function tmHostDrop(c) {
  const id = c._tid;
  if (!TM || !id || TM.conns[id] !== c) return;
  delete TM.conns[id];
  const p = TM.players.find(x => x.id === id);
  if (p) { if (TM.started) p.online = false; else TM.players = TM.players.filter(x => x !== p); }
  tmUpdateWipe();
  tmBroadcast();
}
function tmHostPick(id, team) {
  const p = TM.players.find(x => x.id === id);
  if (p && !TM.started && TeamLogic.canPick(TM.players, id, team)) { p.team = team; tmBroadcast(); }
}
// src null = photo removed. Host-off players stay off until the room ends.
// shortcut: avatarOff lives on the player, so a lobby leave+rejoin (new player entry) clears it; host can turn it off again.
function tmHostAvatar(id, src) {
  const p = TM.players.find(x => x.id === id);
  if (!p || p.avatarOff || (src !== null && !TeamLogic.validAvatar(src))) return;
  tmAvatarRelay(id, src);
}
function tmAvatarRelay(id, src) {
  if (src) TM.av[id] = src; else delete TM.av[id];
  for (const k of Object.keys(TM.conns)) { try { TM.conns[k].send({type: 'avatar', id, src}); } catch (e) {} }
  tmStones();
}
function tmAvatarOff(id) {
  const p = TM && TM.role === 'host' && TM.players.find(x => x.id === id);
  if (!p || id === TM.me) return;
  p.avatarOff = true; tmAvatarRelay(id, null); tmBroadcast();
}
function tmHostStart() {
  if (TM.started || !TeamLogic.canStart(TM.players).ok) return;
  initBoard(); gameOver = false;
  TM.started = true; TM.result = null; TM.turn = {team: 1, n: {1: 0, 2: 0}};
  clockStart(TM.rule);
  tmBroadcast();
}
function tmHostMove(id, d) {
  if (!TM.started || !TeamLogic.validMove(d, board, gameOver, TM.turn, TM.players, id)) return;
  const team = TM.turn.team;
  if (isForbidden(d.row, d.col, team)) return;
  if (!clockMove(team)) return tmHostTimeUp(team);
  board[d.row][d.col] = team; lastPlaced = {row: d.row, col: d.col};
  const w = checkWin(d.row, d.col);
  if (w) { winningCells = w; gameOver = true; scores[team]++; TM.result = {winner: team, reason: 'five'}; }
  else if (board.flat().every(v => v !== 0)) { gameOver = true; TM.result = {draw: true}; }
  else TM.turn = TeamLogic.advance(TM.turn);
  tmUpdateWipe();
  tmBroadcast();
}
function tmHostTimeUp(t) {
  if (!TM || TM.role !== 'host' || !TM.started || gameOver) return;
  gameOver = true; scores[3 - t]++; TM.result = {winner: 3 - t, reason: 'time'};
  tmUpdateWipe(); tmBroadcast();
}
function tmHostRestart() {
  clockStop();
  TM.started = false; TM.turn = null; TM.result = null; gameOver = false;
  TM.players = TM.players.filter(p => p.online);
  initBoard(); tmUpdateWipe();
  tmBroadcast();
}
// A team with nobody online gets WIPE_MS to get someone back; then it loses.
function tmUpdateWipe(ms) {
  const live = TM.started && !gameOver;
  const w = live ? TeamLogic.wiped(TM.players) : [];
  for (const t of [1, 2]) {
    if (w.includes(t) && !TM.until[t]) {
      const d = ms || TeamLogic.WIPE_MS;
      TM.until[t] = Date.now() + d;
      TM.wipe[t] = setTimeout(() => tmWipeFire(t), d);
    } else if (!w.includes(t) && TM.until[t]) { clearTimeout(TM.wipe[t]); delete TM.until[t]; delete TM.wipe[t]; }
  }
}
function tmWipeFire(t) {
  if (!TM || TM.role !== 'host' || !TM.started || gameOver || !TeamLogic.wiped(TM.players).includes(t)) return;
  const o = 3 - t;
  gameOver = true;
  if (TeamLogic.wiped(TM.players).includes(o)) TM.result = {void: true};
  else { TM.result = {winner: o, reason: 'wipe'}; scores[o]++; }
  for (const k of [1, 2]) { clearTimeout(TM.wipe[k]); }
  TM.until = {}; TM.wipe = {};
  tmBroadcast();
}
function tmSnap() {
  const cd = Object.keys(TM.until).map(t => ({team: +t, ms: Math.max(0, TM.until[t] - Date.now())}));
  return {type: 'snap', hostId: TM.hostId, players: TM.players, started: TM.started, turn: TM.turn, board, scores, gameOver, lastPlaced, winningCells, result: TM.result, cd,
    rule: TM.rule, clock: CLK && TM.started ? {side: CLK.side, used: Date.now() - CLK.t0} : null};
}
function tmBroadcast() {
  const s = tmSnap();
  for (const id of Object.keys(TM.conns)) { try { TM.conns[id].send(s); } catch (e) {} }
  tmRender();
}
function tmHeartbeat() {
  clearInterval(TM.hb);
  TM.hb = setInterval(() => {
    if (!TM) return;
    if (TM.role === 'host') {
      const now = Date.now();
      for (const id of Object.keys(TM.conns)) {
        const c = TM.conns[id];
        try { c.send({type: 'ping'}); } catch (e) {}
        if (now - TM.seen[id] > TM_DEAD) { try { c.close(); } catch (e) {} tmHostDrop(c); }
      }
    } else {
      tmSend({type: 'ping'});
      if (!TM.migr && Date.now() - TM.lastSeen > TM_DEAD) tmHostLost();
    }
  }, TM_HB);
}

// ── guest side ──
function teamJoin() {
  const code = document.getElementById('team-code').value.trim().toUpperCase();
  if (code.length !== CODE_LEN) { tmStatus(CODE_LEN + '자리 코드를 입력하세요'); return; }
  tmLeave();
  TM = tmBase('guest', code);
  tmStatus('연결 중...');
  const t = setTimeout(() => { if (TM && !TM.joined) tmFatal('방이 응답하지 않습니다.'); }, 9000);
  TM.joinTimer = t;
  tmHookProfile();
  tmGuestConnect(tmHello, (err) => { clearTimeout(t); tmFatal(errText(err)); });
}
// onOpen/onFail fire at most once. Used for first join, rejoin and migration.
function tmGuestConnect(onOpen, onFail) {
  let done = false;
  const T = TM;
  const p = T.peer = new Peer(undefined, PEER_OPTS);
  const fail = (e) => {
    if (done) return; done = true; clearTimeout(timer);
    if (TM === T && T.peer === p) T.peer = null;
    try { p.destroy(); } catch (x) {}
    if (TM === T) onFail(e);
  };
  const timer = setTimeout(() => fail('timeout'), 6000);
  p.on('open', () => {
    const c = p.connect(TEAM_PREFIX + T.code, {reliable: true});
    c.on('open', () => {
      if (done || TM !== T || T.peer !== p) return;
      done = true; clearTimeout(timer);
      T.conn = c; T.lastSeen = Date.now();
      c.on('data', (d) => { if (TM === T && T.conn === c) { T.lastSeen = Date.now(); tmGuestData(d); } });
      c.on('close', () => { if (TM === T && T.conn === c) tmHostLost(); });
      c.on('error', () => { if (TM === T && T.conn === c) tmHostLost(); });
      onOpen();
    });
    c.on('error', fail);
  });
  p.on('error', fail);
}
function tmGuestData(d) {
  if (!d || typeof d.type !== 'string') return;
  if (d.type === 'reject') { tmFatal(typeof d.msg === 'string' ? d.msg.slice(0, 60) : '입장할 수 없습니다.'); return; }
  if (d.type === 'avatar') {
    if (typeof d.id !== 'string' || (d.src !== null && !TeamLogic.validAvatar(d.src))) return;
    if (d.src) TM.av[d.id] = d.src; else delete TM.av[d.id];
    return tmStones();
  }
  if (d.type !== 'snap' || !TeamLogic.validSnap(d)) return;
  const first = !TM.joined;
  TM.joined = true; clearTimeout(TM.joinTimer);
  if (first) { tmHeartbeat(); TM.tick = setInterval(tmBanner, 250); }
  if (TM.migr) { TM.migr = null; clearInterval(TM.rejoin); TM.busy = false; }
  TM.players = d.players; TM.started = d.started; TM.turn = d.turn; TM.hostId = d.hostId;
  const r = d.result;
  TM.result = r && typeof r === 'object' ? {winner: r.winner === 1 || r.winner === 2 ? r.winner : 0, reason: ['wipe', 'time'].includes(r.reason) ? r.reason : 'five', draw: !!r.draw, void: !!r.void} : null;
  TM.until = {};
  (Array.isArray(d.cd) ? d.cd : []).forEach(x => { if ((x.team === 1 || x.team === 2) && Number.isFinite(x.ms)) TM.until[x.team] = Date.now() + x.ms; });
  board = d.board; scores = {1: d.scores[1], 2: d.scores[2]}; gameOver = !!d.gameOver;
  TM.rule = TeamLogic.validRule(d.rule) ? d.rule : {k: 'n', main: 0};
  const k = d.clock;
  CLK = k && k.side && TeamLogic.validClock(k.side[1]) && TeamLogic.validClock(k.side[2]) && Number.isFinite(k.used) && k.used >= 0
    ? {rule: TM.rule, side: {1: k.side[1], 2: k.side[2]}, t0: Date.now() - k.used} : null;
  const lp = d.lastPlaced;
  lastPlaced = lp && Number.isInteger(lp.row) && Number.isInteger(lp.col) && lp.row >= 0 && lp.row < BOARD_SIZE && lp.col >= 0 && lp.col < BOARD_SIZE ? {row: lp.row, col: lp.col} : null;
  winningCells = Array.isArray(d.winningCells) ? d.winningCells.filter(c => Array.isArray(c) && c.length === 2 && c.every(Number.isInteger)) : [];
  tmRender();
}
function tmHello() {
  tmSend({type: 'hello', id: TM.me, name: TM.name});
  if (tmPhoto()) tmSend({type: 'avatar', src: tmPhoto()});
}

// ── photo stones (docs/profile-stones.md §4-5). Profile (profile.js) is optional. ──
const tmPhoto = () => typeof Profile !== 'undefined' ? Profile.photo() : null;
let tmHooked = false;
function tmHookProfile() {
  if (tmHooked || typeof Profile === 'undefined') return;
  tmHooked = true;
  Profile.onChange(() => {
    if (!TM) return;
    if (TM.role === 'host') tmHostAvatar(TM.me, tmPhoto() || null); else tmSend({type: 'avatar', src: tmPhoto() || null});
    tmStones();
  });
}
// Team photo = the team's first player in join order. My own photo always shows; others' obey hideOthers.
function tmStones() {
  if (!TM || typeof Profile === 'undefined') return;
  const hide = Profile.hideOthers(), src = [1, 2].map(t => {
    const r = TM.players.find(p => p.team === t);
    return !r ? null : r.id === TM.me ? tmPhoto() : hide ? null : TM.av[r.id] || null;
  });
  const sig = JSON.stringify(src);
  if (sig === TM.stones) return;
  TM.stones = sig;
  Profile.setStone(1, src[0]); Profile.setStone(2, src[1]);
}

// Connection to the host is gone: try to reconnect; the successor re-opens the room itself.
function tmHostLost() {
  if (!TM || TM.role !== 'guest' || TM.migr) return;
  tmClearLink();
  TM.migr = {since: Date.now()};
  clearInterval(TM.rejoin);
  TM.rejoin = setInterval(tmMigrateStep, 2000);
  tmMigrateStep(); tmBanner();
}
function tmMigrateStep() {
  if (!TM || !TM.migr || TM.busy) return;
  const cand = TeamLogic.successor(TM.players, TM.hostId, Math.floor((Date.now() - TM.migr.since) / TM_PICK_MS));
  if (!cand) { tmFatal('방이 사라졌습니다.'); return; }
  TM.busy = true;
  tmGuestConnect(() => { TM.busy = false; tmHello(); }, (err) => {
    if (!TM) return;
    TM.busy = false;
    // The broker reports peer-unavailable only when its queue for the dead id expires, often after our 6 s timeout.
    // Taking over on timeout is safe: if the host id is still held, tmOpenHostPeer gets unavailable-id and we stay a guest.
    if (cand.id === TM.me && (err === 'timeout' || (err && err.type === 'peer-unavailable'))) tmTakeover();
  });
}
function tmTakeover() {
  clearInterval(TM.rejoin);
  tmClearLink();
  TM.role = 'host'; TM.migr = null; TM.takeover = true; TM.busy = false;
  TM.prevPlayers = TM.players.map(p => ({...p})); TM.prevHost = TM.hostId;
  TM.hostId = TM.me; TM.conns = {}; TM.seen = {}; TM.until = {}; TM.wipe = {};
  TM.players.forEach(p => { if (p.id !== TM.me) p.online = false; });
  if (!TM.started) TM.prune = setTimeout(() => { if (TM && !TM.started) { TM.players = TM.players.filter(p => p.online); tmBroadcast(); } }, 12000);
  tmOpenHostPeer(false);
}

// ── UI ──
function tmPick(team) { if (TM.role === 'host') tmHostPick(TM.me, team); else tmSend({type: 'team', team}); }
function teamPick(team) { if (TM) tmPick(team); }
function teamStart() { if (TM && TM.role === 'host') tmHostStart(); }
function tmRematch() {
  if (!TM) return;
  if (TM.role === 'host') { closeOverlay(); tmHostRestart(); }
  else document.getElementById('modal-sub').textContent = '방장이 새 판을 시작하면 로비로 이동합니다.';
}
function tmBanner() {
  if (!TM) return;
  const parts = [];
  if (TM.migr) parts.push('방장 연결 끊김 — 새 방장 연결 중...');
  for (const t of [1, 2]) if (TM.until[t]) parts.push(`${t === 1 ? '흑' : '백'}팀 전원 이탈 — ${Math.max(0, Math.ceil((TM.until[t] - Date.now()) / 1000))}초 후 패배`);
  document.getElementById('team-banner').textContent = parts.join(' · ');
  const hint = document.getElementById('team-hint');
  if (!TM.started && TM.migr) hint.textContent = parts[0];
}
function tmRender() {
  if (!TM || !TM.joined) return;
  currentPlayer = TM.turn ? TM.turn.team : 1;
  tmDrawStones(); tmStones();
  updateTurn(); updateScores(); tmBadges(); tmBanner(); clockDraw();
  if (lastPlaced && TM.ann !== lastPlaced.row + ',' + lastPlaced.col + board[lastPlaced.row][lastPlaced.col]) {
    TM.ann = lastPlaced.row + ',' + lastPlaced.col + board[lastPlaced.row][lastPlaced.col];
    announce((board[lastPlaced.row][lastPlaced.col] === 1 ? '흑돌 ' : '백돌 ') + coordName(lastPlaced.row, lastPlaced.col) + ' 착수');
  }
  if (!TM.started) {
    TM.endShown = false;
    if (document.getElementById('overlay').classList.contains('show')) closeOverlay();
    document.getElementById('conn-status').style.display = 'none';
    tmLobby();
    if (!document.getElementById('team-overlay').classList.contains('show')) showOverlay('team-overlay');
    return;
  }
  const on = TM.players.filter(p => p.online).length;
  setConnStatus(on === TM.players.length, `접속 ${on}/${TM.players.length}`);
  if (document.getElementById('team-overlay').classList.contains('show')) hideOverlay('team-overlay');
  if (gameOver && !TM.endShown) { TM.endShown = true; const T = TM; setTimeout(() => { if (TM === T && gameOver) tmShowEnd(); }, winningCells.length ? 500 : 100); }
  if (!gameOver) TM.endShown = false;
}
function tmDrawStones() {
  const sig = JSON.stringify([board, lastPlaced, winningCells]);
  if (sig === TM.sig) return;
  TM.sig = sig;
  const have = stonesLayer.querySelectorAll('.stone').length, want = board.flat().filter(Boolean).length;
  if (want === have + 1 && !winningCells.length && lastPlaced && board[lastPlaced.row][lastPlaced.col]) {
    document.querySelectorAll('.stone.last-placed').forEach(e => e.classList.remove('last-placed'));
    addStoneElement(lastPlaced.row, lastPlaced.col, board[lastPlaced.row][lastPlaced.col], true, false);
  } else { refreshStones(); }
}
function tmShowEnd() {
  const r = TM.result || {};
  if (r.void) return showEndOverlay('대국 무효', '양 팀 모두 연결이 끊겨 대국이 종료되었습니다.');
  if (r.draw) return showDrawOverlay();
  const w = r.winner, mine = w === tmMyTeam();
  const stone = document.getElementById('modal-stone');
  stone.className = `modal-stone ${w === 1 ? 'black-stone' : 'white-stone'}`;
  stone.style.background = ''; stone.style.boxShadow = '';
  document.getElementById('modal-winner').textContent = `${w === 1 ? '흑' : '백'}팀 승리!` + (mine ? ' 🎉' : '');
  document.getElementById('modal-sub').textContent = r.reason === 'time' ? (mine ? '상대 팀이 시간을 초과했습니다!' : '시간 초과로 졌습니다.') : mine ? '우리 팀이 이겼습니다!' : (r.reason === 'wipe' ? '상대 팀 전원이 이탈했습니다.' : '상대 팀이 이겼습니다.');
  resultTitle('승리');
  showOverlay('overlay');
}
function tmBadges() {
  for (const t of [1, 2]) {
    const el = document.getElementById(t === 1 ? 'name-black' : 'name-white');
    el.textContent = (t === 1 ? '흑팀' : '백팀') + ' ';
    TM.players.filter(p => p.team === t).forEach(p => {
      const s = document.createElement('span');
      s.className = 'player-badge ' + (p.id === TM.me ? 'badge-human' : 'online-badge');
      s.textContent = p.name + (p.online ? '' : ' (끊김)');
      if (!p.online) s.style.opacity = '0.5';
      el.appendChild(s);
    });
    document.getElementById(t === 1 ? 'label-black' : 'label-white').textContent = (t === 1 ? '흑돌 · 선공' : '백돌 · 후공');
  }
}
function tmLobby() {
  tmView('lobby');
  const host = TM.role === 'host', online = TM.players.filter(p => p.online);
  document.getElementById('team-code-display').textContent = TM.code;
  document.getElementById('team-count').textContent = `${online.length}/${TeamLogic.MAX_PLAYERS}`;
  document.getElementById('team-rule').textContent = ruleName(TM.rule);
  for (const t of [1, 2]) {
    const ul = document.getElementById('tl' + t);
    ul.textContent = '';
    TM.players.filter(p => p.team === t).forEach(p => {
      const li = document.createElement('li');
      li.textContent = (p.id === TM.hostId ? '👑 ' : '') + p.name + (p.id === TM.me ? ' (나)' : '') + (p.online ? '' : ' (끊김)');
      if (p.id === TM.me) li.className = 'me'; else if (!p.online) li.className = 'off';
      if (host && p.id !== TM.me && TM.av[p.id]) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'level-chip av-off'; b.textContent = '사진 끄기';
        b.setAttribute('aria-label', p.name + ' 사진 끄기');
        b.onclick = () => tmAvatarOff(p.id);
        li.append(' ', b);
      }
      ul.appendChild(li);
    });
    const b = document.getElementById('tb' + t);
    b.disabled = tmMyTeam() === t || !TeamLogic.canPick(TM.players, TM.me, t);
  }
  const start = document.getElementById('team-start'), cs = TeamLogic.canStart(TM.players);
  start.style.display = host ? '' : 'none';
  start.disabled = !cs.ok;
  if (!TM.migr) document.getElementById('team-hint').textContent = host ? cs.reason : '방장이 시작하길 기다리는 중...';
}
