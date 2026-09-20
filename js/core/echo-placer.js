import { CONFIG } from '../config/config.js';
import { ERR, TILE } from '../config/constants.js';
import { tileAt, isPassable } from './grid.js';
import { hasLineOfSight } from './visibility.js';

/**
 * v0.5.0 «эхо» — правила размещения двойника (GDD §8):
 *  • со 2-го хода беглеца;
 *  • только 1 на карте;
 *  • вне зоны видимости детектива (манхэттен радиус 3 + LOS сквозь стены);
 *  • на проходимой клетке, не занятой персонажами.
 */

/** Нужен ли двойник на этом ходу. */
export function echoRequired(turn, previousPath) {
  return turn >= CONFIG.echo.allowedFromTurn && !!previousPath;
}

/**
 * Проверка клетки для двойника.
 * @returns { ok: true } | { ok: false, error }
 */
export function validateEchoPlacement({ map, cell, detective, actors }) {
  if (!map || !cell) return { ok: false, error: ERR.IMPASSABLE };
  if (cell.x < 0 || cell.y < 0 || cell.x >= map.cols || cell.y >= map.rows) {
    return { ok: false, error: ERR.IMPASSABLE };
  }

  const tile = tileAt(map, cell.x, cell.y);
  if (!isPassable(tile)) return { ok: false, error: ERR.IMPASSABLE };
  // двойник не должен стартовать в финальной точке (в тике он в неё не заходит)
  if (tile === TILE.EXIT) return { ok: false, error: ERR.IMPASSABLE };

  // занятая персонажами клетка
  for (const who of ['fugitive', 'detective']) {
    const a = actors[who];
    if (a && a.x === cell.x && a.y === cell.y) return { ok: false, error: ERR.ECHO_OCCUPIED };
  }

  // вне видимости детектива: радиус + линия взгляда
  if (CONFIG.echo.requireOutsideVision && detective) {
    const dist = Math.abs(cell.x - detective.x) + Math.abs(cell.y - detective.y);
    if (dist <= CONFIG.vision.detectiveRadius && hasLineOfSight(map, detective, cell)) {
      return { ok: false, error: ERR.ECHO_IN_VISION };
    }
  }

  return { ok: true };
}

/** Есть ли хотя бы одна легальная клетка (иначе требование снимаем). */
export function hasLegalEchoCell({ map, detective, actors }) {
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (validateEchoPlacement({ map, cell: { x, y }, detective, actors }).ok) return true;
    }
  }
  return false;
}

/** Поставить двойника в клетку (вызывать только после успешной валидации). */
export function applyEchoPlacement(store, cell, previousPath) {
  const s = store.get();
  const e = s.actors.echo;
  e.x = cell.x;
  e.y = cell.y;
  e.path = previousPath.dirs.slice();
  e.start = { ...cell };
  e.active = true;
  e.captured = false;
  return e;
}
