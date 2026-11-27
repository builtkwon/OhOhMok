const BOARD_SIZE = 15;
const CELL = 40;
const MARGIN = 28;
const STONE_R = 17;
const CANVAS_SIZE = (BOARD_SIZE - 1) * CELL + MARGIN * 2;

let board = [];
let currentPlayer = 1;
let gameOver = false;
let scores = {1: 0, 2: 0};
let lastPlaced = null;
let winningCells = [];
let seq = []; // move order [[row, col], ...] of the current game (rooms: the host's list, sent in the snapshot)
let orderOk = false; // the finished game's result was closed: a board tap now toggles move numbers
let turnAt = 0, wasMyTurn = false; // when my turn last began (performance.now()); taps made before it are dropped
let humanPlayer = 1;
let aiPlayer = 2;
let aiHist = []; // moves of the current AI game, fed to GomokuAI.learn when it ends
let aiThinking = false;

// Game mode: 'ai' | 'team' (방 만들기: 1:1 ~ 3:1)
let gameMode = 'ai';

const canvas = document.getElementById('board-canvas');
const clickCanvas = document.getElementById('board-click');
const stonesLayer = document.getElementById('stones-layer');
const ghost = document.getElementById('ghost-stone');

canvas.width = clickCanvas.width = CANVAS_SIZE;
canvas.height = clickCanvas.height = CANVAS_SIZE;
document.getElementById('board-surface').style.width = CANVAS_SIZE + 'px';
document.getElementById('board-surface').style.height = CANVAS_SIZE + 'px';
stonesLayer.style.width = CANVAS_SIZE + 'px';
stonesLayer.style.height = CANVAS_SIZE + 'px';
ghost.style.width = ghost.style.height = STONE_R * 2 + 'px';
clickCanvas.style.width = clickCanvas.style.height = CANVAS_SIZE + 'px';
clickCanvas.style.position = 'absolute';
clickCanvas.style.top = '0'; clickCanvas.style.left = '0';
clickCanvas.style.opacity = '0';

// ─── MODE SELECTION ───────────────────────────────────────────
function selectMode(mode) {
  gameMode = mode;
  hideOverlay('mode-overlay');
  showOverlay('rule-overlay');
}
// time control picked in the category step; it applies to the game you create (joiners get the room's rule)
let RULE = {k: 'n', main: 0};
const TC_OPTS = {n: [[0, '없음'], [300000, '5분'], [600000, '10분']], b: [[5000, '5초'], [10000, '10초']]};
const ruleName = (r) => r.k === 'b' ? `속기전 · 한 수 ${r.per / 1000}초` : r.main ? `일반전 · ${r.main / 60000}분 + 초읽기 30초×3` : '일반전 · 시간 무제한';
function selectRule(k) {
  RULE = k === 'b' ? {k, per: 5000} : {k, main: 0};
  again = false; renderTc();
  hideOverlay('rule-overlay');
  if (gameMode === 'ai') { aiStones(false); showOverlay('select-overlay'); } else teamEntry();
}
function ruleBack() { hideOverlay('rule-overlay'); showOverlay('mode-overlay'); }
function renderTc() {
  const cur = RULE.k === 'b' ? RULE.per : RULE.main;
  document.querySelectorAll('[data-tc]').forEach(box => {
    box.textContent = '';
    for (const [v, label] of TC_OPTS[RULE.k]) {
      const b = box.appendChild(document.createElement('button'));
      b.type = 'button'; b.className = 'level-chip'; b.textContent = label;
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', cur === v);
      b.onclick = () => { RULE = RULE.k === 'b' ? {k: 'b', per: v} : {k: 'n', main: v}; renderTc(); selTitle(); };
    }
  });
}
renderTc();

const OVERLAYS = '.overlay.show,.select-overlay.show,.mode-overlay.show,.room-overlay.show';
let lastFocus = null;
function syncInert() {
  const open = document.querySelectorAll(OVERLAYS).length > 0;
  // the theme/profile tools stay usable over the first screen (mode select only); any other overlay blocks them
  const modeOnly = open && [...document.querySelectorAll(OVERLAYS)].every(o => o.id === 'mode-overlay');
  document.querySelector('header h1').inert = open;
  const tools = document.querySelector('.header-tools');
  tools.inert = open && !modeOnly; tools.classList.toggle('above', modeOnly);
  document.querySelector('.game-layout').inert = open;
}
function showOverlay(id) {
  const el = document.getElementById(id);
  if (!document.querySelector(OVERLAYS)) lastFocus = document.activeElement;
  el.classList.add('show');
  syncInert();
  setTimeout(() => { const f = el.querySelector('button, input'); if (f) f.focus(); }, 0);
}
function hideOverlay(id) {
  document.getElementById(id).classList.remove('show');
  syncInert();
  if (!document.querySelector(OVERLAYS) && lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
}
function announce(msg) { document.getElementById('sr-live').textContent = msg; }
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('profile-menu').hidden) return toggleProfileMenu(false);
  const on = (id) => document.getElementById(id).classList.contains('show');
  if (on('overlay')) closeOverlay();
  else if (on('team-overlay')) teamBack();
  else if (on('select-overlay')) { hideOverlay('select-overlay'); showOverlay('rule-overlay'); }
  else if (on('rule-overlay')) ruleBack();
});

