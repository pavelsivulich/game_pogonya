import { ERR, TILE } from '../config/constants.js';
import {
  key, tileAt, isPassable, areAdjacent, metroPartner, metroCellsToMark, inBounds,
} from './grid.js';

/**
 * Контекст хода — единый источник правды для валидатора.
 * actor.path — накапливаемый массив шагов ({ landOn } и т.п.)
 * visited    — Set ключей клеток, уже отмеченных в этом ходу (старт включён)
 * enemyPos   — позиция врага (для беглеца — детектив); null у детектива
 * blockedExits — Set ключей сожжённых финальных точек
 */
export function createContext({ map, actor, enemyPos = null, blockedExits = new Set() }) {
  const visited = new Set([key(actor.x, actor.y)]); // старт уже «посещён»
  return { map, actor, enemyPos, blockedExits, visited };
}

/**
 * Проверка клика по клетке cell как следующего шага пути.
 * Возвращает { ok:true, landOn, marks[] } либо { ok:false, error }.
 * landOn — куда персонаж реально встанет (метро телепортит).
 * marks  — клетки, которые нужно отметить как посещённые.
 */
export function validateStep(ctx, cell) {
  const { map, actor, enemyPos, visited } = ctx;
  const path = actor.path;
  const from = path.length ? path[path.length - 1].landOn : { x: actor.x, y: actor.y };

  // 1. Соседство (шаг на месте запрещён — решение №2)
  if (!areAdjacent(from, cell)) {
    return { ok: false, error: ERR.NOT_ADJACENT };
  }

  // 2. Проходимость
  const tile = tileAt(map, cell.x, cell.y);
  if (!isPassable(tile)) {
    return { ok: false, error: ERR.IMPASSABLE };
  }

  // 3. Клетка врага недоступна (решение №1)
  if (enemyPos && cell.x === enemyPos.x && cell.y === enemyPos.y) {
    return { ok: false, error: ERR.ENEMY_CELL };
  }

  // 4. (v0.6.0) Заблокированный выход НЕ запрещён при программировании:
  //    беглец не знает о блокировке (GDD §9) — шаг разрешён, эффект сработает
  //    в резолвере (шаг сгорит, точка раскроется).

  // 5. Метро: шаг = телепорт на пару, гасятся ОБЕ клетки
  if (tile === TILE.METRO) {
    const partner = metroPartner(map, cell.x, cell.y);
    if (!partner) return { ok: false, error: ERR.IMPASSABLE };
    const marks = metroCellsToMark(map, cell.x, cell.y);
    if (marks.some((m) => visited.has(m))) return { ok: false, error: ERR.REVISIT };
    return { ok: true, landOn: partner, marks };
  }

  // 6. Запрет повторных клеток и стартовой клетки (стартовая уже в visited)
  if (visited.has(key(cell.x, cell.y))) {
    return {
      ok: false,
      error: key(cell.x, cell.y) === key(actor.x, actor.y) ? ERR.START_CELL : ERR.REVISIT,
    };
  }

  return { ok: true, landOn: cell, marks: [key(cell.x, cell.y)] };
}

export function hasLegalStep(ctx, cell) {
  return validateStep(ctx, cell).ok;
}

/** Юридически допустимые следующие клетки из позиции from. */
export function legalStepsFrom(ctx, from) {
  const { map } = ctx;
  const cand = [
    { x: from.x, y: from.y - 1 }, { x: from.x, y: from.y + 1 },
    { x: from.x - 1, y: from.y }, { x: from.x + 1, y: from.y },
  ];
  return cand.filter((c) => inBounds(map, c.x, c.y) && hasLegalStep(ctx, c));
}
