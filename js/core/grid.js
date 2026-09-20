import { TILE } from '../config/constants.js';

export const DIRS = {
  up:    { dx: 0, dy: -1, name: 'up' },
  down:  { dx: 0, dy: 1, name: 'down' },
  left:  { dx: -1, dy: 0, name: 'left' },
  right: { dx: 1, dy: 0, name: 'right' },
};

export const key = (x, y) => `${x},${y}`;
export const parseKey = (k) => { const [x, y] = k.split(',').map(Number); return { x, y }; };

export const inBounds = (map, x, y) => x >= 0 && y >= 0 && x < map.cols && y < map.rows;
export const tileAt = (map, x, y) => (inBounds(map, x, y) ? map.tiles[y][x] : null);

export const isPassable = (tile) =>
  tile !== null && tile !== TILE.WALL && tile !== TILE.RIVER && tile !== TILE.RAIL;

export function neighbors(map, x, y) {
  const out = [];
  for (const d of Object.values(DIRS)) {
    const nx = x + d.dx, ny = y + d.dy;
    if (inBounds(map, nx, ny)) out.push({ x: nx, y: ny, dir: d.name });
  }
  return out;
}

export const areAdjacent = (a, b) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

/** Выход, которому принадлежит клетка (v0.11.0: выход = 2 клетки), или null.
 *  Поддержка старых карт без cells (тесты): считаем выходом саму клетку x/y. */
export function exitAt(map, x, y) {
  return map.exits?.find((e) => (e.cells ?? [e]).some((c) => c.x === x && c.y === y)) ?? null;
}

/** Метро: найти пару для клетки входа (или null). */
export function metroPartner(map, x, y) {
  for (const pair of map.metroPairs) {
    const [a, b] = pair;
    if (a.x === x && a.y === y) return { x: b.x, y: b.y };
    if (b.x === x && b.y === y) return { x: a.x, y: a.y };
  }
  return null;
}

/** Все клетки, которые «гасятся» при использовании метро-пары (обе). */
export function metroCellsToMark(map, x, y) {
  const p = metroPartner(map, x, y);
  return p ? [key(x, y), key(p.x, p.y)] : [key(x, y)];
}
