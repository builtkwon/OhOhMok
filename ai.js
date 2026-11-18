// Gomoku AI. board[r][c]: 0 empty, 1 black, 2 white. Win = 5+ in a row.
// Korean common rules for the AI's own play: when the AI is black it never plays a 3-3 (쌍삼) or a 6+ (장목);
// white is unrestricted. 4-4 is allowed. ponytail: a "three" whose completing point is itself forbidden still counts as a three.
// GomokuAI.bestMove(board, player, level) -> {row, col}; level: 'easy' | 'normal' | 'hard' | 'boss'.
(function (root) {
  const N = 15;
  const FIVE = 1e7;
  const V = [0, 2, 12, 120, 1500, FIVE]; // score of a 5-cell window by own stone count (no enemy stones in it)
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const LEVELS = {
    // easy: 1-ply, misses blocks. normal: shallow search. hard: deep search + forced-win (four-chain) search for both sides.
    easy:   { depth: 1, K: 5,  ms: 0,    vcf: 0 },
    normal: { depth: 3, K: 8,  ms: 600,  vcf: 0 },
    hard:   { depth: 8, K: 12, ms: 2500, vcf: 10 },
    boss:   { depth: 10, K: 16, ms: 4500, vcf: 14 }, // 원준: deeper/wider than hard
  };

  const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

  // static eval for player p: sum of p's windows minus the opponent's
  function evaluate(b, p) {
    let s = 0;
    for (const [dr, dc] of DIRS) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (!inside(r + dr * 4, c + dc * 4)) continue;
        let own = 0, opp = 0;
        for (let i = 0; i < 5; i++) {
          const v = b[r + dr * i][c + dc * i];
          if (v === p) own++; else if (v) opp++;
        }
        if (!opp) s += V[own]; else if (!own) s -= V[opp];
      }
    }
    return s;
  }

  // how much placing p at (r,c) improves p's windows
  function gain(b, r, c, p) {
    let g = 0;
    for (const [dr, dc] of DIRS) for (let k = 0; k < 5; k++) {
      const sr = r - dr * k, sc = c - dc * k;
      if (!inside(sr, sc) || !inside(sr + dr * 4, sc + dc * 4)) continue;
      let own = 0, opp = 0;
      for (let i = 0; i < 5; i++) {
        const v = b[sr + dr * i][sc + dc * i];
        if (v === p) own++; else if (v) opp++;
      }
      if (!opp) g += V[own + 1] - V[own];
    }
    return g;
  }

  // contiguous run of `p` through (r,c) along (dr,dc): {n, lo, hi} offsets from (r,c)
  function run(b, r, c, dr, dc, p) {
    let lo = 0, hi = 0;
    while (inside(r + dr * (lo - 1), c + dc * (lo - 1)) && b[r + dr * (lo - 1)][c + dc * (lo - 1)] === p) lo--;
    while (inside(r + dr * (hi + 1), c + dc * (hi + 1)) && b[r + dr * (hi + 1)][c + dc * (hi + 1)] === p) hi++;
    return { n: hi - lo + 1, lo, hi };
  }
  // after placing at (r,c): is there a way to make an open four (exactly 4, both ends empty) using this stone?
  function openThree(b, r, c, dr, dc, p) {
    for (let k = -4; k <= 4; k++) {
      const er = r + dr * k, ec = c + dc * k;
      if (!k || !inside(er, ec) || b[er][ec]) continue;
      b[er][ec] = p;
      const x = run(b, er, ec, dr, dc, p);
      const lr = er + dr * (x.lo - 1), lc = ec + dc * (x.lo - 1), hr = er + dr * (x.hi + 1), hc = ec + dc * (x.hi + 1);
      const open = x.n === 4 && -k >= x.lo && -k <= x.hi && inside(lr, lc) && !b[lr][lc] && inside(hr, hc) && !b[hr][hc];
      b[er][ec] = 0;
      if (open) return true;
    }
    return false;
  }
  // black at empty (r,c): exactly five wins (never forbidden); otherwise 6+ or 3-3 is forbidden
  function forbidden(b, r, c) {
    b[r][c] = 1;
    let five = false, over = false, threes = 0;
    for (const [dr, dc] of DIRS) { const n = run(b, r, c, dr, dc, 1).n; if (n === 5) five = true; else if (n > 5) over = true; }
    if (!five && !over) for (const [dr, dc] of DIRS) if (openThree(b, r, c, dr, dc, 1)) threes++;
    b[r][c] = 0;
    return !five && (over || threes >= 2);
  }
  function exactFive(b, r, c, p) {
    b[r][c] = p;
    const ok = DIRS.some(([dr, dc]) => run(b, r, c, dr, dc, p).n === 5);
    b[r][c] = 0;
    return ok;
  }
  const made5 = (b, r, c, p, rule) => DIRS.some(([dr, dc]) => { const n = run(b, r, c, dr, dc, p).n; return n === 5 || (n > 5 && !rule); });
  // empty cells that would complete a five for p, through (r,c) (p already placed there)
  function fiveCells(b, r, c, p, rule) {
    const out = [];
    for (const [dr, dc] of DIRS) for (let k = 0; k < 5; k++) {
      const sr = r - dr * k, sc = c - dc * k;
      if (!inside(sr, sc) || !inside(sr + dr * 4, sc + dc * 4)) continue;
      let own = 0, er = -1, ec = -1;
      for (let i = 0; i < 5; i++) { const v = b[sr + dr * i][sc + dc * i]; if (v === p) own++; else if (!v) { er = sr + dr * i; ec = sc + dc * i; } }
      if (own === 4 && er >= 0 && !out.some(x => x[0] === er && x[1] === ec) && !(rule && !exactFive(b, er, ec, p))) out.push([er, ec]);
    }
    return out;
  }
  function anyFive(b, p, rule) { // some empty cell where p makes five right now
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (b[r][c] !== p) continue;
      const f = fiveCells(b, r, c, p, rule);
      if (f.length) return f[0];
    }
    return null;
  }
  // cells that would give p a four (windows with 3 own + 2 empty, no enemy)
  function fourCells(b, p) {
    const seen = new Set(), out = [];
    for (const [dr, dc] of DIRS) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!inside(r + dr * 4, c + dc * 4)) continue;
      let own = 0, opp = 0;
      for (let i = 0; i < 5; i++) { const v = b[r + dr * i][c + dc * i]; if (v === p) own++; else if (v) opp++; }
      if (own !== 3 || opp) continue;
      for (let i = 0; i < 5; i++) { const x = r + dr * i, y = c + dc * i; if (!b[x][y] && !seen.has(x * N + y)) { seen.add(x * N + y); out.push([x, y]); } }
    }
    return out;
  }
  // Can p force a win with consecutive fours (VCF)? Returns the first move or null. Defender's only replies are the five-blocking cell.
  function vcf(b, p, d, dl) {
    if (d <= 0 || Date.now() > dl.t) return null;
    const q = 3 - p, rule = koreanBlack && p === 1, qrule = koreanBlack && q === 1;
    const now = anyFive(b, p, rule);
    if (now) return { row: now[0], col: now[1] };
    if (anyFive(b, q, qrule)) return null; // must defend first; not a pure four-chain
    for (const [r, c] of fourCells(b, p)) {
      if (rule && forbidden(b, r, c)) continue;
      b[r][c] = p;
      const f = fiveCells(b, r, c, p, rule);
      let win = f.length >= 2;
      if (!win && f.length === 1) {
        const [fr, fc] = f[0];
        b[fr][fc] = q;
        win = !made5(b, fr, fc, q, qrule) && !!vcf(b, p, d - 1, dl);
        b[fr][fc] = 0;
      }
      b[r][c] = 0;
      if (win) return { row: r, col: c };
    }
    return null;
  }
  let koreanBlack = false; // set per bestMove call: AI plays black under Korean rules

  // candidate moves near existing stones, best first. Forced moves (win / block five) are returned alone.
  function candidates(b, p, K) {
    const q = 3 - p, seen = new Uint8Array(N * N), list = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!b[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr, nc = c + dc;
        if (!inside(nr, nc) || b[nr][nc] || seen[nr * N + nc]) continue;
        seen[nr * N + nc] = 1;
        const rule = koreanBlack && p === 1;
        if (rule && forbidden(b, nr, nc)) continue;
        const gm = gain(b, nr, nc, p), go = gain(b, nr, nc, q);
        const win = gm >= FIVE - V[4] && (!rule || exactFive(b, nr, nc, 1));
        list.push({ row: nr, col: nc, win, block: go >= FIVE - V[4], pri: gm + go * 0.9 });
      }
    }
    const w = list.find(m => m.win);
    if (w) return [w];
    const blocks = list.filter(m => m.block);
    if (blocks.length) return blocks.slice(0, 2);
    list.sort((a, b2) => b2.pri - a.pri);
    return list.slice(0, K);
  }

  function negamax(b, depth, alpha, beta, p, K, dl) {
    if (Date.now() > dl.t) { dl.out = true; return 0; }
    if (depth === 0) return evaluate(b, p);
    const cands = candidates(b, p, K);
    if (!cands.length) return 0;
    if (cands[0].win) return FIVE + depth;
    let best = -Infinity;
    for (const m of cands) {
      b[m.row][m.col] = p;
      const s = -negamax(b, depth - 1, -beta, -alpha, 3 - p, K, dl);
      b[m.row][m.col] = 0;
      if (dl.out) return 0;
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function bestMove(b, p, level) {
    const L = LEVELS[level] || LEVELS.normal;
    koreanBlack = p === 1;
    const stones = b.flat().filter(Boolean).length;
    if (!stones) return { row: 7, col: 7 };
    if (stones === 1) { // answer next to the first stone
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (b[r][c]) {
        const d = [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [1, 0]][Math.floor(Math.random() * 6)];
        if (inside(r + d[0], c + d[1])) return { row: r + d[0], col: c + d[1] };
      }
    }
    const cands = candidates(b, p, L.K);
    if (!cands.length) { // every nearby cell is forbidden: any legal empty cell
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!b[r][c] && !(koreanBlack && p === 1 && forbidden(b, r, c))) return { row: r, col: c };
      return { row: 7, col: 7 };
    }
    if (cands[0].win) return cands[0];
    if (level === 'easy') {
      // always takes a win; blocks a five 50% of the time; otherwise a random pick among the top few
      if (cands[0].block && Math.random() < 0.5) return cands[0];
      const top = cands.slice(0, 4);
      return Math.random() < 0.5 ? top[0] : top[Math.floor(Math.random() * top.length)];
    }
    if (L.vcf) { // forced win for me, or stop the opponent's forced win
      const q = 3 - p, d0 = { t: Date.now() + L.ms * 0.5, out: false };
      const w = vcf(b, p, L.vcf, d0);
      if (w) return w;
      const threat = (pl) => vcf(b, pl, L.vcf, d0);
      if (threat(q)) {
        for (const m of candidates(b, p, 30)) {
          if (Date.now() > d0.t) break;
          b[m.row][m.col] = p;
          const safe = !threat(q);
          b[m.row][m.col] = 0;
          if (safe && Date.now() <= d0.t) return m;
        }
      }
    }
    let best = cands[0];
    const dl = { t: Date.now() + L.ms, out: false };
    for (let depth = 2; depth <= L.depth; depth++) {
      let iterBest = null, bs = -Infinity, alpha = -Infinity;
      const order = best ? [best, ...cands.filter(m => m !== best)] : cands;
      for (const m of order) {
        b[m.row][m.col] = p;
        const s = -negamax(b, depth - 1, -Infinity, -alpha, 3 - p, L.K, dl);
        b[m.row][m.col] = 0;
        if (dl.out) break;
        if (s > bs) { bs = s; iterBest = m; }
        if (bs > alpha) alpha = bs;
      }
      if (dl.out) break; // keep the last fully searched depth
      if (iterBest) best = iterBest;
      if (bs >= FIVE) break; // forced win found
    }
    return best;
  }

  const api = { bestMove, evaluate, forbidden };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GomokuAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
