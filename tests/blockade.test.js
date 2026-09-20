// Тесты блокировки финальной точки (v0.6.0 «блокировка»).
import { chooseBlockadeAI } from '../js/core/blockade.js';
import { TILE } from '../js/config/constants.js';
import assert from 'node:assert/strict';

const mkMap = (exits, walls = []) => {
  const cols = 8, rows = 5;
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(TILE.FLOOR));
  for (const [x, y] of walls) tiles[y][x] = TILE.WALL;
  for (const e of exits) tiles[e.y][e.x] = TILE.EXIT;
  return { cols, rows, tiles, metroPairs: [], exits };
};

// 1. random: детерминированный rand → предсказуемый выбор
{
  const exits = [{ x: 7, y: 0 }, { x: 7, y: 4 }, { x: 4, y: 4 }];
  const m = mkMap(exits);
  assert.deepEqual(
    chooseBlockadeAI({ map: m, fugitiveStart: { x: 0, y: 0 }, strategy: 'random', rand: () => 0 }),
    exits[0], 'random: rand=0 → первый выход');
  assert.deepEqual(
    chooseBlockadeAI({ map: m, fugitiveStart: { x: 0, y: 0 }, strategy: 'random', rand: () => 0.99 }),
    exits[2], 'random: rand≈1 → последний выход');
}

// 2. nearest: ближайший по BFS
{
  const exits = [{ x: 7, y: 0 }, { x: 2, y: 4 }, { x: 7, y: 4 }];
  const m = mkMap(exits);
  assert.deepEqual(
    chooseBlockadeAI({ map: m, fugitiveStart: { x: 0, y: 0 }, strategy: 'nearest' }),
    exits[1], 'nearest: выбирает ближайший достижимый');
}

// 3. nearest: недостижимый выход игнорируется (стена-перегородка с проходом у дальнего)
{
  const exits = [{ x: 7, y: 0 }, { x: 7, y: 4 }];
  // стена x=4 во всех строках, кроме y=4 → к (7,0) пути нет, к (7,4) есть
  const walls = [[4, 0], [4, 1], [4, 2], [4, 3]];
  const m = mkMap(exits, walls);
  assert.deepEqual(
    chooseBlockadeAI({ map: m, fugitiveStart: { x: 0, y: 0 }, strategy: 'nearest' }),
    exits[1], 'nearest: обходит недостижимый');
}

// 4. пустые выходы → null; нет выходов при nearest → откат на random тоже null
{
  const m = mkMap([]);
  assert.equal(chooseBlockadeAI({ map: m, fugitiveStart: { x: 0, y: 0 }, strategy: 'nearest' }), null);
  assert.equal(chooseBlockadeAI({ map: m, fugitiveStart: { x: 0, y: 0 }, strategy: 'random' }), null);
}

// 5. результат всегда валидный выход карты (инвариант)
{
  const exits = [{ x: 7, y: 1 }, { x: 7, y: 3 }, { x: 3, y: 4 }];
  const m = mkMap(exits);
  for (const r of [0, 0.3, 0.5, 0.7, 0.999]) {
    const pick = chooseBlockadeAI({ map: m, fugitiveStart: { x: 0, y: 0 }, rand: () => r });
    assert.ok(exits.some((e) => e.x === pick.x && e.y === pick.y), 'random: всегда валидный выход');
  }
}

console.log('blockade: OK (5 групп)');
