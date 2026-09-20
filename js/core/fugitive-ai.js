import { CONFIG } from '../config/config.js';
import { TILE } from '../config/constants.js';
import { key, tileAt, inBounds } from './grid.js';
import { bfsPathMetro } from './pathfinding.js';
import { validateEchoPlacement } from './echo-placer.js';
import { hasLineOfSight } from './visibility.js';

const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * ИИ беглеца (GDD §10, «тупой и предсказуемый»):
 *  • ПОБЕГ   — цель ближайший свободный выход, путь BFS+метро, первые 5 шагов;
 *  • УКЛОНЕНИЕ — детектив в радиусе 5: с шансом 0.3 вставляем шаг отрыва;
 *  • ДВОЙНИК — со 2-го хода ставим эхо вне видимости детектива;
 *  • ЗАБЛОКИРОВАННАЯ ТОЧКА — узнав о блоке (revealedExits), цель пересчитывается.
 *
 * rand инжектится для тестовой детерминированности.
 */
export function createFugitiveAI({ rand = Math.random } = {}) {
  let targetExit = null;

  function chooseExit(s) {
    const { map, actors } = s;
    const f = actors.fugitive;
    let best = null;
    let bestLen = Infinity;
    for (const e of map.exits) {
      // блокировка известна ИИ только после достижения (как игроку в раунде 1)
      if (s.revealedExits.has(key(e.x, e.y))) continue;
      const p = bfsPathMetro(map, { x: f.x, y: f.y }, e);
      if (!p) continue;
      if (p.length < bestLen) { bestLen = p.length; best = e; }
    }
    return best;
  }

  /** Один ход ИИ: { dirs: string[], echoCell: {x,y}|null }. */
  function plan(s) {
    // цель живёт между ходами; сбрасываем при блоке/потере достижимости
    if (!targetExit || s.revealedExits.has(key(targetExit.x, targetExit.y))) {
      targetExit = chooseExit(s);
    }
    if (!targetExit) return { dirs: [], echoCell: null };

    const { map, actors } = s;
    const f = actors.fugitive, d = actors.detective;
    let path = bfsPathMetro(map, { x: f.x, y: f.y }, targetExit) ?? [];

    // УКЛОНЕНИЕ: детектив близко — иногда делаем шаг отрыва вместо пути
    if (manhattan(f, d) <= 5 && rand() < CONFIG.ai.fugitiveRandomTurnChance) {
      const evade = evasionStep(s, path);
      if (evade) path = [evade, ...path.slice(1)];
    }

    const dirs = path.slice(0, CONFIG.turn.fugitiveSteps);
    return { dirs, echoCell: chooseEchoCell(s) };
  }

  /** Шаг, увеличивающий дистанцию от детектива (иначе — случайный безопасный). */
  function evasionStep(s, path) {
    const { map, actors } = s;
    const f = actors.fugitive, d = actors.detective;
    const cur = manhattan(f, d);
    const cand = [];
    for (const [dx, dy, name] of [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']]) {
      const nx = f.x + dx, ny = f.y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const t = tileAt(map, nx, ny);
      if (t === TILE.WALL || t === TILE.RIVER) continue;
      if (nx === d.x && ny === d.y) continue;           // не идём к детективу
      if (t === TILE.EXIT) continue;                     // уклон — не в выход
      cand.push({ name, dist: Math.abs(nx - d.x) + Math.abs(ny - d.y) });
    }
    const better = cand.filter((c) => c.dist > cur).sort((a, b) => b.dist - a.dist);
    if (better.length) return better[0].name;
    // отрыв невозможен — не ломаем путь
    return path.length ? null : (cand.length ? cand[Math.floor(rand() * cand.length)].name : null);
  }

  /** Клетка для двойника: вне видимости детектива, валидная по правилам размещения. */
  function chooseEchoCell(s) {
    if (s.turn < CONFIG.echo.allowedFromTurn) return null;
    if (!s.pathHistory[s.turn - 1]) return null;
    const { map, actors } = s;
    const d = actors.detective;
    const cands = [];
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const cell = { x, y };
        if (!validateEchoPlacement({ map, cell, detective: d, actors: actors }).ok) continue;
        // ИИ предпочитает клетки подальше от детектива (иначе эхо бесполезен)
        const dist = manhattan(cell, d);
        if (dist <= CONFIG.vision.detectiveRadius + 1) continue;
        cands.push({ cell, dist, los: hasLineOfSight(map, d, cell) ? 1 : 0 });
      }
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.dist - a.dist || a.los - b.los);
    // топ-треть случайных кандидатов — предсказуемо, но не механистично
    const top = cands.slice(0, Math.max(1, Math.floor(cands.length / 3)));
    return top[Math.floor(rand() * top.length)].cell;
  }

  return { plan, reset: () => { targetExit = null; }, get target() { return targetExit; } };
}
