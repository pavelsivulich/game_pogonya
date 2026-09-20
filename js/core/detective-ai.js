import { CONFIG } from '../config/config.js';
import { bfsPath } from './pathfinding.js';
import { tileAt, isPassable } from './grid.js';
import { hasLineOfSight } from './visibility.js';

const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * ИИ детектива (GDD §10, баланс v0.8.1):
 *  • ПРЕСЛЕДОВАНИЕ — озарение или беглец в видимости; цель — сам беглец;
 *  • видимый двойник → идём к нему;
 *  • есть lastKnown и ещё не дошли → идём к последней позиции
 *    (дошли и не видим беглеца — улика исчерпана, сразу патруль);
 *  • ПАТРУЛЬ — движение туда-сюда между наблюдательными точками
 *    у двух незаблокированных выходов; дошёл до точки — разворот
 *    к другой в ЭТОМ ЖЕ ходу. Ожиданий нет: детектив всегда в деле.
 * Все состояния используют полный бюджет шагов (detectiveSteps).
 */
export function planDetectivePath(s) {
  const { map, actors } = s;
  const d = actors.detective, f = actors.fugitive, e = actors.echo;
  const maxSteps = CONFIG.turn.detectiveSteps;
  const sees = (a) =>
    manhattan(d, a) <= CONFIG.vision.detectiveRadius && hasLineOfSight(map, d, a);

  let target = null;
  const epiphany = d.epiphanyUntilTurn >= s.turn;

  if (epiphany || sees(f)) {
    target = { x: f.x, y: f.y };
    d.lastKnown = { x: f.x, y: f.y };
  } else if (e.active && !e.captured && sees(e)) {
    target = { x: e.x, y: e.y };
  } else if (d.lastKnown) {
    if (d.x === d.lastKnown.x && d.y === d.lastKnown.y) {
      d.lastKnown = null; // дошли до улики, бегльца нет — сразу патруль
    } else {
      target = { ...d.lastKnown };
    }
  }

  if (target) {
    const path = bfsPath(map, { x: d.x, y: d.y }, target);
    if (path) return path.slice(0, maxSteps);
    // цель недостижима — уходим в патруль
  }
  return patrolPath(s, maxSteps);
}

/**
 * Наблюдательные точки у выходов: ближайшая к выходу проходимая клетка
 * (не сам выход), с которой выход попадает в зону видимости детектива.
 * Заблокированные выходы игнорируются. Возвращает не более 2 точек.
 */
export function patrolPosts(s) {
  const { map } = s;
  const r = CONFIG.vision.detectiveRadius;
  // v0.11.0: выход двухклеточный — заблокирован, если занята любая его клетка
  const open = map.exits.filter((e) =>
    !(e.cells ?? [e]).some((c) => s.blockedExits.has(`${c.x},${c.y}`)));
  const posts = [];
  for (const e of open) {
    const cells = e.cells ?? [e];
    let best = null, bestD = Infinity;
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        if (cells.some((c) => c.x === x && c.y === y)) continue;  // не клетки выхода
        if (!isPassable(tileAt(map, x, y))) continue;
        const dist = Math.min(...cells.map((c) => manhattan({ x, y }, c)));
        if (dist < 1 || dist > r || dist >= bestD) continue;
        if (!cells.some((c) => hasLineOfSight(map, { x, y }, c))) continue; // выход должен быть виден
        best = { x, y }; bestD = dist;
      }
    }
    if (best) posts.push(best);
    if (posts.length === 2) break;
  }
  return posts;
}

/** Патруль туда-сюда между постами; использует весь бюджет шагов. */
function patrolPath(s, maxSteps) {
  const { map, actors } = s;
  const d = actors.detective;
  const posts = patrolPosts(s);
  if (!posts.length) return [];

  // стартовая цель — ближайший пост (или текущий, если уже выбран)
  let target = d.patrolTarget
    && posts.some((p) => p.x === d.patrolTarget.x && p.y === d.patrolTarget.y)
    ? { ...d.patrolTarget }
    : nearest(posts, d);

  const dirs = [];
  let pos = { x: d.x, y: d.y };
  let remaining = maxSteps;
  let guard = 0;
  while (remaining > 0 && guard++ < 4) {
    const path = bfsPath(map, pos, target);
    if (!path) { d.patrolTarget = null; break; }
    if (path.length > remaining) {
      dirs.push(...path.slice(0, remaining));
      break; // цель не достигнута — в следующий ход продолжим к ней
    }
    dirs.push(...path);
    remaining -= path.length;
    pos = { ...target };
    if (posts.length < 2) break; // один пост — разворачиваться не к чему
    target = posts.find((p) => !(p.x === pos.x && p.y === pos.y)) ?? posts[0];
  }
  d.patrolTarget = { ...target };
  return dirs;
}

const nearest = (cells, from) =>
  cells.reduce((best, c) => (manhattan(c, from) < manhattan(best, from) ? c : best), cells[0]);
