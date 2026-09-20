import { CONFIG } from '../config/config.js';
import { TILE } from '../config/constants.js';

const blocksSight = (tile) => tile === TILE.WALL;

/** Bresenham: есть ли прямая линия взгляда между клетками. */
export function hasLineOfSight(map, a, b) {
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x0 === x1 && y0 === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) return true;   // сама цель не блокирует
    if (blocksSight(map.tiles[y0][x0])) return false;
  }
  return true;
}

/** Ромб радиуса 3 с учётом стен — используется и для беглеца, и для двойников. */
export function visibleCells(map, from) {
  const r = CONFIG.vision.detectiveRadius;
  const out = [];
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (Math.abs(x - from.x) + Math.abs(y - from.y) > r) continue;
      if (hasLineOfSight(map, from, { x, y })) out.push({ x, y });
    }
  }
  return out;
}
