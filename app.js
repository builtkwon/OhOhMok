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
  renderTc();
  hideOverlay('rule-overlay');
  if (gameMode === 'ai') showOverlay('select-overlay'); else teamEntry();
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
      b.onclick = () => { RULE = RULE.k === 'b' ? {k: 'b', per: v} : {k: 'n', main: v}; renderTc(); };
    }
  });
}
renderTc();

const OVERLAYS = '.overlay.show,.select-overlay.show,.mode-overlay.show,.room-overlay.show';
let lastFocus = null;
function syncInert() {
  const open = document.querySelectorAll(OVERLAYS).length > 0;
  document.querySelector('header').inert = open;
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
  const on = (id) => document.getElementById(id).classList.contains('show');
  if (on('overlay')) closeOverlay();
  else if (on('team-overlay')) teamBack();
  else if (on('select-overlay')) { hideOverlay('select-overlay'); showOverlay('rule-overlay'); }
  else if (on('rule-overlay')) ruleBack();
});

// AI difficulty
const LEVEL_NAMES = {easy: '쉬움', normal: '보통', hard: '어려움', boss: 'æ 원준'};
let aiLevel = 'normal';
try { const v = localStorage.getItem('zestmok-level'); if (LEVEL_NAMES[v]) aiLevel = v; } catch (e) {}
function levelName() { return LEVEL_NAMES[aiLevel]; }
const aiName = () => aiLevel === 'boss' ? 'æ 원준' : 'ZAIST';
// boss mode: the AI's stones wear the boss's face (class = which color it plays)
let rage = false; // set by flipTable, cleared when a new fight starts
function applyBoss() { document.body.classList.toggle('rage', rage); document.body.classList.toggle('boss-1', gameMode === 'ai' && aiLevel === 'boss' && aiPlayer === 1); document.body.classList.toggle('boss-2', gameMode === 'ai' && aiLevel === 'boss' && aiPlayer === 2); }
function setLevel(l) {
  aiLevel = l;
  try { localStorage.setItem('zestmok-level', l); } catch (e) {}
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
  applyBoss();
  const nBlack = document.getElementById('name-black');
  const nWhite = document.getElementById('name-white');
  const lBlack = document.getElementById('label-black');
  const lWhite = document.getElementById('label-white');
  if (humanPlayer === 1) {
    nBlack.innerHTML = 'ZEST <span class="player-badge badge-human" id="badge-black">나</span>';
    nWhite.innerHTML = aiName()+' <span class="player-badge badge-ai" id="badge-white">AI · '+levelName()+'</span>';
  } else {
    nBlack.innerHTML = aiName()+' <span class="player-badge badge-ai" id="badge-black">AI · '+levelName()+'</span>';
    nWhite.innerHTML = 'ZEST <span class="player-badge badge-human" id="badge-white">나</span>';
  }
  lBlack.textContent = '흑돌 · 선공';
  lWhite.textContent = '백돌 · 후공';
}

// ─── BOARD ────────────────────────────────────────────────────
function initBoard() {
  aiHist = [];
  board = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(0));
  lastPlaced = null; winningCells = [];
  stonesLayer.innerHTML = '';
  stonesLayer.appendChild(ghost);
  drawBoard();
}

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
  ctx.fillStyle = 'rgba(90,60,20,0.7)';
  ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
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
  if (isLast) el.classList.add('last-placed');
  if (isWin) el.classList.add('winning');
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
function flashForbidden() {
  const t = document.getElementById('turn-text'), old = t.textContent;
  t.textContent = '금수 (쌍삼 · 장목) 자리입니다';
  announce('금수 자리입니다');
  setTimeout(() => { if (t.textContent === '금수 (쌍삼 · 장목) 자리입니다') t.textContent = old; }, 1200);
}
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
const memKey = () => 'zestmok-mem-' + aiLevel;
function aiMemLoad() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(memKey())); } catch (e) {}
  GomokuAI.setMemory(m);
}
function aiLearn(winner) {
  if (gameMode !== 'ai' || aiLevel === 'easy' || !aiHist.length) return;
  GomokuAI.learn(aiHist, aiPlayer, winner);
  try { localStorage.setItem(memKey(), JSON.stringify(GomokuAI.getMemory())); } catch (e) {} // full/blocked storage: learn for this tab only
  aiHist = [];
}
function doPlaceStone(row, col, triggerAi) {
  if (gameOver || board[row][col] !== 0) return;
  if (!clockMove(currentPlayer)) return timeUp(currentPlayer);
  if (gameMode === 'ai') aiHist.push({p: currentPlayer, row, col, key: GomokuAI.posKey(board, currentPlayer)});
  board[row][col] = currentPlayer;
  document.querySelectorAll('.stone.last-placed').forEach(e=>e.classList.remove('last-placed'));
  lastPlaced = {row, col};
  announce((currentPlayer===1?'흑돌 ':'백돌 ')+coordName(row,col)+' 착수');
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
  aiThinking = true; setAiThinking(true);
  setTimeout(()=>{
    const move = GomokuAI.bestMove(board, aiPlayer, aiLevel);
    aiThinking = false; setAiThinking(false);
    if (move && move.doomed && aiLevel === 'boss' && !flipUsed) return flipTable();
    if (move) doPlaceStone(move.row, move.col, false);
  }, 80);
}