// AI difficulty
const LEVEL_NAMES = {easy: '쉬움', normal: '보통', hard: '어려움', boss: 'JOONSAMA'};
let aiLevel = 'normal';
// ZESTMOK shares this github.io origin: copy its level/learning to our keys once (only if ours is absent). Old keys stay - ZESTMOK still uses them.
for (const k of ['level', ...Object.keys(LEVEL_NAMES).map(l => 'mem-' + l)]) {
  try { const v = localStorage.getItem('zestmok-' + k); if (v !== null && localStorage.getItem('ohohmok-' + k) === null) localStorage.setItem('ohohmok-' + k, v); } catch (e) {} // full/blocked storage: skip that key
}
try { const v = localStorage.getItem('ohohmok-level'); if (LEVEL_NAMES[v]) aiLevel = v; } catch (e) {}
function levelName() { return LEVEL_NAMES[aiLevel]; }
const aiName = () => aiLevel === 'boss' ? 'JOONSAMA' : 'AI';
const meName = () => (hasProfile() && Profile.signedIn() && Profile.name()) || ''; // Google name, '' = signed out (shown as 나)
// boss mode: the AI's stones wear the boss's face (class = which color it plays)
let rage = false; // set by flipTable, cleared when a new fight starts
// other levels: body.ai-N puts the pixel face on the AI's color N (style.css); never in rooms
function applyBoss() {
  const ai = gameMode === 'ai', boss = ai && aiLevel === 'boss';
  document.body.classList.toggle('rage', rage);
  for (const n of [1, 2]) { document.body.classList.toggle('boss-' + n, boss && aiPlayer === n); document.body.classList.toggle('ai-' + n, ai && !boss && aiPlayer === n); }
}
let AI_RARE = 0.05; // chance an AI stone gets the rare face (tests set 1)
const aiRare = new Set(); // cells (row*15+col) of this game's rare-faced AI stones, so refreshStones keeps them
let again = false; // colour picker opened by "다시 하기"
function selTitle() { document.getElementById('select-title').textContent = again ? `다시 하기 · ${LEVEL_NAMES[aiLevel]} · ${ruleName(RULE)}` : 'AI 대전 설정'; }
function setLevel(l) {
  aiLevel = l; selTitle();
  try { localStorage.setItem('ohohmok-level', l); } catch (e) {}
  document.querySelectorAll('.level-chip[data-level]').forEach(b => b.setAttribute('aria-checked', b.dataset.level === l));
}
setLevel(aiLevel);

// ─── COLOR SELECTION (AI MODE) ────────────────────────────────
function selectColor(color) {
  humanPlayer = color;
  aiPlayer = color === 1 ? 2 : 1;
  hideOverlay('select-overlay');
  aiMemLoad();
  updateBadges();
  gameOver = false;
  aiThinking = false; flipUsed = rage = false;
  currentPlayer = 1;
  document.getElementById('conn-status').style.display = 'none';
  initBoard();
  clockStart(RULE);
  updateTurn();
  setAiThinking(false);
  if (humanPlayer === 2) setTimeout(doAiMove, 400);
}

function updateBadges() {
  applyBoss(); aiStones(true);
  const nBlack = document.getElementById('name-black');
  const nWhite = document.getElementById('name-white');
  const lBlack = document.getElementById('label-black');
  const lWhite = document.getElementById('label-white');
  // names via textContent (the Google name is user data)
  const card = (el, name, cls, badge) => {
    el.textContent = name + ' ';
    if (badge) { const s = el.appendChild(document.createElement('span')); s.className = 'player-badge ' + cls; s.textContent = badge; }
  };
  const [hEl, aEl] = humanPlayer === 1 ? [nBlack, nWhite] : [nWhite, nBlack];
  card(hEl, meName() || '나', 'badge-human', meName() && '나');
  card(aEl, aiName(), 'badge-ai', aiLevel === 'boss' ? 'AI' : levelName());
  lBlack.textContent = '흑돌 · 선공';
  lWhite.textContent = '백돌 · 후공';
}

// ─── BOARD ────────────────────────────────────────────────────
function initBoard() {
  aiHist = []; aiOffers = 0; voteNote(''); aiRare.clear();
  board = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(0));
  lastPlaced = null; winningCells = []; seq = []; orderOk = false; eggUsed = false; stonesLayer.classList.remove('show-order');
  stonesLayer.innerHTML = '';
  stonesLayer.appendChild(ghost);
  drawBoard();
}

const BOARD_FONT = "700 12px Galmuri11, sans-serif";
function drawBoard() {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.strokeStyle = '#7a5c30'; ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = MARGIN+i*CELL, y = MARGIN+i*CELL;
    ctx.beginPath(); ctx.moveTo(x, MARGIN); ctx.lineTo(x, MARGIN+(BOARD_SIZE-1)*CELL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(MARGIN, y); ctx.lineTo(MARGIN+(BOARD_SIZE-1)*CELL, y); ctx.stroke();
  }
  const stars = [[3,3],[3,11],[7,7],[11,3],[11,11]];
  ctx.fillStyle = '#5c3f18';
  for (const [r,c] of stars) { ctx.beginPath(); ctx.arc(MARGIN+c*CELL, MARGIN+r*CELL, 4, 0, Math.PI*2); ctx.fill(); }
  ctx.fillStyle = '#3b2810'; // coordinates: dark enough to read on the wood
  ctx.font = BOARD_FONT; ctx.textAlign = 'center';
  const cols = 'ABCDEFGHJKLMNOP';
  for (let i = 0; i < BOARD_SIZE; i++) {
    ctx.fillText(cols[i], MARGIN+i*CELL, 14);
    ctx.fillText(cols[i], MARGIN+i*CELL, CANVAS_SIZE-6);
    ctx.textAlign='right'; ctx.fillText(BOARD_SIZE-i, MARGIN-8, MARGIN+i*CELL+4);
    ctx.textAlign='left'; ctx.fillText(BOARD_SIZE-i, MARGIN+(BOARD_SIZE-1)*CELL+10, MARGIN+i*CELL+4);
    ctx.textAlign='center';
  }
}

