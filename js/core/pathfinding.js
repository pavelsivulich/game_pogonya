import { DIRS, inBounds, tileAt, isPassable, key, metroPartner } from './grid.js';
import { TILE } from '../config/constants.js';

/**
 * BFS по проходимым клеткам. Возвращает массив направлений от start к goal
 * (без самой стартовой клетки) или null, если путь недостижим.
 * blocked — необязательный Set ключей клеток, которые считаем непроходимыми.
 */
export function bfsPath(map, start, goal, blocked = null) {
  if (!map || !start || !goal) return null;
  if (start.x === goal.x && start.y === goal.y) return [];

  const passable = (x, y) => {
    if (!inBounds(map, x, y)) return false;
    if (!isPassable(tileAt(map, x, y))) return false;
    if (blocked && blocked.has(key(x, y))) return false;
    return true;
  };
  if (!passable(goal.x, goal.y)) return null;

  const prev = new Map([[key(start.x, start.y), null]]);
  const queue = [start];

  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const d of Object.values(DIRS)) {
      const nx = cur.x + d.dx, ny = cur.y + d.dy;
      const k = key(nx, ny);
      if (prev.has(k) || !passable(nx, ny)) continue;
      prev.set(k, { from: key(cur.x, cur.y), dir: d.name });
      if (nx === goal.x && ny === goal.y) return reconstruct(prev, k);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

function reconstruct(prev, goalKey) {
  const dirs = [];
  let k = goalKey;
  while (prev.get(k)) {
    const { from, dir } = prev.get(k);
    dirs.push(dir);
    k = from;
  }
  return dirs.reverse();
}

/**
 * BFS с телепортом метро: шаг на станцию = мгновенный перенос на пару.
 * Использует ИИ беглеца (GDD §10), чтобы считать реальные маршруты через метро.
 * Возвращает массив направлений (каждый «шаг» — одно направление).
 */
export function bfsPathMetro(map, start, goal) {
  if (!map || !start || !goal) return null;
  if (start.x === goal.x && start.y === goal.y) return [];

  const passable = (x, y) =>
    inBounds(map, x, y) && isPassable(tileAt(map, x, y));
  if (!passable(goal.x, goal.y)) return null;

  const prev = new Map([[key(start.x, start.y), null]]);
  const queue = [start];

  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const d of Object.values(DIRS)) {
      let nx = cur.x + d.dx, ny = cur.y + d.dy;
      if (!passable(nx, ny)) continue;
      if (tileAt(map, nx, ny) === TILE.METRO) {
        const p = metroPartner(map, nx, ny);
        if (p) { nx = p.x; ny = p.y; } // телепорт: встаём на парную станцию
      }
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, { from: key(cur.x, cur.y), dir: d.name });
      if (nx === goal.x && ny === goal.y) return reconstruct(prev, k);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}
