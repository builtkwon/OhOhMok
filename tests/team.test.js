// Run: node tests/team.test.js
const assert = require('assert');
const T = require('../team.js');
const P = (id, team, online = true) => ({ id, name: id, team, online });
const seq = (ps, k) => { let t = { team: 1, n: { 1: 0, 2: 0 } }; const o = []; for (let i = 0; i < k; i++) { o.push(T.mover(ps, t).id); t = T.advance(t); } return o; };

// rotation: 2v2, 3v1, 1v2 (the "opp1 - me - opp2 - me" case)
assert.deepStrictEqual(seq([P('a', 1), P('b', 2), P('c', 1), P('d', 2)], 6), ['a', 'b', 'c', 'd', 'a', 'b']);
assert.deepStrictEqual(seq([P('a', 1), P('b', 1), P('c', 1), P('d', 2)], 6), ['a', 'd', 'b', 'd', 'c', 'd']);
assert.deepStrictEqual(seq([P('a', 1), P('x', 2), P('y', 2)], 6), ['a', 'x', 'a', 'y', 'a', 'x']);
// offline member is skipped, team keeps its turn order
assert.deepStrictEqual(seq([P('a', 1), P('b', 2), P('c', 1, false), P('d', 2)], 4), ['a', 'b', 'a', 'd']);
// nobody online in the team to move -> null
assert.strictEqual(T.mover([P('a', 1, false), P('b', 2)], { team: 1, n: { 1: 0, 2: 0 } }), null);

// wipe detection
assert.deepStrictEqual(T.wiped([P('a', 1, false), P('b', 2)]), [1]);
assert.deepStrictEqual(T.wiped([P('a', 1), P('b', 2)]), []);
assert.deepStrictEqual(T.wiped([P('a', 1, false), P('b', 2, false)]), [1, 2]);

// team limits: 3:1 allowed, 4:0 not; start needs both teams
const full3 = [P('a', 1), P('b', 1), P('c', 1), P('d', 2)];
assert(!T.canPick(full3, 'd', 1), 'team 1 is full (3)');
assert(T.canPick(full3, 'a', 1), 'already-in member can re-pick own team');
assert(T.canPick([P('a', 1), P('b', 1)], 'b', 2));
assert(T.canStart(full3).ok);
assert(!T.canStart([P('a', 1), P('b', 1)]).ok);
assert(!T.canStart([P('a', 1), P('b', 2, false)]).ok);
assert.strictEqual(T.autoTeam([P('a', 1)]), 2);
assert.strictEqual(T.autoTeam([]), 1);
assert.strictEqual(T.autoTeam([P('a', 1), P('b', 1), P('c', 1)]), 2);

// host migration: next online player in join order, skipping old host; wraps on retry
const ps = [P('h', 1), P('a', 2), P('b', 1, false), P('c', 2)];
assert.strictEqual(T.successor(ps, 'h', 0).id, 'a');
assert.strictEqual(T.successor(ps, 'h', 1).id, 'c');
assert.strictEqual(T.successor(ps, 'h', 2).id, 'a');
assert.strictEqual(T.successor([P('h', 1)], 'h', 0), null);

// move validation
const empty = () => Array.from({ length: 15 }, () => Array(15).fill(0));
const turn = { team: 1, n: { 1: 0, 2: 0 } }, two = [P('a', 1), P('b', 2)];
assert(T.validMove({ row: 7, col: 7 }, empty(), false, turn, two, 'a'));
assert(!T.validMove({ row: 7, col: 7 }, empty(), false, turn, two, 'b'), 'wrong player');
assert(!T.validMove({ row: '7', col: 7 }, empty(), false, turn, two, 'a'));
assert(!T.validMove({ row: 15, col: 0 }, empty(), false, turn, two, 'a'));
assert(!T.validMove({ row: 7, col: 7 }, empty(), true, turn, two, 'a'), 'game over');
assert(!T.validMove({ row: 7, col: 7 }, empty(), false, null, two, 'a'), 'not started');
const occ = empty(); occ[7][7] = 2;
assert(!T.validMove({ row: 7, col: 7 }, occ, false, turn, two, 'a'));