function colRowFromXY(x, y) {
  const col = Math.round((x-MARGIN)/CELL), row = Math.round((y-MARGIN)/CELL);
  if (col<0||col>=BOARD_SIZE||row<0||row>=BOARD_SIZE) return null;
  const cx=MARGIN+col*CELL, cy=MARGIN+row*CELL;
  if (Math.abs(x-cx)>CELL*0.5||Math.abs(y-cy)>CELL*0.5) return null;
  return {row, col};
}

function addStoneElement(row, col, player, isLast, isWin) {
  const el = document.createElement('div');
  el.className = `stone ${player===1?'black-stone':'white-stone'}`;
  el.style.left = (MARGIN+col*CELL)+'px'; el.style.top = (MARGIN+row*CELL)+'px';
  el.dataset.row = row; el.dataset.col = col;
  const n = seq.findIndex(([r, c]) => r === row && c === col);
  if (n >= 0) el.dataset.n = n + 1;
  if (isLast) el.classList.add('last-placed');
  if (isWin) el.classList.add('winning');
  if (aiRare.has(row * BOARD_SIZE + col)) el.classList.add('rare');
  stonesLayer.appendChild(el);
  return el;
}

function refreshStones() {
  stonesLayer.innerHTML = ''; stonesLayer.appendChild(ghost);
  for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) if (board[r][c]) {
    const isLast = lastPlaced && lastPlaced.row===r && lastPlaced.col===c;
    const isWin = winningCells.some(([wr,wc])=>wr===r&&wc===c);
    addStoneElement(r, c, board[r][c], isLast, isWin);
  }
}

// ─── PLACING STONES ───────────────────────────────────────────
// Korean rule: black may not play 3-3 or 6+ (4-4 ok). Applies to every mode; white unrestricted.
function isForbidden(row, col, player) {
  return player === 1 && board[row][col] === 0 && GomokuAI.forbidden(board, row, col);
}
// short message in the status line, then back to the turn text
function flashTurn(msg, sr) {
  const t = document.getElementById('turn-text');
  t.textContent = msg; announce(sr || msg);
  setTimeout(() => { if (t.textContent === msg) updateTurn(); }, 1500);
}
const flashForbidden = () => flashTurn('금수 (쌍삼 · 장목) 자리입니다', '금수 자리입니다');
function handleClick(row, col) {
  if (gameOver || aiThinking) return;
  if (myTurn() && isForbidden(row, col, gameMode === 'team' ? TM.turn.team : currentPlayer)) return flashForbidden();
  if (gameMode === 'ai') {
    if (currentPlayer !== humanPlayer) return;
    doPlaceStone(row, col, true);
    if (!gameOver) setTimeout(doAiMove, 350);
  } else if (gameMode === 'team') {
    if (!tmMyTurn()) return;
    if (TM.role === 'host') tmHostMove(TM.me, {row, col}); else tmSend({type: 'move', row, col});
  }
}

const COL_NAMES = 'ABCDEFGHJKLMNOP';
function coordName(r, c) { return COL_NAMES[c] + (BOARD_SIZE - r); }

// per-browser AI learning (ai.js keeps the model; we persist it per level and feed it finished games)
const memKey = () => 'ohohmok-mem-' + aiLevel;
function aiMemLoad() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(memKey())); } catch (e) {}
  GomokuAI.setMemory(m);
  aiBookLoad();
  aiOpenLoad();
}
// boss opening book (ai-open.js, built in ZESTMOK by tools/engine/build-opening.js with Rapfi): only the boss reads it, loaded on first use
function aiOpenLoad() {
  if (window.AI_OPEN) return GomokuAI.setOpening(window.AI_OPEN);
  if (aiLevel !== 'boss' || document.getElementById('ai-open')) return;
  const s = document.createElement('script');
  s.id = 'ai-open'; s.src = 'ai-open.js'; s.onload = aiOpenLoad;
  document.head.appendChild(s);
}
// shared boss book (ai-book.js, built by tools/build-book.js from collected games): boss level only, loaded on first use
function aiBookLoad() {
  GomokuAI.setBook(aiLevel === 'boss' ? window.AI_BOOK : null);
  if (aiLevel !== 'boss' || window.AI_BOOK || document.getElementById('ai-book')) return;
  const s = document.createElement('script');
  s.id = 'ai-book'; s.src = 'ai-book.js'; s.onload = aiBookLoad;
  document.head.appendChild(s);
}
// every finished boss game goes to the collection sheet (docs/boss-book.md); fire and forget, no reply needed
const BOOK_SEND = 'https://script.google.com/macros/s/AKfycbzzlCQ6-R-xHjQHcxYCfD3rmV085APntRrgwpRsyBXEYcjaZ-M6bYVoWHATb4koW6yFJw/exec';
function aiSend(winner) {
  if (!BOOK_SEND || aiLevel !== 'boss') return;
  try { fetch(BOOK_SEND, {method: 'POST', mode: 'no-cors', keepalive: true, body: JSON.stringify({s: 'ohohmok', ai: aiPlayer, w: winner, m: aiHist.map(h => [h.row, h.col])})}).catch(() => {}); } catch (e) {}
}
function aiLearn(winner) {
  if (gameMode !== 'ai' || aiLevel === 'easy' || !aiHist.length) return;
  aiSend(winner);
  GomokuAI.learn(aiHist, aiPlayer, winner);
  try { localStorage.setItem(memKey(), JSON.stringify(GomokuAI.getMemory())); } catch (e) {} // full/blocked storage: learn for this tab only
  aiHist = [];
}
function doPlaceStone(row, col, triggerAi) {
  if (gameOver || board[row][col] !== 0) return;
  if (!clockMove(currentPlayer)) return timeUp(currentPlayer);
  if (gameMode === 'ai') aiHist.push({p: currentPlayer, row, col, key: GomokuAI.posKey(board, currentPlayer)});
  board[row][col] = currentPlayer; seq.push([row, col]);
  document.querySelectorAll('.stone.last-placed').forEach(e=>e.classList.remove('last-placed'));
  lastPlaced = {row, col};
  announce((currentPlayer===1?'흑돌 ':'백돌 ')+coordName(row,col)+' 착수');
  if (gameMode === 'ai' && currentPlayer === aiPlayer && Math.random() < AI_RARE) aiRare.add(row * BOARD_SIZE + col); // decided once, kept all game
  const isWin = checkWin(row, col);
  addStoneElement(row, col, currentPlayer, true, false);
  if (isWin) {
    winningCells = isWin;
    gameOver = true;
    scores[currentPlayer]++;
    updateScores();
    aiLearn(currentPlayer);
    setTimeout(refreshStones, 50);
    setTimeout(()=>showWinOverlay(currentPlayer), 500);
    return;
  }
  if (board.flat().every(v=>v!==0)) {
    gameOver = true;
    aiLearn(0);
    setTimeout(()=>showDrawOverlay(), 300);
    return;
  }
  currentPlayer = currentPlayer===1?2:1;
  updateTurn();
}

