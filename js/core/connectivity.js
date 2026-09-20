import { isPassable } from './grid.js';

/** BFS: множество ключей "x,y", достижимых из start. */
export function reachable(map, start) {
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows) continue;
      if (seen.has(k)) continue;
      if (!isPassable(map.tiles[ny][nx])) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

export const canReach = (map, from, to) => reachable(map, from).has(`${to.x},${to.y}`);
