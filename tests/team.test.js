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
console.log('team tests passed');