// ─── AI ───────────────────────────────────────────────────────
function doAiMove() {
  if (gameOver || currentPlayer !== aiPlayer || gameMode !== 'ai') return;
  aiThinking = true; setAiThinking(true); updateTurn(); // updateTurn: disables draw / resign
  setTimeout(()=>{
    const move = GomokuAI.bestMove(board, aiPlayer, aiLevel);
    aiThinking = false; setAiThinking(false);
    if (gameOver) return; // resigned while the AI was thinking
    if (move && move.doomed && aiLevel === 'boss' && !flipUsed) return flipTable();
    if (move && aiLevel === 'boss' && !eggUsed && makesFive(move.row, move.col, aiPlayer)) return bossEgg(move);
    if (move) doPlaceStone(move.row, move.col, false);
  }, 80);
}

// boss about to lose: flips the table once per fight (earthquake -> stones fly, board tips over -> board reassembles empty). Score untouched.
let flipUsed = false, flipping = false;
async function flipTable() {
  flipUsed = aiThinking = flipping = true; updateTurn(); // updateTurn: disables resign
  aiLearn(humanPlayer); // the flipped game = one AI loss (stored in all 4 rotations), recorded before the animation so leaving mid-flip still counts
  const B = board, wrap = document.querySelector('.board-wrap'), rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const say = document.body.appendChild(document.createElement('div'));
  say.innerHTML = '<img src="img/wonjun-rage.jpg" alt="" style="display:block;max-width:80vw;max-height:45vh;border-radius:10px;box-shadow:0 0 40px #c0392b;margin:0 auto 10px"><div>상 엎어!! (╯°□°)╯︵ ┻━┻</div>';
  say.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:50;pointer-events:none;text-align:center;font:700 24px/1.2 var(--font-sans);color:#fff;text-shadow:0 0 12px #c0392b,0 2px 6px #000;white-space:nowrap';
  announce('JOONSAMA가 상을 엎었습니다. 대국이 처음부터 다시 시작됩니다');
  await flipAway(wrap, rm);
  say.remove();
  if (board !== B || gameMode !== 'ai' || gameOver) { flipping = false; wrap.getAnimations().forEach(a => a.cancel()); return; } // player left mid-flip
  aiPlayer = 1; humanPlayer = 2; // AI always opens the restarted game (black)
  rage = true; updateBadges(); // AI stones = angry photo for this game only
  gameOver = false; currentPlayer = 1;
  initBoard(); clockStart(RULE); updateTurn();
  await flipBack(wrap, rm);
  aiThinking = flipping = false; updateTurn();
  setTimeout(doAiMove, 300);
}
const rnd = (a) => (Math.random() - 0.5) * 2 * a;
async function flipAway(wrap, rm) { // earthquake -> stones fly -> board tips over
  if (rm) return new Promise(r => setTimeout(r, 1500));
  await wrap.animate(Array.from({length: 18}, () => ({transform: `translate(${rnd(14)}px,${rnd(14)}px) rotate(${rnd(1.5)}deg)`})), {duration: 900}).finished;
  document.querySelectorAll('#stones-layer .stone').forEach(el => el.animate([{transform: 'translate(-50%,-50%)'}, {transform: `translate(-50%,-50%) translate(${rnd(400)}px,${-80 - Math.random() * 260}px) rotate(${rnd(720)}deg)`, opacity: 0}], {duration: 900, easing: 'ease-out', fill: 'forwards'}));
  await wrap.animate([{transform: 'none', opacity: 1}, {transform: 'perspective(900px) rotateX(80deg) translateY(60px)', opacity: 0}], {duration: 900, easing: 'ease-in', fill: 'forwards'}).finished;
}
async function flipBack(wrap, rm) { // the board reassembles
  wrap.getAnimations().forEach(a => a.cancel());
  if (!rm) await wrap.animate([{transform: 'perspective(900px) rotateX(-80deg) scale(.8)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 600, easing: 'cubic-bezier(.34,1.56,.64,1)'}).finished;
}
function makesFive(r, c, p) { board[r][c] = p; const w = checkWin(r, c); board[r][c] = 0; return !!w; }

// Easter egg: the boss is about to make five -> its stone blinks, "250번 내리쳐라!" + 3, 2, 1, then EGG_MS of taps anywhere.
// EGG_TAPS taps = I flip the table: game void (score unchanged, learned as the boss's win), new game with the same colours.
// Fewer = the boss laughs and plays the five. Once per game.
const EGG_TAPS = 250, EGG_MS = 10000;
let eggUsed = false;
const pause = (ms) => new Promise(r => setTimeout(r, ms));
async function bossEgg(move) {
  eggUsed = aiThinking = flipping = true; updateTurn(); // updateTurn: disables draw / resign
  const B = board, wrap = document.querySelector('.board-wrap'), rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const blink = addStoneElement(move.row, move.col, aiPlayer, false, false); blink.classList.add('egg-blink');
  const ui = document.body.appendChild(document.createElement('div'));
  ui.className = 'egg'; ui.setAttribute('role', 'alert');
  ui.innerHTML = `<div class="egg-box"><div>${EGG_TAPS}번 내리쳐라!</div><div class="egg-bar"><i></i></div><div class="egg-num">3</div></div>`;
  const num = ui.querySelector('.egg-num'), bar = ui.querySelector('.egg-bar i'), box = ui.querySelector('.egg-box');
  announce(`${aiName()}가 이기기 직전입니다. 10초 안에 화면을 ${EGG_TAPS}번 두드리면 상을 엎을 수 있습니다`);
  ui.addEventListener('touchstart', (e) => e.preventDefault(), {passive: false}); // no zoom / scroll while tapping
  for (const n of [3, 2, 1]) { num.textContent = n; await pause(800); }
  let taps = 0;
  const hit = () => { if (taps < EGG_TAPS) taps++; bar.style.width = (100 * taps / EGG_TAPS) + '%'; if (!rm) wrap.animate([{transform: `translate(${rnd(4)}px,${rnd(4)}px)`}, {transform: 'none'}], {duration: 80}); };
  const key = (e) => { if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); hit(); } };
  ui.addEventListener('pointerdown', hit); document.addEventListener('keydown', key, true);
  const end = performance.now() + EGG_MS;
  while (taps < EGG_TAPS && performance.now() < end && board === B && gameMode === 'ai') {
    num.textContent = `${taps} / ${EGG_TAPS} · ${Math.ceil((end - performance.now()) / 1000)}초`;
    await pause(50);
  }
  ui.removeEventListener('pointerdown', hit); document.removeEventListener('keydown', key, true);
  num.textContent = `${taps} / ${EGG_TAPS}`;
  if (board !== B || gameMode !== 'ai') { ui.remove(); flipping = false; return; } // player left mid-egg
  blink.remove();
  if (taps >= EGG_TAPS) {
    box.innerHTML = '<div>상 엎어!! ┻━┻︵ヽ(`Д´)ﾉ︵ ┻━┻</div>';
    announce('상을 엎었습니다. 이번 판은 무효, 같은 조건으로 새 판을 시작합니다');
    aiHist.push({p: aiPlayer, row: move.row, col: move.col, key: GomokuAI.posKey(board, aiPlayer)});
    aiLearn(aiPlayer); // learned as the boss's win: he had it
    await flipAway(wrap, rm);
    ui.remove();
    if (board !== B || gameMode !== 'ai') { flipping = false; wrap.getAnimations().forEach(a => a.cancel()); return; }
    gameOver = false; currentPlayer = 1;
    initBoard(); clockStart(RULE); updateTurn();
    await flipBack(wrap, rm);
    aiThinking = flipping = false; updateTurn();
    if (aiPlayer === 1) setTimeout(doAiMove, 300);
    return;
  }
  box.innerHTML = '<div>ㅋㅋㅋ 힘이 부족하구나!</div><img src="img/wonjun-win.jpg" alt="">';
  announce(`실패했습니다. ${aiName()}가 비웃습니다`);
  await pause(1800);
  ui.remove();
  flipping = false;
  if (board !== B || gameMode !== 'ai') return;
  aiThinking = false;
  doPlaceStone(move.row, move.col, false);
}

function setAiThinking(on) {
  document.getElementById('ai-thinking').classList.toggle('show', on);
  clickCanvas.style.pointerEvents = on ? 'none' : 'auto';
}

// ─── WIN CHECK ────────────────────────────────────────────────
function checkWin(row,col){
  const p=board[row][col];
  const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(const[dr,dc]of dirs){
    const cells=[[row,col]];
    for(let d=1;d<5;d++){const r=row+dr*d,c=col+dc*d;if(r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE||board[r][c]!==p)break;cells.push([r,c]);}
    for(let d=1;d<5;d++){const r=row-dr*d,c=col-dc*d;if(r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE||board[r][c]!==p)break;cells.push([r,c]);}
    if(cells.length>=5)return cells;
  }
  return null;
}

// ─── UI UPDATES ───────────────────────────────────────────────
function updateTurn(){
  const mt = !gameOver && myTurn();
  if (mt && !wasMyTurn) turnAt = performance.now();
  wasMyTurn = mt;
  if (!gameOver) { orderOk = false; stonesLayer.classList.remove('show-order'); } // numbers belong to a finished game only
  applyBoss();
  const dot=document.getElementById('turn-dot');
  const text=document.getElementById('turn-text');
  dot.style.background=currentPlayer===1?'#222':'#e8e0d0';
  dot.style.border=currentPlayer===2?'1px solid #999':'none';
  dot.style.boxShadow=currentPlayer===1?'0 0 6px rgba(0,0,0,0.8)':'0 0 6px rgba(255,255,255,0.6)';
  if(gameMode==='ai') text.textContent=currentPlayer===humanPlayer?(meName()?meName()+' 차례':'내 차례'):aiName()+' 차례';
  else text.textContent=tmTurnText();
  // nobody can make five any more (docs/draw-resign.md §1): say so, keep playing, push the draw button
  const stuck=!gameOver&&board.length>0&&TeamLogic.noMoves(board); // board is empty [] until Init (renderProfile runs first)
  if(stuck)text.textContent='더 이상 둘 수가 없습니다 · '+text.textContent;
  updateActions(stuck);
  if(document.activeElement===clickCanvas)kbShow();
  document.getElementById('card-black').classList.toggle('active',currentPlayer===1);
  document.getElementById('card-white').classList.toggle('active',currentPlayer===2);
}

// draw / resign buttons: always shown; disabled with the reason as title when unusable.
// draw on any turn, 2 offers a game (resign: no limit)
let aiOffers=0;
function updateActions(stuck){
  const team=gameMode==='team', live=!gameOver&&(!team||!!(TM&&TM.started&&tmMe()));
  const used=team?(TM&&TM.offers.draw[TM.me])||0:aiOffers;
  const busy=team?!!(TM&&TM.vote):aiThinking||flipping; // flipping sets aiThinking too
  const why=!live?'진행 중인 게임이 없습니다':busy?(team?'투표가 진행 중입니다':'AI가 생각 중입니다'):'';
  const dwhy=why||(used>=TeamLogic.VOTE_MAX?'이번 판의 무승부 제안 기회를 모두 썼습니다':''); // any turn (AI's turn = AI thinking)
  const draw=document.getElementById('draw-btn'), res=document.getElementById('resign-btn');
  draw.disabled=!!dwhy; draw.title=dwhy;
  draw.classList.toggle('hot',!!stuck&&!dwhy);
  res.disabled=!!why; res.title=why;
}
// short note (vote refused / cancelled), gone after 4 s; '' clears it
function voteNote(msg){
  const el=document.getElementById('vote-note');
  el.textContent=msg; clearTimeout(voteNote.t);
  if(msg)voteNote.t=setTimeout(()=>{if(el.textContent===msg)el.textContent='';},4000);
}
const actOff=(id)=>document.getElementById(id).disabled;
function offerDraw(){
  if(gameOver||actOff('draw-btn'))return;
  if(gameMode==='team')return tmVoteStart('draw');
  aiOffers++;
  if(aiLevel==='boss'){updateTurn();return voteNote(aiName()+'가 무승부를 거절했습니다 — 끝까지 둬라!');} // the boss never takes a draw
  // other AIs take the draw when they have no open window with 3+ of their stones
  if(TeamLogic.bestWindow(board,aiPlayer)>2){updateTurn();return voteNote('AI가 무승부를 거절했습니다 — 게임이 계속됩니다!');}
  gameOver=true; aiLearn(0); updateTurn(); clockDraw();
  showDrawOverlay(`합의 무승부 (${aiName()} 수락)`);
}
function resign(){
  if(gameOver||actOff('resign-btn'))return;
  if(gameMode==='ai'&&aiLevel==='boss')return voteNote(aiName()+'가 항복을 거절했습니다 — 끝까지 둬라!'); // the boss never accepts a resignation
  if(!confirm('정말 항복할까요?'))return; // disabled mid table-flip: the flip already learned this game as an AI loss
  if(gameMode==='team')return tmVoteStart('resign');
  gameOver=true; scores[aiPlayer]++; updateScores(); aiLearn(aiPlayer); updateTurn(); clockDraw(); // learned as an AI win
  announce('항복');
  showEndOverlay('항복 패배',aiName()+'에게 항복했습니다.');
}

function updateScores(){
  document.getElementById('score-black').textContent=scores[1];
  document.getElementById('score-white').textContent=scores[2];
}

// result title: "AI 대전 · 어려움" in AI mode, otherwise the given default
function resultTitle(def){
  document.querySelector('#overlay .modal-title').textContent=gameMode==='ai'?'AI 대전 · '+levelName():def;
}

function showWinOverlay(player){
  const overlay=document.getElementById('overlay');
  const stone=document.getElementById('modal-stone');
  const winner=document.getElementById('modal-winner');
  const sub=document.getElementById('modal-sub');
  stone.className=`modal-stone ${player===1?'black-stone':'white-stone'}`;
  stone.style.background=''; stone.style.boxShadow=''; stone.style.width=''; stone.style.height='';
  const isHuman=player===humanPlayer; // AI games only (rooms use tmShowEnd)
  winner.textContent=isHuman?(meName()?meName()+' ':'')+'승리! 🎉':aiName()+' 승리!';
  sub.textContent=isHuman?'당신이 이겼습니다!':'🤖 AI가 이겼습니다';
  resultTitle('승리');
  if(gameMode==='ai'&&aiLevel==='boss'&&!isHuman){ // lost to the boss: his portrait + "패배"
    stone.className='modal-stone';
    stone.style.cssText='width:140px;height:140px;background:url(img/wonjun-win.jpg) center/cover;box-shadow:0 4px 20px rgba(0,0,0,0.8),0 0 30px rgba(255,220,50,0.4);';
    winner.textContent='패배';
    sub.textContent='JOONSAMA의 지능을 넘지 못했습니다';
  }
  showOverlay('overlay');
}

function showDrawOverlay(sub){ showEndOverlay('무승부!',sub||'보드가 가득 찼습니다'); }

function closeOverlay(){ hideOverlay('overlay'); if(gameOver) orderOk = true; }

// AI: back to the colour picker with the same level and time, titled with the game being replayed (team: host restarts into the lobby)
function rematch(){
  if(gameMode==='team') return tmRematch();
  closeOverlay(); clockStop();
  again=true; selTitle(); showOverlay('select-overlay');
}

function showEndOverlay(title,sub){
  const stone=document.getElementById('modal-stone');
  stone.className='modal-stone';
  stone.style.cssText='background:linear-gradient(135deg,#222 50%,#ccc 50%)';
  document.getElementById('modal-winner').textContent=title;
  document.getElementById('modal-sub').textContent=sub;
  resultTitle('승리');
  showOverlay('overlay');
}

function newGame(){
  const inGame=!gameOver&&board.some(r=>r.some(Boolean))&&(gameMode==='ai'||(gameMode==='team'&&TM&&TM.started));
  if(inGame&&!confirm('진행 중인 대국을 종료하고 나가시겠습니까?'))return;
  closeOverlay();
  tmLeave(); clockStop();
  document.getElementById('conn-status').style.display='none';
  showOverlay('mode-overlay');
}

function resetScore(){ if((scores[1]||scores[2])&&!confirm('전적을 초기화할까요?'))return; scores={1:0,2:0}; updateScores(); }

// ─── INPUT HANDLING ───────────────────────────────────────────
clickCanvas.addEventListener('mousemove',(e)=>{
  const isMyTurn = myTurn();
  if(gameOver||!isMyTurn||aiThinking){ghost.style.display='none';return;}
  const rect=clickCanvas.getBoundingClientRect();
  const scaleX=CANVAS_SIZE/rect.width,scaleY=CANVAS_SIZE/rect.height;
  const x=(e.clientX-rect.left)*scaleX,y=(e.clientY-rect.top)*scaleY;
  const pos=colRowFromXY(x,y);
  if(pos&&board[pos.row][pos.col]===0){
    ghost.style.display='block';
    ghost.style.left=(MARGIN+pos.col*CELL)+'px';
    ghost.style.top=(MARGIN+pos.row*CELL)+'px';
    const myStone=myStoneColor();
    ghost.className=`ghost-stone ${myStone===1?'black-ghost':'white-ghost'}`;
    clickCanvas.style.cursor='pointer';
  } else { ghost.style.display='none'; clickCanvas.style.cursor='default'; }
});

clickCanvas.addEventListener('mouseleave',()=>{ghost.style.display='none';});

// Keyboard play: arrows move the cursor, Enter/Space place a stone
const kbCursor = document.getElementById('kb-cursor');
let kb = {row: 7, col: 7};
function kbShow() {
  kbCursor.style.display = 'block';
  kbCursor.style.left = (MARGIN + kb.col * CELL) + 'px';
  kbCursor.style.top = (MARGIN + kb.row * CELL) + 'px';
  const isMyTurn = myTurn();
  if (!gameOver && isMyTurn && !aiThinking && board[kb.row][kb.col] === 0) {
    const myStone = myStoneColor();
    ghost.style.display = 'block';
    ghost.style.left = kbCursor.style.left; ghost.style.top = kbCursor.style.top;
    ghost.className = `ghost-stone ${myStone === 1 ? 'black-ghost' : 'white-ghost'}`;
  } else ghost.style.display = 'none';
}
function kbHide() { kbCursor.style.display = 'none'; ghost.style.display = 'none'; }
clickCanvas.addEventListener('focus', () => { if (document.activeElement === clickCanvas && clickCanvas.matches(':focus-visible')) kbShow(); });
clickCanvas.addEventListener('blur', kbHide);
clickCanvas.addEventListener('mousedown', kbHide);
clickCanvas.addEventListener('keydown', (e) => {
  const d = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]}[e.key];
  if (d) {
    e.preventDefault();
    kb.row = Math.max(0, Math.min(BOARD_SIZE - 1, kb.row + d[0]));
    kb.col = Math.max(0, Math.min(BOARD_SIZE - 1, kb.col + d[1]));
    kbShow();
    const v = board[kb.row][kb.col];
    announce(coordName(kb.row, kb.col) + (v ? (v === 1 ? ', 흑돌' : ', 백돌') : ', 빈 칸'));
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (boardTap(e)) handleClick(kb.row, kb.col);
    kbShow();
  }
});

