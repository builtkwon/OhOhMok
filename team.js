// Team mode: pure logic (no DOM, no network). Tested in tests/team.test.js
// players: [{id, name, team: 1|2, online}] in join order. turn: {team: 1|2, n: {1: k, 2: k}}
(function (root) {
  const MAX_PLAYERS = 4, MAX_TEAM = 3, WIPE_MS = 10000, N = 15;
  const members = (ps, t) => ps.filter(p => p.team === t && p.online);

  // Who moves now: the team alternates; inside a team, online members rotate.
  function mover(players, turn) {
    const m = members(players, turn.team);
    return m.length ? m[turn.n[turn.team] % m.length] : null;
  }
  function advance(turn) {
    const n = { 1: turn.n[1], 2: turn.n[2] };
    n[turn.team]++;
    return { team: 3 - turn.team, n };
  }
  // Teams with nobody online (after this they have WIPE_MS to get someone back).
  const wiped = (ps) => [1, 2].filter(t => !members(ps, t).length);

  function canPick(ps, id, team) {
    return (team === 1 || team === 2) && ps.filter(p => p.team === team && p.id !== id).length < MAX_TEAM;
  }
  function canStart(ps) {
    const missing = [1, 2].find(t => !members(ps, t).length);
    return missing ? { ok: false, reason: (missing === 1 ? '흑' : '백') + '팀에 최소 1명이 필요합니다' } : { ok: true, reason: '' };
  }
  // Smaller team first (tie -> black), never a full one.
  function autoTeam(ps) {
    const c1 = ps.filter(p => p.team === 1).length, c2 = ps.filter(p => p.team === 2).length;
    return c1 <= c2 && c1 < MAX_TEAM ? 1 : 2;
  }
  // Host migration: k-th online non-host player in join order (k wraps).
  function successor(ps, hostId, k) {
    const c = ps.filter(p => p.id !== hostId && p.online);
    return c.length ? c[k % c.length] : null;
  }
  const cleanName = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 12).trim();

  function validMove(msg, board, over, turn, players, fromId) {
    const m = turn && mover(players, turn);
    return !over && !!m && m.id === fromId && !!msg &&
      Number.isInteger(msg.row) && Number.isInteger(msg.col) &&
      msg.row >= 0 && msg.row < N && msg.col >= 0 && msg.col < N && board[msg.row][msg.col] === 0;
  }
  function validSnap(m) {
    const t = (v) => v === 1 || v === 2;
    return !!m && typeof m.hostId === 'string' && typeof m.started === 'boolean' &&
      Array.isArray(m.players) && m.players.length <= MAX_PLAYERS &&
      m.players.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && t(p.team) && typeof p.online === 'boolean') &&
      (m.turn === null || (m.turn && t(m.turn.team) && m.turn.n && Number.isInteger(m.turn.n[1]) && Number.isInteger(m.turn.n[2]))) &&
      Array.isArray(m.board) && m.board.length === N &&
      m.board.every(r => Array.isArray(r) && r.length === N && r.every(v => v === 0 || v === 1 || v === 2)) &&
      !!m.scores && Number.isInteger(m.scores[1]) && Number.isInteger(m.scores[2]);
  }

  const api = { MAX_PLAYERS, MAX_TEAM, WIPE_MS, mover, advance, wiped, canPick, canStart, autoTeam, successor, cleanName, validMove, validSnap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TeamLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
