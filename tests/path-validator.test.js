import { validateStep, createContext } from '../js/core/path-validator.js';
import { ERR, TILE } from '../js/config/constants.js';
import assert from 'node:assert/strict';

const mkMap = (over = {}, metroPairs = []) => {
  const cols = 6, rows = 6;
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(TILE.FLOOR));
  for (const [k, v] of Object.entries(over)) {
    const [x, y] = k.split(',').map(Number);
    tiles[y][x] = v;
  }
  return { cols, rows, tiles, metroPairs, exits: [] };
};

const ctx = (map, ax, ay, extra = {}) =>
  createContext({ map, actor: { x: ax, y: ay, path: [] }, ...extra });

// 1. соседство + шаг на месте запрещён
{
  const m = mkMap();
  assert.equal(validateStep(ctx(m, 1, 1), { x: 3, y: 3 }).error, ERR.NOT_ADJACENT);
  assert.equal(validateStep(ctx(m, 1, 1), { x: 1, y: 1 }).error, ERR.NOT_ADJACENT);
}
// 2. проходимость
{
  const m = mkMap({ '2,1': TILE.WALL, '1,2': TILE.RIVER });
  assert.equal(validateStep(ctx(m, 1, 1), { x: 2, y: 1 }).error, ERR.IMPASSABLE);
  assert.equal(validateStep(ctx(m, 1, 1), { x: 1, y: 2 }).error, ERR.IMPASSABLE);
}
// 3. клетка врага
{
  const m = mkMap();
  const c = ctx(m, 1, 1, { enemyPos: { x: 2, y: 1 } });
  assert.equal(validateStep(c, { x: 2, y: 1 }).error, ERR.ENEMY_CELL);
}
// 4. заблокированный выход (v0.6.0): клик РАЗРЕШЁН — беглец не знает о блоке (GDD §9)
{
  const m = mkMap({ '2,1': TILE.EXIT });
  const c = ctx(m, 1, 1, { blockedExits: new Set(['2,1']) });
  assert.equal(validateStep(c, { x: 2, y: 1 }).ok, true);
}
// 5. повтор и старт
{
  const m = mkMap();
  const c = ctx(m, 1, 1);
  c.visited.add('2,1');
  assert.equal(validateStep(c, { x: 2, y: 1 }).error, ERR.REVISIT);

  const m2 = mkMap();
  const c2 = ctx(m2, 1, 1);
  c2.actor.path = [{ landOn: { x: 2, y: 1 } }];
  c2.visited.add('2,1');
  assert.equal(validateStep(c2, { x: 1, y: 1 }).error, ERR.START_CELL);
}
// 6. метро: телепорт + гасятся обе клетки
{
  const m = mkMap({ '2,1': TILE.METRO, '4,4': TILE.METRO },
    [[{ x: 2, y: 1 }, { x: 4, y: 4 }]]);
  const c = ctx(m, 1, 1);
  const r = validateStep(c, { x: 2, y: 1 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.landOn, { x: 4, y: 4 });
  assert.deepEqual([...r.marks].sort(), ['2,1', '4,4']);
  r.marks.forEach((k) => c.visited.add(k));
  c.actor.path.push({ landOn: r.landOn });
}
// 6b. попытка использовать ту же пару повторно (соседние вход/выход)
{
  const m = mkMap({ '2,1': TILE.METRO, '3,1': TILE.METRO },
    [[{ x: 2, y: 1 }, { x: 3, y: 1 }]]);
  const c = ctx(m, 1, 1);
  const r = validateStep(c, { x: 2, y: 1 });
  assert.equal(r.ok, true);
  r.marks.forEach((k) => c.visited.add(k));
  c.actor.path.push({ landOn: r.landOn });
  // шаг с выхода (3,1) обратно на вход (2,1) — обе клетки сожжены
  assert.equal(validateStep(c, { x: 2, y: 1 }).error, ERR.REVISIT);
}
// 7. старт на входе метро → пара недоступна (вход уже visited)
{
  const m = mkMap({ '1,1': TILE.METRO, '4,4': TILE.METRO },
    [[{ x: 1, y: 1 }, { x: 4, y: 4 }]]);
  const c = ctx(m, 1, 1);
  assert.equal(c.visited.has('1,1'), true);
  // шаг с (1,1) на соседа (2,1) — обычный, метро не трогается
  assert.equal(validateStep(c, { x: 2, y: 1 }).ok, true);
}
console.log('path-validator: OK');