// A tap made while the opponent (AI) was moving is queued by the browser during the AI's blocking search and arrives
// once it is my turn: drop it, and any tap within TAP_GRACE ms of my turn starting. After a finished game: move numbers.
const TAP_GRACE = 200;
function boardTap(e) {
  if (gameOver) { if (orderOk && seq.length) stonesLayer.classList.toggle('show-order'); return false; }
  return !aiThinking && e.timeStamp >= turnAt + TAP_GRACE;
}
clickCanvas.addEventListener('click',(e)=>{
  if(!boardTap(e))return;
  const rect=clickCanvas.getBoundingClientRect();
  const scaleX=CANVAS_SIZE/rect.width,scaleY=CANVAS_SIZE/rect.height;
  const x=(e.clientX-rect.left)*scaleX,y=(e.clientY-rect.top)*scaleY;
  const pos=colRowFromXY(x,y);
  if(pos)handleClick(pos.row,pos.col);
});

clickCanvas.addEventListener('touchend',(e)=>{
  e.preventDefault();
  if(!boardTap(e))return;
  const touch=e.changedTouches[0];
  const rect=clickCanvas.getBoundingClientRect();
  const scaleX=CANVAS_SIZE/rect.width,scaleY=CANVAS_SIZE/rect.height;
  const x=(touch.clientX-rect.left)*scaleX,y=(touch.clientY-rect.top)*scaleY;
  const pos=colRowFromXY(x,y);
  if(pos)handleClick(pos.row,pos.col);
});

