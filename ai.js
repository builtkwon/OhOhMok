// Gomoku AI (free rules: 5+ in a row wins). board[r][c]: 0 empty, 1 black, 2 white.
// GomokuAI.bestMove(board, player, level) -> {row, col}; level: 'easy' | 'normal' | 'hard'.
(function (root) {
  const N = 15;
  const FIVE = 1e7;
  const V = [0, 2, 12, 120, 1500, FIVE]; // score of a 5-cell window by own stone count (no enemy stones in it)
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const LEVELS = {
    easy:   { depth: 1, K: 6,  ms: 0 },
    normal: { depth: 2, K: 12, ms: 800 },
    hard:   { depth: 6, K: 10, ms: 1500 },
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

  // candidate moves near existing stones, best first. Forced moves (win / block five) are returned alone.
  function candidates(b, p, K) {
    const q = 3 - p, seen = new Uint8Array(N * N), list = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!b[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr, nc = c + dc;
        if (!inside(nr, nc) || b[nr][nc] || seen[nr * N + nc]) continue;
        seen[nr * N + nc] = 1;
        const gm = gain(b, nr, nc, p), go = gain(b, nr, nc, q);
        list.push({ row: nr, col: nc, win: gm >= FIVE - V[4], block: go >= FIVE - V[4], pri: gm + go * 0.9 });
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
    const stones = b.flat().filter(Boolean).length;
    if (!stones) return { row: 7, col: 7 };
    if (stones === 1) { // answer next to the first stone
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (b[r][c]) {
        const d = [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [1, 0]][Math.floor(Math.random() * 6)];
        if (inside(r + d[0], c + d[1])) return { row: r + d[0], col: c + d[1] };
      }
    }
    const cands = candidates(b, p, L.K);
    if (!cands.length) return { row: 7, col: 7 };
    if (cands[0].win) return cands[0];
    if (level === 'easy') {
      // always takes a win; blocks a five 70% of the time; otherwise a random pick among the top few
      if (cands[0].block && Math.random() < 0.7) return cands[0];
      const top = cands.slice(0, 4);
      return Math.random() < 0.5 ? top[0] : top[Math.floor(Math.random() * top.length)];
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

  const api = { bestMove, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GomokuAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