// snapshot validation + name cleanup
const snap = { hostId: 'a', started: false, players: two, turn: null, board: empty(), scores: { 1: 0, 2: 0 } };
assert(T.validSnap(snap));
assert(!T.validSnap({ ...snap, board: 'x' }));
assert(!T.validSnap({ ...snap, players: [{ id: 1 }] }));
assert(!T.validSnap({ ...snap, turn: { team: 3, n: {} } }));
assert.strictEqual(T.cleanName('  hello   world  and more '), 'hello world');
assert.strictEqual(T.cleanName(null), '');
// time control
{
  const N5 = { k: 'n', main: 300000 }, NO = { k: 'n', main: 0 }, B5 = { k: 'b', per: 5000 };
  assert(T.validRule(N5) && T.validRule(NO) && T.validRule(B5) && T.validRule({ k: 'b', per: 10000 }));
  assert(!T.validRule({ k: 'b', per: 7000 }) && !T.validRule({ k: 'n', main: -1 }) && !T.validRule(null));
  const c = T.clockInit(N5);
  assert.deepStrictEqual(c, { main: 300000, per: 3 });
  assert.strictEqual(T.budget(N5, c), 300000 + 3 * 30000);
  assert.deepStrictEqual(T.spend(N5, c, 1000), { main: 299000, per: 3 }, 'main time');
  const z = { main: 0, per: 3 };
  assert.deepStrictEqual(T.spend(N5, z, 29999), z, 'byo-yomi period kept if not used up');
  assert.deepStrictEqual(T.spend(N5, z, 30000), { main: 0, per: 2 }, 'one period used up');
  assert.deepStrictEqual(T.spend(N5, { main: 10000, per: 3 }, 75000), { main: 0, per: 1 }, 'main 10s + 2 periods');
  assert.strictEqual(T.spend(N5, { main: 0, per: 1 }, 30000), null, 'last period gone = lose');
  assert.strictEqual(T.spend(B5, T.clockInit(B5), 4999) !== null, true);
  assert.strictEqual(T.spend(B5, T.clockInit(B5), 5000), null, 'blitz: 5s = lose');
  assert.strictEqual(T.budget(NO, T.clockInit(NO)), Infinity, 'no limit');
  assert.deepStrictEqual(T.view(N5, { main: 10000, per: 3 }, 4000), { main: 6000 });
  assert.deepStrictEqual(T.view(N5, { main: 10000, per: 3 }, 45000), { byo: 25000, per: 2 });
  assert.deepStrictEqual(T.view(B5, T.clockInit(B5), 1200), { byo: 3800, per: 0 });
  assert(T.validClock(c) && !T.validClock({ main: 1, per: 9 }));
}
// avatar src validation (trust boundary: goes into CSS url("..."))
{
  const ok = 'https://lh3.googleusercontent.com/a/ACg8ocK_x-Y=s128-c';
  const d = (b) => 'data:image/jpeg;base64,' + b;
  assert(T.validAvatar(ok));
  assert(T.validAvatar(d('AAAA+/==')) && T.validAvatar('data:image/png;base64,iVBO') && T.validAvatar('data:image/webp;base64,UklG'));
  assert(T.validAvatar(d('A'.repeat(44000 - d('').length))), '44,000 chars ok');
  assert(!T.validAvatar(d('A'.repeat(44001 - d('').length))), 'oversize');
  for (const bad of [ok + '"', ok + ')', ok + ';', ok + ' x', ok + '\n', ok + '"); background:url(x', 'javascript:alert(1)',
    'https://lh3.googleusercontent.com.evil.com/a', 'https://evil.com/lh3.googleusercontent.com/a', 'http://lh3.googleusercontent.com/a',
    'https://lh4.googleusercontent.com/a', 'https://lh3.googleusercontent.com/', d('AA"A'), d('AA)A'), d('AA;A'), d('AA A'), d(''),
    'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGI+', 'data:image/jpeg,AAAA', ok + 'A'.repeat(44000), ' ' + d('AAAA'), '', null, undefined, 1, {}, ['x']])
    assert(!T.validAvatar(bad), 'rejects ' + String(bad).slice(0, 50));
}
// draw/resign (docs/draw-resign.md): open 5-cell windows + vote order
{
  const bw = T.bestWindow, b = empty();
  assert.strictEqual(bw(b, 1), 0, 'empty board: open windows with 0 stones');
  assert(!T.noMoves(b));
  b[7][7] = 1; b[7][8] = 1; b[7][9] = 1;
  assert.strictEqual(bw(b, 1), 3, 'three in an open window');
  assert.strictEqual(bw(b, 2), 0);
  // full board, no five: alternate pairs per row so no line holds 5 of a color
  const full = Array.from({ length: 15 }, (_, r) => Array.from({ length: 15 }, (_, c) => ((Math.floor(c / 2) + r) % 2) + 1));
  assert.strictEqual(bw(full, 1), -1); assert.strictEqual(bw(full, 2), -1);
  assert(T.noMoves(full), 'full board: no moves');
  // cells still empty but every window holds both colors
  const holes = full.map(r => r.slice()); holes[0][0] = 0; holes[14][14] = 0; holes[7][7] = 0;
  assert(T.noMoves(holes), 'empty cells left, nobody can make five');
  // one side blocked: white still has a free row
  const one = holes.map(r => r.slice()); one[3] = [2, 2, 0, 0, 0, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  assert.strictEqual(bw(one, 1), -1, 'black blocked'); assert.strictEqual(bw(one, 2), 2, 'white still has an open window');
  assert(!T.noMoves(one));
  // edge: windows must fit inside the board (4 cells at the edge are not a window)
  const edge = full.map(r => r.slice()); edge[0] = [0, 0, 0, 0, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1];
  assert.strictEqual(bw(edge, 1), -1);
  // vote: everyone online asked at once (minus who said yes) for a draw, own team only for resign; [] = passed
  const ps = [P('a', 1), P('b', 2), P('c', 1), P('d', 2, false), P('e', 2)];
  assert.deepStrictEqual(T.voteAsk(ps, 'draw', 1, ['a']), ['b', 'c', 'e'], 'draw: all at once, offline d excluded');
  assert.deepStrictEqual(T.voteAsk(ps, 'draw', 1, ['a', 'c']), ['b', 'e']);
  assert.deepStrictEqual(T.voteAsk(ps, 'draw', 1, ['a', 'c', 'b']), ['e']);
  assert.deepStrictEqual(T.voteAsk(ps, 'draw', 1, ['a', 'c', 'b', 'e']), [], 'everyone agreed');
  assert.deepStrictEqual(T.voteAsk(ps, 'resign', 2, ['b']), ['e'], 'resign: own team only');
  assert.deepStrictEqual(T.voteAsk(ps, 'resign', 2, ['b', 'e']), []);
  assert.deepStrictEqual(T.voteAsk([P('a', 1), P('b', 2)], 'resign', 1, ['a']), [], 'alone on the team: passes at once');
  assert.deepStrictEqual(T.voteAsk([P('a', 1), P('b', 2)], 'draw', 1, ['a']), ['b']);
  assert.deepStrictEqual(T.voteAsk([P('a', 1), P('c', 1, false), P('b', 2)], 'draw', 1, ['a']), ['b'], 'offline teammate skipped');
  // a draw needs the other team's consent: nobody of it online and nobody of it agreed -> null (refuse / cancel)
  assert.strictEqual(T.voteAsk([P('a', 1), P('b', 2, false)], 'draw', 1, ['a']), null, '1:1, opponent offline at start');
  assert.strictEqual(T.voteAsk([P('a', 1), P('c', 1), P('b', 2, false)], 'draw', 1, ['a', 'c']), null, 'opponent dropped mid-vote');
  assert.strictEqual(T.voteAsk([P('a', 1), P('c', 1, false), P('b', 2, false), P('d', 2, false)], 'draw', 1, ['a']), null, 'after a takeover everyone else is offline');
  assert.deepStrictEqual(T.voteAsk([P('a', 1), P('b', 2, false), P('d', 2)], 'draw', 1, ['a', 'd']), [], 'one opponent agreed, the other left: passes');
  assert.deepStrictEqual(T.voteAsk([P('a', 1), P('b', 2, false)], 'resign', 1, ['a']), [], 'resign needs no opponent');
  assert.strictEqual(T.VOTE_MAX, 2);
}
console.log('team tests passed');