// Enter key for room join
document.getElementById('team-code').addEventListener('keydown',(e)=>{
  if(e.key==='Enter')teamJoin();
});

function scaleBoard(){
  const narrow=window.matchMedia('(max-width: 900px)').matches;
  // chrome = side panels/gaps/paddings around the board (see @media above)
  // innerWidth is inflated on mobile while the unscaled board overflows; screen.width is not
  const vw=Math.min(window.innerWidth,screen.width);
  const maxW=narrow?vw-52:Math.min(window.innerWidth-520,700);
  const maxH=narrow?Math.max(window.innerHeight-300,300):window.innerHeight-200;
  const scale=Math.max(0.3,Math.min(maxW/CANVAS_SIZE,maxH/CANVAS_SIZE,1));
  const surface=document.getElementById('board-surface');
  surface.style.transform=`scale(${scale})`;
  surface.style.transformOrigin='top left';
  // transform doesn't change layout size: shrink layout box so wrap/indicators fit
  surface.style.marginRight=surface.style.marginBottom=-(CANVAS_SIZE*(1-scale))+'px';
}
window.addEventListener('resize',scaleBoard);
window.addEventListener('orientationchange',scaleBoard);

// ─── THEME (attribute set before paint by the inline script in index.html) ───
function setTheme(t, save) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = t === 'light' ? '#f2f2f2' : '#161616';
  document.getElementById('theme-btn').setAttribute('aria-pressed', t === 'dark');
  if (save) try { localStorage.setItem('ohohmok-theme', t); } catch (e) {}
}
function toggleTheme() { setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true); }

