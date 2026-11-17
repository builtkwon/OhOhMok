// Difficulty ladder (manual, slow): node tests/ladder.js [aiPath] [gamesPerColor] [pairs]
// Reference results (6 games/color): easy~greedy, normal>>easy+greedy, hard>normal. Korean rules handicap AI black, so expect some draws.
// node ladder.js <aiPath> [games]
const path = require('path').resolve(process.argv[2] || __dirname + '/../ai.js'), G = +process.argv[3] || 6;
const AI = require(path);
const N = 15, empty = () => Array.from({ length: N }, () => Array(N).fill(0));
function five(b, r, c) { const p = b[r][c]; return [[0,1],[1,0],[1,1],[1,-1]].some(([dr,dc]) => { let n = 1; for (const s of [1,-1]) for (let k = 1; b[r+dr*s*k] && b[r+dr*s*k][c+dc*s*k] === p; k++) n++; return n >= 5; }); }
function greedy(b, p) { let best = null, bs = -Infinity; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (b[r][c]) continue; let near = false; for (let i=-1;i<=1;i++) for (let j=-1;j<=1;j++) if (b[r+i]&&b[r+i][c+j]) near = true; if (!near && b.flat().some(Boolean)) continue; b[r][c]=p; const s = AI.evaluate(b,p)+Math.random(); b[r][c]=0; if (s>bs){bs=s;best={row:r,col:c};} } return best || {row:7,col:7}; }
const player = (lv) => lv === 'greedy' ? greedy : (b, p) => AI.bestMove(b, p, lv);
function game(blackLv, whiteLv) { const b = empty(), pl = { 1: player(blackLv), 2: player(whiteLv) }; let turn = 1, ms = { 1: 0, 2: 0 }; for (let t = 0; t < N*N; t++) { const t0 = Date.now(); const m = pl[turn](b, turn); ms[turn] = Math.max(ms[turn], Date.now()-t0); if (b[m.row][m.col]) throw new Error('illegal'); b[m.row][m.col] = turn; if (five(b, m.row, m.col)) return { w: turn, ms }; turn = 3 - turn; } return { w: 0, ms }; }
function match(a, b2) { let aw = 0, bw = 0, mx = 0; for (let i = 0; i < G; i++) { const r1 = game(a, b2); if (r1.w === 1) aw++; else if (r1.w === 2) bw++; mx = Math.max(mx, r1.ms[1]); const r2 = game(b2, a); if (r2.w === 2) aw++; else if (r2.w === 1) bw++; mx = Math.max(mx, r2.ms[2]); } console.log(`${a} vs ${b2}: ${aw}-${bw} of ${2*G} (max move ${mx}ms)`); }
const pairs = (process.argv[4] || 'easy:greedy,normal:greedy,normal:easy,hard:greedy,hard:normal,hard:easy').split(',');
for (const p of pairs) match(...p.split(':'));
