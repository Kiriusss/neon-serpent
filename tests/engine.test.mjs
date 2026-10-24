import test from 'node:test';
import assert from 'node:assert/strict';
import { SnakeGame, SIZE } from '../dist/engine.js';

function makeGame(options = {}) {
  const events = [];
  const game = new SnakeGame({ random: () => .5, onEvent: (name, data) => events.push({ name, data }) });
  game.reset(options);
  game.start();
  game.food = [{ x: 20, z: 20, type: 'normal', id: 'distant' }];
  return { game, events };
}
function advance(game, seconds) {
  for (let remaining = seconds; remaining > 1e-9; remaining -= .025) game.update(Math.min(remaining, .025));
}
function foodAhead(game, type = 'normal') {
  const { x, z } = game.snake[0];
  game.food = [{ x: x + 1, z, type, id: `food-${game.eaten}` }];
}

test('reset places three distinct foods outside the initial snake and resets round state', () => {
  const game = new SnakeGame({ random: () => .5 });
  assert.equal(game.food.length, 3);
  assert.equal(new Set(game.food.map(f => `${f.x},${f.z}`)).size, 3);
  for (const food of game.food) assert.ok(!game.snake.some(s => s.x === food.x && s.z === food.z));
  game.start(); game.setBoost(true); game.update(.1); game.reset({ mode: 'infinity', difficulty: 'hard' });
  assert.equal(game.status, 'ready'); assert.equal(game.score, 0); assert.equal(game.energy, 100);
  assert.equal(game.boosting, false); assert.equal(game.queue.length, 0); assert.equal(game.mode, 'infinity');
});

test('eating grows by one, awards points, replenishes energy and replaces the food', () => {
  const { game, events } = makeGame(); game.energy = 50; foodAhead(game); game.step();
  assert.equal(game.snake.length, 8); assert.equal(game.score, 100); assert.equal(game.eaten, 1);
  assert.equal(game.energy, 66); assert.equal(game.food.length, 1);
  assert.deepEqual(events.find(e => e.name === 'eat').data.gain, 100);
});

test('direct reversals and repeated directions are rejected; queued legal corners execute one per step', () => {
  const { game } = makeGame();
  assert.equal(game.turn('left'), false); assert.equal(game.turn('right'), false);
  assert.equal(game.turn('up'), true); assert.equal(game.turn('down'), false);
  assert.equal(game.turn('left'), true); assert.equal(game.turn('down'), false);
  game.step(); assert.deepEqual(game.snake[0], { x: 12, z: 11 });
  game.step(); assert.deepEqual(game.snake[0], { x: 11, z: 11 });
  assert.equal(game.status, 'playing'); assert.equal(game.queue.length, 0);
});

test('classic walls remain lethal during phase boost', () => {
  const { game, events } = makeGame(); game.snake = [{ x: SIZE - 1, z: 5 }, { x: SIZE - 2, z: 5 }];
  game.boosting = true; game.step();
  assert.equal(game.status, 'dead'); assert.equal(game.boosting, false);
  assert.equal(events.filter(e => e.name === 'death').length, 1);
  game.step(); assert.equal(events.filter(e => e.name === 'death').length, 1);
});

test('infinity mode wraps correctly across each of the four edges', () => {
  const cases = [
    ['right', { x: 23, z: 5 }, { x: 0, z: 5 }],
    ['left', { x: 0, z: 5 }, { x: 23, z: 5 }],
    ['up', { x: 5, z: 0 }, { x: 5, z: 23 }],
    ['down', { x: 5, z: 23 }, { x: 5, z: 0 }],
  ];
  for (const [direction, start, expected] of cases) {
    const { game, events } = makeGame({ mode: 'infinity' });
    game.snake = [start]; game.direction = direction; game.step();
    assert.deepEqual(game.snake[0], expected); assert.equal(game.status, 'playing');
    assert.equal(events.filter(e => e.name === 'warp').length, 1);
  }
});

test('wrapped head still collides with the body at the destination', () => {
  const { game } = makeGame({ mode: 'infinity' });
  game.snake = [{ x: 23, z: 5 }, { x: 0, z: 5 }, { x: 0, z: 6 }]; game.step();
  assert.equal(game.status, 'dead'); assert.match(game.deathReason, /轨迹/);
});

test('self collision is lethal but entering the vacating tail is legal', () => {
  const { game } = makeGame();
  game.snake = [{ x: 2, z: 2 }, { x: 2, z: 3 }, { x: 3, z: 3 }, { x: 3, z: 2 }];
  game.step(); assert.equal(game.status, 'playing'); assert.deepEqual(game.snake[0], { x: 3, z: 2 });
  game.snake = [{ x: 2, z: 2 }, { x: 2, z: 3 }, { x: 3, z: 3 }, { x: 3, z: 2 }, { x: 4, z: 2 }];
  game.step(); assert.equal(game.status, 'dead');
});