// ─── PROFILE (global Profile from profile.js; the page works without it) ───
const hasProfile = () => typeof Profile !== 'undefined';
// AI mode: my photo on my color once picked, default stone for the AI (boss photos win via !important)
function aiStones(picked) {
  if (!hasProfile()) return;
  Profile.setStone(humanPlayer, picked ? Profile.photo() : null);
  Profile.setStone(aiPlayer, null);
}
function toggleProfileMenu(open) {
  const m = document.getElementById('profile-menu'), btn = document.getElementById('profile-btn');
  if (open === undefined) open = m.hidden;
  m.hidden = !open; btn.setAttribute('aria-expanded', open);
  if (open) { gsiButton(); m.querySelector('button:not([hidden])').focus(); } else if (m.contains(document.activeElement)) btn.focus();
}
document.addEventListener('click', (e) => { if (!document.getElementById('profile-wrap').contains(e.target)) toggleProfileMenu(false); });
function profileMsg(t) { document.getElementById('pm-msg').textContent = t; if (t) announce(t); }
let gsiState = ''; // '' | 'ok' | 'fail': official Google button is rendered once, on first menu open (no GIS request on page load)
function gsiButton() {
  if (gsiState || Profile.signedIn()) return;
  gsiState = 'ok';
  Profile.renderButton(document.getElementById('pm-gsi')).catch(e => { gsiState = 'fail'; profileMsg((e && e.message) || '로그인하지 못했습니다'); renderProfile(); });
}
function profileLogin() {
  profileMsg('');
  if (Profile.signedIn()) { Profile.logout(); document.querySelector('#profile-menu button:not([hidden])').focus(); return; }
  Promise.resolve().then(() => Profile.login()).catch(e => profileMsg((e && e.message) || '로그인하지 못했습니다')); // rejects in Korean when One Tap is skipped
}
function profileUpload(input) {
  const f = input.files[0]; input.value = '';
  if (!f) return;
  profileMsg('');
  Profile.upload(f).catch(e => profileMsg((e && e.message) || '사진을 올리지 못했습니다'));
}
function renderProfile() {
  const src = Profile.photo(), btn = document.getElementById('profile-btn');
  btn.style.backgroundImage = src ? `url("${src}")` : ''; // src is validated by Profile (TeamLogic.validAvatar charset: no CSS injection)
  btn.classList.toggle('has-photo', !!src);
  const inG = Profile.signedIn(), login = document.getElementById('pm-login');
  login.textContent = inG ? `로그아웃 (${Profile.name() || 'Google'})` : 'Google 로그인';
  login.hidden = !inG && gsiState !== 'fail'; // signed out: the official button in #pm-gsi; the One Tap button only if it failed to load
  document.getElementById('pm-gsi').hidden = inG;
  if (!inG && !document.getElementById('profile-menu').hidden) gsiButton(); // signed out with the menu open (e.g. right after logout)
  document.getElementById('pm-clear').hidden = !Profile.hasUpload();
  document.getElementById('pm-hide').setAttribute('aria-pressed', Profile.hideOthers());
  if (gameMode === 'ai' && !document.getElementById('select-overlay').classList.contains('show')) { updateBadges(); updateTurn(); } // Google name may have changed
}
if (hasProfile()) {
  document.getElementById('profile-wrap').hidden = false;
  Profile.onChange(renderProfile);
  renderProfile();
}

// Init
setTheme(document.documentElement.dataset.theme);
initBoard(); updateTurn(); updateScores(); scaleBoard();
document.fonts.load(BOARD_FONT).then(drawBoard); // coordinates were drawn with the fallback before the pixel font arrived
showOverlay('mode-overlay');
