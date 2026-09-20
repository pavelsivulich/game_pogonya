// Регресс v0.12.1: достижение заблокированного выхода не должно ломать
// остаток запрограммированного пути (направления считались от клетки выхода).
import { stepFugitive } from '../js/core/turn-resolver.js';
import { TILE } from '../js/config/constants.js';
import assert from 'node:assert/strict';

// Карта 4x2: (2,0) — выход. Беглец стартует в (1,0).
const mkState = (blocked) => {
  const cols = 4, rows = 2;
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(TILE.FLOOR));
  tiles[0][2] = TILE.EXIT;
  const exit = { x: 2, y: 0, kind: 'station', cells: [{ x: 2, y: 0 }] };
  return {
    map: { cols, rows, tiles, metroPairs: [], exits: [exit] },
    blockedExits: new Set(blocked),
    revealedExits: new Set(),
  };
};

// 1. Побег в свободный выход работает как раньше.
{
  const s = mkState([]);
  const f = { x: 1, y: 0, isEscaped: false, blockedStop: false };
  stepFugitive(s, f, 'right', { emit() {} });
  assert.deepEqual({ x: f.x, y: f.y }, { x: 2, y: 0 }, 'свободный выход: вошли');
  assert.equal(f.isEscaped, true, 'свободный выход: побег');
}

// 2. БЛОК: шаг сгорает, позиция не меняется, выход раскрыт.
{
  const s = mkState(['2,0']);
  const f = { x: 1, y: 0, isEscaped: false, blockedStop: false };
  stepFugitive(s, f, 'right', { emit() {} });
  assert.deepEqual({ x: f.x, y: f.y }, { x: 1, y: 0 }, 'блок: не вошли');
  assert.equal(f.isEscaped, false, 'блок: не сбежал');
  assert.equal(f.blockedStop, true, 'блок: выставлен стоп');
  assert.ok(s.revealedExits.has('2,0'), 'блок: выход раскрыт');
}

// 3. РЕГРЕСС: остаток пути ПОСЛЕ блока не исполняется — иначе следующий
//    dir уводит беглеца на клетку от нужной (путь «съезжает»).
{
  const s = mkState(['2,0']);
  const f = { x: 1, y: 0, isEscaped: false, blockedStop: false };
  // путь: right (в блок) -> down. «down» программировался от (2,0) -> (2,1).
  stepFugitive(s, f, 'right', { emit() {} });
  stepFugitive(s, f, 'down', { emit() {} });
  assert.deepEqual({ x: f.x, y: f.y }, { x: 1, y: 0 },
    'остаток пути после блока не двигает беглеца (был баг: увод в (1,1))');
}

console.log('blockade-hit: OK (3 группы)');