test('active phase boost passes through body segments', () => {
  const { game } = makeGame();
  game.snake = [{ x: 2, z: 2 }, { x: 2, z: 3 }, { x: 3, z: 3 }, { x: 3, z: 2 }, { x: 4, z: 2 }];
  game.boosting = true; game.step();
  assert.equal(game.status, 'playing'); assert.deepEqual(game.snake[0], { x: 3, z: 2 });
});

test('boost applies a twofold scoring multiplier and drains finite energy', () => {
  const { game } = makeGame({ mode: 'infinity' }); foodAhead(game);
  game.setBoost(true); game.update(.1);
  assert.equal(game.score, 200); assert.equal(game.boosting, true); assert.equal(game.speed, 10.8);
  game.food = []; advance(game, 2.7);
  assert.ok(game.energy >= 0 && game.energy <= 100); assert.equal(game.boosting, false);
  assert.equal(game.boostRequested, false);
  const before = game.energy; advance(game, .2); assert.ok(game.energy > before);
});

test('pause freezes movement, clocks and energy and releases boost', () => {
  const { game } = makeGame(); game.setBoost(true); game.update(.05); game.pause();
  const snapshot = JSON.stringify({ snake: game.snake, elapsed: game.elapsed, energy: game.energy, accumulator: game.accumulator });
  game.update(.1); game.step(); assert.equal(game.turn('up'), false);
  assert.equal(JSON.stringify({ snake: game.snake, elapsed: game.elapsed, energy: game.energy, accumulator: game.accumulator }), snapshot);
  assert.equal(game.boosting, false); game.resume(); advance(game, .3);
  assert.equal(game.status, 'playing'); assert.ok(game.snake[0].x > 12);
});

test('normal frame progression moves six cells per second and clamps stalls', () => {
  const { game } = makeGame(); advance(game, 1.01);
  assert.equal(game.snake[0].x, 18);
  const elapsed = game.elapsed, x = game.snake[0].x;
  game.update(5); assert.ok(Math.abs(game.elapsed - elapsed - .1) < 1e-8);
  assert.ok(game.snake[0].x - x <= 1);
  const after = game.elapsed; game.update(-1); assert.equal(game.elapsed, after);
});

test('chain scoring increments up to 8x and expires after seven active seconds', () => {
  const { game } = makeGame({ mode: 'infinity' });
  for (let i = 0; i < 9; i++) { foodAhead(game); game.step(); }
  assert.equal(game.combo, 8); assert.equal(game.score, 4400);
  game.food = []; advance(game, 7.05); assert.equal(game.combo, 0); assert.equal(game.comboTime, 0);
  game.snake = [{ x: 10, z: 10 }]; game.direction = 'right'; foodAhead(game); game.step();
  assert.equal(game.combo, 1); assert.equal(game.score, 4500);
});

test('gold food scores 250 before multipliers, chrono slows for five active seconds', () => {
  const { game } = makeGame({ mode: 'infinity' });
  foodAhead(game, 'gold'); game.step(); assert.equal(game.score, 250);
  foodAhead(game, 'chrono'); game.step(); assert.equal(game.score, 450); assert.equal(game.slowTime, 5);
  assert.ok(Math.abs(game.speed - 3.72) < 1e-9);
  game.food = []; advance(game, 5.05); assert.equal(game.slowTime, 0); assert.equal(game.speed, 6);
});

test('level advances every five collected foods and emits one level event', () => {
  const { game, events } = makeGame();
  for (let i = 0; i < 5; i++) { foodAhead(game); game.step(); }
  assert.equal(game.level, 2); assert.equal(game.speed, 6.55);
  assert.equal(events.filter(e => e.name === 'level').length, 1);
});

test('food placement uses the final free cell and terminates when no space remains', () => {
  const { game } = makeGame(); game.snake = []; game.food = [];
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    if (x !== 23 || z !== 23) game.snake.push({ x, z });
  }
  assert.equal(game.spawnFood(), true); assert.deepEqual({ x: game.food[0].x, z: game.food[0].z }, { x: 23, z: 23 });
  assert.equal(game.spawnFood(), false);
});

test('filling every distinct board cell wins exactly once', () => {
  const { game, events } = makeGame(); game.snake = [{ x: 22, z: 23 }];
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    if (!(x === 22 && z === 23) && !(x === 23 && z === 23)) game.snake.push({ x, z });
  }
  foodAhead(game); game.step(); assert.equal(game.status, 'won'); assert.equal(game.snake.length, SIZE * SIZE);
  game.step(); assert.equal(events.filter(e => e.name === 'won').length, 1);
});

test('phase-created overlapping segments do not count as filling unoccupied cells', () => {
  const { game } = makeGame(); game.snake = [{ x: 22, z: 23 }];
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    if (!(x === 22 && z === 23) && !(x === 23 && z === 23) && !(x === 23 && z === 22)) game.snake.push({ x, z });
  }
  // A phase traversal can leave two body segments in one cell.
  game.snake.push({ x: 0, z: 0 });
  foodAhead(game); game.step();
  assert.equal(game.snake.length, SIZE * SIZE);
  assert.equal(new Set(game.snake.map(s => `${s.x},${s.z}`)).size, SIZE * SIZE - 1);
  assert.equal(game.status, 'playing');
});