// boss about to lose: flips the table once per fight (earthquake -> stones fly, board tips over -> board reassembles empty). Score untouched.
let flipUsed = false;
async function flipTable() {
  flipUsed = aiThinking = true;
  aiLearn(humanPlayer); // the flipped game = one AI loss (stored in all 4 rotations), recorded before the animation so leaving mid-flip still counts
  const B = board, wrap = document.querySelector('.board-wrap'), rm = matchMedia('(prefers-reduced-motion: reduce)').matches, rnd = (a) => (Math.random() - 0.5) * 2 * a;
  const say = document.body.appendChild(document.createElement('div'));
  say.innerHTML = '<img src="img/wonjun-rage.jpg" alt="" style="display:block;max-width:80vw;max-height:45vh;border-radius:10px;box-shadow:0 0 40px #c0392b;margin:0 auto 10px"><div>상 엎어!! (╯°□°)╯︵ ┻━┻</div>';
  say.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:50;pointer-events:none;text-align:center;font:800 clamp(1.4rem,6vw,2.6rem)/1.2 system-ui,sans-serif;color:#fff;text-shadow:0 0 12px #c0392b,0 2px 6px #000;white-space:nowrap';
  announce('원준이 상을 엎었습니다. 대국이 처음부터 다시 시작됩니다');
  if (rm) await new Promise(r => setTimeout(r, 1500));
  else {
    await wrap.animate(Array.from({length: 18}, () => ({transform: `translate(${rnd(14)}px,${rnd(14)}px) rotate(${rnd(1.5)}deg)`})), {duration: 900}).finished; // earthquake
    document.querySelectorAll('#stones-layer .stone').forEach(el => el.animate([{transform: 'translate(-50%,-50%)'}, {transform: `translate(-50%,-50%) translate(${rnd(400)}px,${-80 - Math.random() * 260}px) rotate(${rnd(720)}deg)`, opacity: 0}], {duration: 900, easing: 'ease-out', fill: 'forwards'}));
    await wrap.animate([{transform: 'none', opacity: 1}, {transform: 'perspective(900px) rotateX(80deg) translateY(60px)', opacity: 0}], {duration: 900, easing: 'ease-in', fill: 'forwards'}).finished; // board tips over
  }
  say.remove();
  if (board !== B || gameMode !== 'ai') { wrap.getAnimations().forEach(a => a.cancel()); return; } // player left mid-flip
  aiPlayer = 1; humanPlayer = 2; // AI always opens the restarted game (black)
  rage = true; updateBadges(); // AI stones = angry photo for this game only
  gameOver = false; currentPlayer = 1;
  initBoard(); clockStart(RULE); updateTurn();
  wrap.getAnimations().forEach(a => a.cancel());
  if (!rm) await wrap.animate([{transform: 'perspective(900px) rotateX(-80deg) scale(.8)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 600, easing: 'cubic-bezier(.34,1.56,.64,1)'}).finished; // reassembles
  aiThinking = false;
  setTimeout(doAiMove, 300);
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
  applyBoss();
  const dot=document.getElementById('turn-dot');
  const text=document.getElementById('turn-text');
  dot.style.background=currentPlayer===1?'#222':'#e8e0d0';
  dot.style.border=currentPlayer===2?'1px solid #999':'none';
  dot.style.boxShadow=currentPlayer===1?'0 0 6px rgba(0,0,0,0.8)':'0 0 6px rgba(255,255,255,0.6)';
  if(gameMode==='ai'){
    const isAiTurn=currentPlayer===aiPlayer;
    const name=currentPlayer===humanPlayer?'ZEST':aiName();
    text.textContent=isAiTurn?`${name} (AI) 차례`:`${name} 차례`;
  } else text.textContent=tmTurnText();
  if(document.activeElement===clickCanvas)kbShow();
  document.getElementById('card-black').classList.toggle('active',currentPlayer===1);
  document.getElementById('card-white').classList.toggle('active',currentPlayer===2);
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
  winner.textContent=isHuman?'ZEST 승리! 🎉':aiName()+' 승리!';
  sub.textContent=isHuman?'당신이 이겼습니다!':'🤖 AI가 이겼습니다';
  resultTitle('승리');
  if(gameMode==='ai'&&aiLevel==='boss'&&!isHuman){ // lost to the boss: his portrait + "패배"
    stone.className='modal-stone';
    stone.style.cssText='width:140px;height:140px;background:url(img/wonjun-win.jpg) center/cover;box-shadow:0 4px 20px rgba(0,0,0,0.8),0 0 30px rgba(255,220,50,0.4);';
    winner.textContent='패배';
    sub.textContent='æ 원준의 지능을 넘지 못했습니다';
  }
  showOverlay('overlay');
}

function showDrawOverlay(){
  const overlay=document.getElementById('overlay');
  document.getElementById('modal-stone').style.cssText='background:linear-gradient(135deg,#222 50%,#ccc 50%)';
  document.getElementById('modal-stone').style.boxShadow='0 4px 20px rgba(0,0,0,0.5)';
  document.getElementById('modal-winner').textContent='무승부!';
  document.getElementById('modal-sub').textContent='보드가 가득 찼습니다';
  resultTitle('승리');
  showOverlay('overlay');
}

function closeOverlay(){ hideOverlay('overlay'); }

function rematch(){ if(gameMode==='team') return tmRematch(); newGame(); }

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
    handleClick(kb.row, kb.col);
    kbShow();
  }
});

clickCanvas.addEventListener('click',(e)=>{
  if(gameOver||aiThinking)return;
  const rect=clickCanvas.getBoundingClientRect();
  const scaleX=CANVAS_SIZE/rect.width,scaleY=CANVAS_SIZE/rect.height;
  const x=(e.clientX-rect.left)*scaleX,y=(e.clientY-rect.top)*scaleY;
  const pos=colRowFromXY(x,y);
  if(pos)handleClick(pos.row,pos.col);
});

clickCanvas.addEventListener('touchend',(e)=>{
  if(gameOver||aiThinking)return;
  e.preventDefault();
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

// Init
initBoard(); updateTurn(); updateScores(); scaleBoard();
showOverlay('mode-overlay');
