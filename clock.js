// ─── CLOCK ────────────────────────────────────────────────────
// One clock for the current game (rules in team.js). AI games: only the human's time runs.
// Rooms: the host decides timeouts; guests just display the host's clock (t0 rebuilt from each snapshot).
let CLK = null; // {rule, side: {1: {main, per}, 2: {...}}, t0: local ms when the current turn started}
function clockStart(rule) {
  CLK = rule.k === 'n' && !rule.main ? null : {rule, side: {1: TeamLogic.clockInit(rule), 2: TeamLogic.clockInit(rule)}, t0: Date.now()};
  clockDraw();
}
function clockStop() { CLK = null; clockDraw(); }
const clockRuns = (color) => !!CLK && (gameMode !== 'ai' || color === humanPlayer);
// `color` just moved: charge its time and start the other side's turn. false = it had already run out.
function clockMove(color) {
  if (!CLK) return true;
  if (clockRuns(color)) {
    const n = TeamLogic.spend(CLK.rule, CLK.side[color], Date.now() - CLK.t0);
    if (!n) return false;
    CLK.side[color] = n;
  }
  CLK.t0 = Date.now();
  return true;
}
const fmtMs = (ms) => { const t = Math.ceil(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function clockDraw() {
  for (const c of [1, 2]) {
    const el = document.getElementById('clock-' + c);
    if (!clockRuns(c)) { el.textContent = ''; continue; }
    const live = !gameOver && currentPlayer === c && (gameMode === 'ai' || (TM && TM.started));
    const v = TeamLogic.view(CLK.rule, CLK.side[c], live ? Date.now() - CLK.t0 : 0);
    let low = false;
    if ('main' in v) el.textContent = '⏱ ' + fmtMs(v.main);
    else if (CLK.rule.k === 'b') { el.textContent = '⚡ ' + (v.byo / 1000).toFixed(1) + '초'; low = v.byo <= 3000; }
    else { el.textContent = `초읽기 ${Math.ceil(v.byo / 1000)}초 · ${v.per}회`; low = v.byo <= 10000 || v.per <= 1; }
    el.classList.toggle('low', live && low);
  }
}
function clockTick() {
  clockDraw();
  if (!CLK || gameOver || !clockRuns(currentPlayer)) return;
  if (gameMode === 'ai' ? aiThinking : !(TM && TM.started && TM.role === 'host')) return;
  if (Date.now() - CLK.t0 >= TeamLogic.budget(CLK.rule, CLK.side[currentPlayer])) timeUp(currentPlayer);
}
setInterval(clockTick, 100);
function timeUp(color) {
  if (gameMode !== 'ai') return tmHostTimeUp(color);
  gameOver = true; scores[aiPlayer]++; updateScores(); updateTurn(); clockDraw(); // ponytail: a timeout is not learned (it says nothing about the moves)
  announce('시간 초과 패배');
  showEndOverlay('시간 초과 패배', CLK.rule.k === 'b' ? `한 수 ${CLK.rule.per / 1000}초를 넘겼습니다.` : '초읽기를 모두 썼습니다.');
}
