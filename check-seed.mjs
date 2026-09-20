// Однократная проверка seed 1789386357792: дороги от мостов не должны вести в тупик.
import { generateMap, STARTS } from './js/core/map-generator.js';
import { TILE } from './js/config/constants.js';

const SEED = 1789387645968;
const map = generateMap(SEED);
const key = (x, y) => `${x},${y}`;

console.log('seed:', SEED, '| fallback?', map.seedUsed === -1 ? 'ДА (детерминированная)' : 'нет');
console.log('мосты (x):', map.bridges.join(', '), '| riverY:', map.riverY);

// Значимые точки: выходы, метро, старты, другие мосты.
const basePoints = new Set([
  ...map.exits.flatMap((e) => e.cells.map((c) => key(c.x, c.y))),
  ...map.metroPairs.flat().map((p) => key(p.x, p.y)),
  key(STARTS.fugitive.x, STARTS.fugitive.y),
  key(STARTS.detective.x, STARTS.detective.y),
]);

const label = (k) => {
  for (const e of map.exits) if (e.cells.some((c) => key(c.x, c.y) === k)) return `выход ${e.kind}`;
  for (const p of map.metroPairs.flat()) if (key(p.x, p.y) === k) return 'метро';
  if (k === key(STARTS.fugitive.x, STARTS.fugitive.y)) return 'старт беглеца';
  if (k === key(STARTS.detective.x, STARTS.detective.y)) return 'старт детектива';
  return 'другой мост';
};

let allOk = true;
for (const bx of map.bridges) {
  const points = new Set(basePoints);
  for (const ox of map.bridges) {
    if (ox === bx) continue;
    points.add(key(ox, map.riverY));
    points.add(key(ox, map.riverY - 1));
    points.add(key(ox, map.riverY + 1));
  }
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return false;
    if (points.has(key(x, y))) return true;
    const t = map.tiles[y][x];
    return t === TILE.ROAD || t === TILE.EXIT || t === TILE.METRO || t === TILE.BRIDGE;
  };
  for (const dir of [-1, 1]) {
    const sy = map.riverY + dir;
    const side = dir === -1 ? 'верх' : 'низ';
    if (points.has(key(bx, sy))) { console.log(`мост x=${bx} ${side}: подход сам является точкой — OK`); continue; }
    const seen = new Set([key(bx, sy)]);
    const q = [{ x: bx, y: sy }];
    let hit = null;
    for (let i = 0; i < q.length && !hit; i++) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = q[i].x + dx, ny = q[i].y + dy;
        const k = key(nx, ny);
        if (seen.has(k) || !walkable(nx, ny)) continue;
        if (points.has(k)) { hit = { k, cells: seen.size }; break; }
        seen.add(k);
        q.push({ x: nx, y: ny });
      }
    }
    if (hit) console.log(`мост x=${bx} ${side}: достижимо → ${label(hit.k)} (${hit.cells} кл. пути) — OK`);
    else { console.log(`мост x=${bx} ${side}: ТУПИК (${seen.size} кл. пути, цели нет) — FAIL`); allOk = false; }
  }
}
console.log(allOk ? '\nИТОГ: все дороги от мостов ведут к цели — PASS' : '\nИТОГ: найдены тупики — FAIL');