// Per-loss diagnostics for tests/duel-record.js output (manual, slow). node tests/analyze-losses.js games.json
// For each boss loss: first boss move after which hard has a forced win (VCT probe, depth 10 / 4s - NOT exact, can miss or flip),
// whether hard was already winning before it, safe alternatives, hard's finishing fork (4-4 / 4-3 / 3-3), when the boss flagged doomed, timing.
const AI = require('../ai.js');
const games = require(require('path').resolve(process.argv[2]));
const N = 15, empty = () => Array.from({ length: N }, () => Array(N).fill(0));
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const COLS = 'ABCDEFGHJKLMNOP', nm = (r, c) => COLS[c] + (N - r);
AI.bestMove(empty(), 1, 'easy'); // koreanBlack = true: real rules (black restricted)
const TH = 4000; // ms per forced-win probe
const forced = (b, p, ms = TH) => AI.vct(b, p, 10, { t: Date.now() + ms });

function run(b, r, c, dr, dc, p) { let lo = 0, hi = 0; while (inside(r + dr * (lo - 1), c + dc * (lo - 1)) && b[r + dr * (lo - 1)][c + dc * (lo - 1)] === p) lo--; while (inside(r + dr * (hi + 1), c + dc * (hi + 1)) && b[r + dr * (hi + 1)][c + dc * (hi + 1)] === p) hi++; return { n: hi - lo + 1, lo, hi }; }
function four(b, r, c, dr, dc, p) { for (let k = 0; k < 5; k++) { const sr = r - dr * k, sc = c - dc * k; if (!inside(sr, sc) || !inside(sr + dr * 4, sc + dc * 4)) continue; let o = 0, x = 0; for (let i = 0; i < 5; i++) { const v = b[sr + dr * i][sc + dc * i]; if (v === p) o++; else if (v) x++; } if (o === 4 && !x) return true; } return false; }
function open3(b, r, c, dr, dc, p) { for (let k = -4; k <= 4; k++) { const er = r + dr * k, ec = c + dc * k; if (!k || !inside(er, ec) || b[er][ec]) continue; b[er][ec] = p; const x = run(b, er, ec, dr, dc, p); const ok = x.n === 4 && -k >= x.lo && -k <= x.hi && inside(er + dr * (x.lo - 1), ec + dc * (x.lo - 1)) && !b[er + dr * (x.lo - 1)][ec + dc * (x.lo - 1)] && inside(er + dr * (x.hi + 1), ec + dc * (x.hi + 1)) && !b[er + dr * (x.hi + 1)][ec + dc * (x.hi + 1)]; b[er][ec] = 0; if (ok) return true; } return false; }
const shape = (b, r, c, p) => { let f = 0, t = 0; for (const [dr, dc] of DIRS) { if (four(b, r, c, dr, dc, p)) f++; else if (open3(b, r, c, dr, dc, p)) t++; } return { f, t }; };
const label = ({ f, t }) => f >= 2 ? '4-4' : f && t ? '4-3' : t >= 2 ? '3-3' : f ? '4' : t ? '3' : '-';

const rows = [];
for (const g of games.filter(g => g.result === 'loss')) {
  const b = empty(); for (const [r, c, p] of g.open) b[r][c] = p;
  const bossC = g.bossBlack ? 1 : 2, hardC = 3 - bossC;
  const snaps = []; // board before each move
  for (const m of g.moves) { snaps.push(b.map(x => x.slice())); b[m.row][m.col] = m.p; }
  // fatal = first boss move after which hard has a forced win (probe), while before it hard had none
  let fatal = -1;
  for (let i = 0; i < g.moves.length; i++) {
    const m = g.moves[i]; if (m.who !== 'boss') continue;
    const s = snaps[i]; s[m.row][m.col] = m.p;
    const w = forced(s, hardC); s[m.row][m.col] = 0;
    if (w) { fatal = i; break; }
  }
  const info = { game: games.indexOf(g) + 1, bossColor: g.bossBlack ? 'black' : 'white', plies: g.moves.length };
  // hard's decisive fork: last hard move (before the five) that made a double threat
  const fin = g.moves.length - 1; let fork = '-', forkPly = -1;
  for (let i = fin - 1; i >= 0; i--) { const m = g.moves[i]; if (m.who !== 'hard') continue; const s = snaps[i]; s[m.row][m.col] = m.p; const sh = shape(s, m.row, m.col, m.p); s[m.row][m.col] = 0; const l = label(sh); if (['4-4', '4-3', '3-3'].includes(l)) { fork = l; forkPly = i; break; } }
  // winning five: did hard's five come after a four boss failed to block? (boss move at fin-1)
  info.finish = { fork, forkPly: forkPly + 1, lastHardMove: nm(g.moves[fin].row, g.moves[fin].col) };
  info.firstDoomed = g.moves.findIndex(m => m.who === 'boss' && m.doomed) + 1 || null;
  if (fatal >= 0) {
    const m = g.moves[fatal], s = snaps[fatal];
    // was hard already winning before this boss move? (then the error is earlier / boss had no defence)
    const prevThreat = !!forced(s, hardC);
    // safe alternatives at the fatal position
    const safe = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (s[r][c]) continue;
      let near = false; for (let i = -2; i <= 2 && !near; i++) for (let j = -2; j <= 2; j++) if (inside(r + i, c + j) && s[r + i][c + j]) { near = true; break; }
      if (!near || (bossC === 1 && AI.forbidden(s, r, c))) continue;
      s[r][c] = bossC; const lose = forced(s, hardC, 1500); s[r][c] = 0;
      if (!lose) safe.push(nm(r, c));
    }
    // what hard's threat looked like right after the fatal move: shape of hard's previous move and boss-move shape
    const hm = g.moves[fatal - 1];
    const hs = shape(s, hm.row, hm.col, hm.p); // hard's stone is already on s
    info.fatal = { ply: fatal + 1, pliesToEnd: g.moves.length - fatal, move: nm(m.row, m.col), ms: m.ms, doomedFlag: m.doomed,
      hardWinningBefore: prevThreat, hardPrevMove: nm(hm.row, hm.col) + ' ' + label(hs), safeAlternatives: safe.length, safeSample: safe.slice(0, 6) };
  } else info.fatal = null; // probe never saw the forced win: lost to something beyond VCT depth (positional / long)
  info.slowBossMoves = g.moves.filter(m => m.who === 'boss' && m.ms > 3500).length;
  info.maxBossMs = Math.max(...g.moves.filter(m => m.who === 'boss').map(m => m.ms));
  info.board = (() => { const o = b.map(r => r.map(v => '.XO'[v])); g.moves.forEach((m, i) => { if (i === fatal) o[m.row][m.col] = '!'; }); return o.map(r => r.join('')).join('\n'); })();
  rows.push(info);
  console.log(JSON.stringify(info, null, 1));
}
console.log('LOSSES', rows.length);
