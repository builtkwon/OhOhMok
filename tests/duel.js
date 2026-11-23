// Fixed-depth A-vs-B duel (manual): node tests/duel.js '<A json|level>' '<B json|level>' [pairs=20] [seed=1]
// Config = level name or JSON of LEVELS fields. ms defaults to 1e9 (pure fixed depth) ONLY if absent; vcf/vct budgets scale with ms, so give ms when vcf>0.
// Each random 4-ply opening is played twice with colors swapped (paired), games run sequentially. Prints A wins / B wins / draws and A's score %.
const AI = require('../ai.js');
const N = 15, empty = () => Array.from({ length: N }, () => Array(N).fill(0));
const cfg = (s) => { const base = AI.LEVELS[s]; return base ? { ...base } : JSON.parse(s); };
const A = cfg(process.argv[2]), B = cfg(process.argv[3]), PAIRS = +process.argv[4] || 20;
let seed = +process.argv[5] || 1; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
function five(b, r, c) { const p = b[r][c]; return [[0,1],[1,0],[1,1],[1,-1]].some(([dr,dc]) => { let n = 1; for (const s of [1,-1]) for (let k = 1; b[r+dr*s*k] && b[r+dr*s*k][c+dc*s*k] === p; k++) n++; return n >= 5; }); }
function opening() { const b = empty(), mv = []; let p = 1; while (mv.length < 4) { const r = 5 + Math.floor(rnd() * 5), c = 5 + Math.floor(rnd() * 5); if (b[r][c]) continue; b[r][c] = p; mv.push([r, c, p]); p = 3 - p; } return mv; }
function game(open, blackCfg, whiteCfg) {
  const b = empty(); for (const [r, c, p] of open) b[r][c] = p;
  let turn = 1; // 4 opening plies done -> black to move
  for (let t = 0; t < N * N - open.length; t++) {
    AI.LEVELS.__d = { ms: 1e9, ...(turn === 1 ? blackCfg : whiteCfg) };
    const m = AI.bestMove(b, turn, '__d');
    if (b[m.row][m.col]) { console.error('illegal', turn, m, '\n' + b.map(r => r.map(v => '.XO'[v]).join('')).join('\n')); process.exit(1); }
    b[m.row][m.col] = turn;
    if (five(b, m.row, m.col)) return turn;
    turn = 3 - turn;
  }
  return 0;
}
let a = 0, bw = 0, d = 0; const t0 = Date.now();
for (let i = 0; i < PAIRS; i++) {
  const o = opening();
  for (const aBlack of [true, false]) {
    const w = aBlack ? game(o, A, B) : game(o, B, A);
    if (!w) d++; else if ((w === 1) === aBlack) a++; else bw++;
  }
}
const n = a + bw + d;
console.log(`A=${JSON.stringify(A)} B=${JSON.stringify(B)}\n  A ${a} - B ${bw} (draw ${d}) of ${n}; A score ${(100 * (a + d / 2) / n).toFixed(0)}%  [${((Date.now() - t0) / 1000).toFixed(0)}s]`);
