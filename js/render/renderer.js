import { COLORS, TILE, EXIT_KIND } from '../config/constants.js';
import { CONFIG } from '../config/config.js';
import { visibleCells } from '../core/visibility.js';
import { drawProgrammingOverlays } from './overlays.js';

const C = CONFIG.grid.cell;

/* --- Дороги (v0.11.0): атлас assets/roads.png — 4 тайла 40×40 в первом
 * столбце: 1) прямая С–Ю, 2) угол В–Ю, 3) Т-перекрёсток З–В–Ю, 4) «+».
 * Остальные варианты получают поворотом. Пока картинка не загружена —
 * процедурная отрисовка (fallback). --- */
const roadImg = new Image();
roadImg.src = 'assets/roads.png';
const ROAD_SRC = [
  { sx: 0, sy: 0 },    // 1: прямая север–юг
  { sx: 0, sy: 40 },   // 2: угол восток–юг
  { sx: 0, sy: 80 },   // 3: Т: запад–восток–юг (нет севера)
  { sx: 0, sy: 120 },  // 4: крестовина
];

/* --- Железная дорога (v0.12.0): тот же атлас assets/roads.png, 4-й столбец:
 * строка 1 (120,0) — основной путь; строка 2 (120,40) — участок НАПРОТИВ
 * клеток вокзала (клетка RAIL, над которой EXIT). --- */
const RAIL_SRC = { sx: 120, sy: 0 };
const RAIL_STATION_SRC = { sx: 120, sy: 40 };

/* --- Река (v0.12.0): тот же атлас, 4-й столбец: строка 3 (120,80) —
 * основной тайл, строка 4 (120,120) — дополнительный. Раскладку 16/4
 * в случайном порядке задаёт генератор (map.riverVariants). --- */
const RIVER_SRC = { sx: 120, sy: 80 };
const RIVER_ALT_SRC = { sx: 120, sy: 120 };

/* --- Мост (v0.12.0): тот же атлас, строка 4, столбец 3 (80, 120). --- */
const BRIDGE_SRC = { sx: 80, sy: 120 };

/* --- Метро (v0.12.0): атлас assets/locations.png (160×80, тайлы 40×40).
 * 1-й столбец: строка 1 (0,0) — для ПЕРВОЙ пары станций,
 * строка 2 (0,40) — для ВТОРОЙ пары. --- */
const metroImg = new Image();
metroImg.src = 'assets/locations.png';
const METRO_SRC = [
  { sx: 0, sy: 0 },   // пара 0
  { sx: 0, sy: 40 },  // пара 1
];

/* --- Вокзал (v0.12.0): тот же locations.png, строка 1: столбец 2 (40,0) —
 * левая клетка вокзала, столбец 3 (80,0) — правая (главная, у путей). --- */
const STATION_SRC = { left: { sx: 40, sy: 0 }, right: { sx: 80, sy: 0 } };

/** kind выхода, которому принадлежит клетка (или null). */
function exitKindAt(map, x, y) {
  const e = map.exits.find((ex) => ex.cells.some((c) => c.x === x && c.y === y));
  return e ? e.kind : null;
}

/* --- Порт (v0.12.0): locations.png, строка 2: столбец 2 (40,40) — левая
 * клетка (главная, к ней ведётся дорога), столбец 3 (80,40) — правая. --- */
const PORT_SRC = { left: { sx: 40, sy: 40 }, right: { sx: 80, sy: 40 } };

/** Тайл порта для клетки (или null, если клетка не из порта). */
function portTile(map, x, y) {
  const pt = map.exits.find((e) => e.kind === EXIT_KIND.PORT);
  if (!pt) return null;
  if (x === pt.x && y === pt.y) return PORT_SRC.left;          // главная — левая
  if (x === pt.cells[1].x && y === pt.cells[1].y) return PORT_SRC.right;
  return null;
}

/* --- Аэропорт (v0.12.0): locations.png, столбец 4: строка 1 (120,0) —
 * верхняя клетка, строка 2 (120,40) — нижняя (главная, к ней ведётся дорога). --- */
const AIRPORT_SRC = { top: { sx: 120, sy: 0 }, bottom: { sx: 120, sy: 40 } };

/** Тайл аэропорта для клетки (или null, если клетка не из аэропорта). */
function airportTile(map, x, y) {
  const ap = map.exits.find((e) => e.kind === EXIT_KIND.AIRPORT);
  if (!ap) return null;
  if (x === ap.x && y === ap.y) return AIRPORT_SRC.bottom;     // главная — нижняя
  if (x === ap.cells[1].x && y === ap.cells[1].y) return AIRPORT_SRC.top;
  return null;
}

/** Тайл вокзала для клетки (или null, если клетка не из вокзала). */
function stationTile(map, x, y) {
  const st = map.exits.find((e) => e.kind === EXIT_KIND.STATION);
  if (!st) return null;
  if (x === st.x && y === st.y) return STATION_SRC.right;      // главная — правая
  if (x === st.cells[1].x && y === st.cells[1].y) return STATION_SRC.left;
  return null;
}

/** Индекс метро-пары, которой принадлежит клетка (0/1), или -1. */
function metroPairIndex(map, x, y) {
  return map.metroPairs.findIndex(([a, b]) =>
    (a.x === x && a.y === y) || (b.x === x && b.y === y));
}

/* --- Беглец (v0.16.0): спрайт assets/criminal.png. Вправо — как есть,
 * влево — зеркально; вверх/вниз — сохраняется последнее горизонтальное
 * состояние (facing). Пока картинка не загружена — прежний белый круг. --- */
const criminalImg = new Image();
criminalImg.src = 'assets/criminal.png';

/* --- Детектив (v0.16.1): спрайт assets/detective.png. Оригинал смотрит
 * ВЛЕВО, поэтому зеркалим при движении ВПРАВО; вертикальные шаги —
 * последнее горизонтальное состояние. Fallback — прежний красный ромб. --- */
const detectiveImg = new Image();
detectiveImg.src = 'assets/detective.png';

/* --- Здания (v0.12.0): атлас assets/buildings.png — сетка 4×4 тайлов
 * 40×40 (всего 160×160). Генератор карты хранит для каждой стены случайный
 * индекс 0..15 в map.wallVariants; здесь он превращается в координаты
 * источника. Пока картинка не загружена — процедурная отрисовка (fallback). --- */
const buildingsImg = new Image();
buildingsImg.src = 'assets/buildings.png';

/** Индекс тайла атласа (0..15) → { sx, sy } в сетке 4×4 по 40 px. */
function buildingSrc(idx) {
  const col = idx % 4, row = (idx / 4) | 0;
  return { sx: col * 40, sy: row * 40 };
}

/**
 * Рендерер. Ожидает view = {
 *   map, actors, blockedExits,
 *   hover: {x,y}|null,
 *   pathSteps: [{from,to,landOn,metro}],   // текущий программируемый путь
 *   errorCell: {x,y}|null,                 // красный крест
 * }
 */
export function createRenderer(canvas, getView, decor = null) {
  const ctx = canvas.getContext('2d');

  return function render(dt = 0) {
    const v = getView();
    if (decor) decor.update(dt, v.map);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const map = v.map;
    if (!map) return;

    drawTiles(ctx, map, v);
    if (decor) decor.drawShip(ctx, map);   // корабль — под мостами
    drawBridges(ctx, map);                 // мосты перерисованы поверх корабля
    if (decor) decor.drawTrain(ctx, map);  // поезд — на рельсах
    // Туман войны (раунд 2, игрок-детектив): видно только радиус 3 + LOS
    let visibleSet = null;
    if (v.playerRole === 'detective' && v.actors) visibleSet = drawFog(ctx, map, v.actors);
    // v0.16.2: фаза выбора блока — все выходы мигают СКВОЗЬ туман
    if (v.blockadeChoice) drawBlockadeHint(ctx, map);
    if (v.programming) {
      drawProgrammingOverlays(ctx, { map, actors: v.actors, programmer: v.programmer });
    }
    if (v.pathSteps) drawPath(ctx, v.pathSteps);
    if (v.hover) drawHover(ctx, v.hover);
    if (v.errorCell) drawError(ctx, v.errorCell);
    if (v.actors) drawActors(ctx, v.actors, visibleSet, v.playerRole);
    if (decor) decor.drawPlane(ctx, map);  // самолёт — поверх всего
  };
}

function drawTiles(ctx, map, v = {}) {
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const t = map.tiles[y][x];
      const px = x * C, py = y * C;

      if (t === TILE.WALL) {
        // v0.12.0: тайл здания из атласа (случайный индекс от генератора);
        // если картинка ещё не загружена — процедурный прямоугольник.
        const idx = map.wallVariants?.[y]?.[x] ?? 0;
        if (buildingsImg.complete && buildingsImg.naturalWidth > 0) {
          const { sx, sy } = buildingSrc(idx);
          ctx.drawImage(buildingsImg, sx, sy, 40, 40, px, py, C, C);
        } else {
          ctx.fillStyle = '#171717';
          ctx.fillRect(px + 1, py + 1, C - 2, C - 2);
        }
      } else if (t === TILE.RIVER) {
        // v0.12.0: тайл реки из атласа (индекс от генератора);
        // пока картинка не загружена — процедурный fallback.
        if (roadImg.complete && roadImg.naturalWidth > 0) {
          const alt = map.riverVariants?.[y]?.[x] === 1;
          const src = alt ? RIVER_ALT_SRC : RIVER_SRC;
          ctx.drawImage(roadImg, src.sx, src.sy, 40, 40, px, py, C, C);
        } else {
          ctx.fillStyle = '#0d1418';
          ctx.fillRect(px, py, C, C);
        }
      } else if (t === TILE.RAIL) {
        // железная дорога (v0.12.0): тайл из атласа; напротив клеток вокзала —
        // спец-тайл; поезд рисуется отдельным слоем. Fallback — шпалы+рельсы.
        if (roadImg.complete && roadImg.naturalWidth > 0) {
          const overStation = map.tiles[y - 1]?.[x] === TILE.EXIT;
          const src = overStation ? RAIL_STATION_SRC : RAIL_SRC;
          ctx.drawImage(roadImg, src.sx, src.sy, 40, 40, px, py, C, C);
        } else {
          ctx.fillStyle = '#101010';
          ctx.fillRect(px, py, C, C);
          ctx.fillStyle = '#2a2a2a';
          for (let s = 4; s < C; s += 9) ctx.fillRect(px + s, py + C / 2 - 7, 4, 14);
          ctx.strokeStyle = '#3a3a3a';
          ctx.beginPath();
          ctx.moveTo(px, py + C / 2 - 5); ctx.lineTo(px + C, py + C / 2 - 5);
          ctx.moveTo(px, py + C / 2 + 5); ctx.lineTo(px + C, py + C / 2 + 5);
          ctx.stroke();
        }
      } else if (t === TILE.ROAD) {
        drawRoad(ctx, map, x, y, px, py);
      }

      if (t === TILE.METRO) {
        // v0.12.0: тайл из locations.png по номеру пары; fallback — окружность
        const pi = metroPairIndex(map, x, y);
        if (metroImg.complete && metroImg.naturalWidth > 0 && pi >= 0) {
          const src = METRO_SRC[pi] ?? METRO_SRC[0];
          ctx.drawImage(metroImg, src.sx, src.sy, 40, 40, px, py, C, C);
        } else {
          ctx.strokeStyle = COLORS.paper;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(px + C / 2, py + C / 2, C * 0.28, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      if (t === TILE.EXIT) {
        // v0.12.0: клетки вокзала/порта/аэропорта — тайлы из locations.png;
        // поверх них — штатная разметка блока (кресты раскрытых выходов)
        const locTile = stationTile(map, x, y) ?? portTile(map, x, y) ?? airportTile(map, x, y);
        if (locTile && metroImg.complete && metroImg.naturalWidth > 0) {
          ctx.drawImage(metroImg, locTile.sx, locTile.sy, 40, 40, px, py, C, C);
        }
        // v0.6.0: крест виден только для блоков, которые игрок УЖЕ узнал (GDD §9)
        const revealed = v.revealedExits?.has(`${x},${y}`);
        // v0.12.0: у port/airport/station есть собственные тайлы — рамка
        // «нераскрытого» выхода их только загрязняет, убираем её (кроме tunnel)
        const kindHere = exitKindAt(map, x, y);
        const showFrame = revealed || kindHere === EXIT_KIND.TUNNEL;
        if (showFrame) {
          ctx.strokeStyle = revealed ? COLORS.blood : COLORS.paper;
          ctx.setLineDash(revealed ? [] : [4, 3]);
          ctx.strokeRect(px + 2.5, py + 2.5, C - 5, C - 5);
          ctx.setLineDash([]);
        }
        if (revealed) {
          ctx.strokeStyle = COLORS.blood;
          ctx.beginPath();
          ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + C - 6, py + C - 6);
          ctx.moveTo(px + C - 6, py + 6); ctx.lineTo(px + 6, py + C - 6);
          ctx.stroke();
        }
      }

      // v0.12.0: внутренняя сетка убрана — остаются только hover-рамка
      // и внешняя граница канваса (CSS).
    }
  }
}

function drawPath(ctx, steps) {
  if (!steps.length) return;
  ctx.strokeStyle = COLORS.paper;
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  steps.forEach((s, i) => {
    const p = cellCenter(i === 0 ? s.from : steps[i - 1].landOn);
    // линия всегда до реальной клетки шага (to); при метро — до входа
    const q = cellCenter(s.to);
    if (i === 0) ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    // при телепорте следующая линия начинается с клетки выхода
    if (s.metro && i + 1 < steps.length) {
      const land = cellCenter(s.landOn);
      ctx.moveTo(land.x, land.y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  steps.forEach((s, i) => {
    const c = cellCenter(s.landOn);
    ctx.fillStyle = COLORS.paper;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), c.x, c.y);
    // при метро отмечаем и вход пары
    if (s.metro) {
      const e = cellCenter(s.to);
      ctx.strokeStyle = COLORS.paper;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

function drawHover(ctx, hover) {
  ctx.strokeStyle = COLORS.paper;
  ctx.globalAlpha = 0.35;
  ctx.strokeRect(hover.x * C + 1.5, hover.y * C + 1.5, C - 3, C - 3);
  ctx.globalAlpha = 1;
}

function drawError(ctx, cell) {
  const c = cellCenter(cell);
  ctx.strokeStyle = COLORS.blood;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c.x - 9, c.y - 9); ctx.lineTo(c.x + 9, c.y + 9);
  ctx.moveTo(c.x + 9, c.y - 9); ctx.lineTo(c.x - 9, c.y + 9);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawActors(ctx, actors, visibleSet = null, playerRole = null) {
  const shown = (a) => !visibleSet || visibleSet.has(`${a.x},${a.y}`);
  if (shown(actors.echo)) drawEcho(ctx, actors.echo, animPos(actors.echo, 'echo'), playerRole);
  if (shown(actors.fugitive)) {
    const fpos = animPos(actors.fugitive, 'fugitive');
    trackFugitiveFacing(actors.fugitive);
    if (criminalImg.complete && criminalImg.naturalWidth > 0) {
      drawFugitiveSprite(ctx, fpos);
    } else {
      drawActor(ctx, actors.fugitive, COLORS.paper, 1, 'circle', true, fpos);
    }
  }
  const dpos = animPos(actors.detective, 'detective');
  trackDetectiveFacing(actors.detective);
  if (detectiveImg.complete && detectiveImg.naturalWidth > 0) {
    drawDetectiveSprite(ctx, dpos);
  } else {
    drawActor(ctx, actors.detective, COLORS.blood, 1, 'diamond', true, dpos);
  }
}

/* Направление беглеца: 1 — вправо (оригинал), -1 — влево (зеркало).
 * Вертикальные шаги направление не меняют (GDD-запрос: держать последнее
 * горизонтальное состояние). */
let fugitiveFacing = 1;
let fugitivePrevX = null;
function trackFugitiveFacing(f) {
  if (fugitivePrevX === null) { fugitivePrevX = f.x; return; }
  if (Math.abs(f.x - fugitivePrevX) > 1) { // сброс партии / метро — ориентация по умолчанию
    fugitiveFacing = 1; fugitivePrevX = f.x; return;
  }
  if (f.x > fugitivePrevX) fugitiveFacing = 1;
  else if (f.x < fugitivePrevX) fugitiveFacing = -1;
  fugitivePrevX = f.x;
}

/** Спрайт беглеца по (возможно промежуточной) позиции pos {x,y} в клетках. */
function drawFugitiveSprite(ctx, pos) {
  const cx = (pos ? pos.x : 0) * C + C / 2;
  const cy = (pos ? pos.y : 0) * C + C / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (fugitiveFacing === -1) ctx.scale(-1, 1);
  ctx.drawImage(criminalImg, -C / 2, -C / 2, C, C);
  ctx.restore();
}

/* Направление детектива: оригинал спрайта смотрит ВЛЕВО, поэтому
 * facing = -1 рисуем без зеркала, при движении вправо — зеркалим. */
let detectiveFacing = -1;
let detectivePrevX = null;
function trackDetectiveFacing(d) {
  if (detectivePrevX === null) { detectivePrevX = d.x; return; }
  if (Math.abs(d.x - detectivePrevX) > 1) { // сброс партии / метро — оригинал (влево)
    detectiveFacing = -1; detectivePrevX = d.x; return;
  }
  if (d.x > detectivePrevX) detectiveFacing = 1;
  else if (d.x < detectivePrevX) detectiveFacing = -1;
  detectivePrevX = d.x;
}

/** Спрайт детектива по (возможно промежуточной) позиции pos {x,y} в клетках. */
function drawDetectiveSprite(ctx, pos) {
  const cx = (pos ? pos.x : 0) * C + C / 2;
  const cy = (pos ? pos.y : 0) * C + C / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (detectiveFacing === 1) ctx.scale(-1, 1); // оригинал смотрит влево
  ctx.drawImage(detectiveImg, -C / 2, -C / 2, C, C);
  ctx.restore();
}

/* --- Плавная анимация шагов (v0.9.0): интерполяция между клетками --- */
const ANIM_MS = 180;
const anims = new Map(); // id -> { from:{x,y}, t0, moving }

/** Текущая (возможно промежуточная) позиция актёра. */
function animPos(a, id) {
  if (!a) return null;
  const now = performance.now();
  const cur = { x: a.x, y: a.y };
  const rec = anims.get(id);
  if (!rec) {
    anims.set(id, { from: cur, t0: now, moving: false });
    return cur;
  }
  if (rec.from.x === a.x && rec.from.y === a.y && !rec.moving) return cur; // стоим
  const prev = rec.from;
  const dist = Math.abs(prev.x - a.x) + Math.abs(prev.y - a.y);
  if (!rec.moving && dist >= 1) {
    // новый шаг: старт интерполяции; метро/телепорт (>1 клетки) — мгновенно
    if (dist > 1) { rec.from = cur; rec.t0 = now; rec.moving = false; return cur; }
    rec.t0 = now;
    rec.moving = true;
  }
  const t = Math.min(1, (now - rec.t0) / ANIM_MS);
  if (t >= 1) { rec.moving = false; rec.from = cur; return cur; }
  const e = t * (2 - t); // ease-out
  return { x: prev.x + (a.x - prev.x) * e, y: prev.y + (a.y - prev.y) * e };
}

/** Туман войны: затемняет всё вне радиуса 3 + LOS от детектива. */
function drawFog(ctx, map, actors) {
  const vis = new Set(visibleCells(map, actors.detective).map((c) => `${c.x},${c.y}`));
  ctx.save();
  ctx.fillStyle = COLORS.fog;
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (!vis.has(`${x},${y}`)) ctx.fillRect(x * C, y * C, C, C);
    }
  }
  ctx.restore();
  return vis;
}

/** Двойник (GDD §12): спрайт беглеца. Когда игрок — беглец, двойник
 * полупрозрачный (67%), чтобы не путать со своим; когда игрок — детектив,
 * двойник неотличим от настоящего беглеца (ловушка). Захваченный — гаснет. */
function drawEcho(ctx, e, pos = null, playerRole = null) {
  if (!e || !e.active) return;
  const p = pos || { x: e.x, y: e.y };
  const cx = p.x * C + C / 2;
  const cy = p.y * C + C / 2;
  ctx.save();
  if (e.captured) {
    ctx.globalAlpha = 0.15;
  } else {
    // беглец видит двойника призраком (67%), детектив — как живого беглеца
    ctx.globalAlpha = playerRole === 'fugitive' ? 0.67 : 1;
  }
  if (criminalImg.complete && criminalImg.naturalWidth > 0) {
    ctx.translate(cx, cy);
    if (fugitiveFacing === -1) ctx.scale(-1, 1);
    ctx.drawImage(criminalImg, -C / 2, -C / 2, C, C);
  } else {
    // фолбэк: прежний белый круг
    ctx.fillStyle = COLORS.paper;
    ctx.beginPath();
    ctx.arc(cx, cy, C * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawActor(ctx, a, color, alpha, shape, visible, pos = null) {
  if (!a || !visible) return;
  const c = pos ? { x: pos.x * C + C / 2, y: pos.y * C + C / 2 } : cellCenter(a);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (shape === 'diamond') {
    ctx.moveTo(c.x, c.y - C * 0.3); ctx.lineTo(c.x + C * 0.3, c.y);
    ctx.lineTo(c.x, c.y + C * 0.3); ctx.lineTo(c.x - C * 0.3, c.y);
  } else {
    ctx.arc(c.x, c.y, C * 0.28, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Связность дороги: сосед — асфальт, мост, выход или метро
 *  (дороги генератор ведёт до этих точек, но их клетки не превращает в ROAD).
 *  RAIL сюда НЕ входит: дорог поверх рельсов не бывает (переездов нет),
 *  а без этого дорога, идущая ВДОЛЬ железки, превращалась бы в цепочку
 *  Т-перекрёстков (рельсы считались боковым съездом). */
function roadConnects(map, x, y) {
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return false;
  const t = map.tiles[y][x];
  return t === TILE.ROAD || t === TILE.BRIDGE
    || t === TILE.EXIT || t === TILE.METRO;
}

/**
 * Дорожный тайл (v0.11.0): выбор варианта из 4 тайлов атласа по маске
 * связности (С/В/Ю/З) + программный поворот. Тупики (1 связь) — половина
 * прямой тайла. Без атласа — процедурный пунктир (fallback).
 */
function drawRoad(ctx, map, x, y, px, py) {
  const n = roadConnects(map, x, y - 1), s = roadConnects(map, x, y + 1);
  const w = roadConnects(map, x - 1, y), e = roadConnects(map, x + 1, y);
  const cnt = (n ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + (e ? 1 : 0);

  if (!roadImg.complete || !roadImg.naturalWidth) {
    // fallback: атлас ещё не загрузился
    ctx.fillStyle = '#131313';
    ctx.fillRect(px, py, C, C);
    ctx.strokeStyle = '#242424';
    ctx.beginPath();
    if (n) { ctx.moveTo(px + C / 2, py); ctx.lineTo(px + C / 2, py + C / 2); }
    if (s) { ctx.moveTo(px + C / 2, py + C / 2); ctx.lineTo(px + C / 2, py + C); }
    if (w) { ctx.moveTo(px, py + C / 2); ctx.lineTo(px + C / 2, py + C / 2); }
    if (e) { ctx.moveTo(px + C / 2, py + C / 2); ctx.lineTo(px + C, py + C / 2); }
    ctx.stroke();
    return;
  }

  let src = ROAD_SRC[0], rot = 0, half = null;
  if (cnt >= 4) { src = ROAD_SRC[3]; }                       // «+»
  else if (cnt === 3) {                                       // Т: атлас без С
    src = ROAD_SRC[2];
    rot = !n ? 0 : !e ? 90 : !s ? 180 : 270;                  // поворот к отсутствующей стороне
  } else if (cnt === 2) {
    if (n && s) { src = ROAD_SRC[0]; }                        // прямая С–Ю
    else if (e && w) { src = ROAD_SRC[0]; rot = 90; }         // прямая В–З
    else {                                                    // угол: атлас В–Ю
      src = ROAD_SRC[1];
      rot = (e && s) ? 0 : (s && w) ? 90 : (w && n) ? 180 : 270;
    }
  } else if (cnt === 1) {                                     // тупик: половина прямой
    src = ROAD_SRC[0];
    if (e || w) rot = 90;
    half = n ? 'n' : s ? 's' : w ? 'w' : 'e';
  }
  // cnt === 0 — изолированный тайл: рисуем прямую как есть

  ctx.save();
  if (half) {
    ctx.beginPath();
    if (half === 'n') ctx.rect(px, py, C, C / 2);
    else if (half === 's') ctx.rect(px, py + C / 2, C, C / 2);
    else if (half === 'w') ctx.rect(px, py, C / 2, C);
    else ctx.rect(px + C / 2, py, C / 2, C);
    ctx.clip();
  }
  ctx.translate(px + C / 2, py + C / 2);
  if (rot) ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(roadImg, src.sx, src.sy, C, C, -C / 2, -C / 2, C, C);
  ctx.restore();
}

/**
 * v0.16.2: подсказка фазы BLOCKADE_CHOICE — все выходы мигают сквозь
 * туман войны (бумажная рамка + пульс), чтобы было понятно, куда кликнуть.
 */
function drawBlockadeHint(ctx, map) {
  const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 260);
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.55 * pulse;
  ctx.strokeStyle = COLORS.paper;
  ctx.lineWidth = 3;
  for (const e of map.exits) {
    for (const c of e.cells) {
      ctx.strokeRect(c.x * C + 2, c.y * C + 2, C - 4, C - 4);
    }
  }
  ctx.restore();
  ctx.lineWidth = 1;
}

/** Мосты (v0.10.0): настилы поверх реки — рисуются после корабля. */
function drawBridges(ctx, map) {
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y][x] !== TILE.BRIDGE) continue;
      const px = x * C, py = y * C;
      // v0.12.0: тайл моста из атласа; пока не загружен — процедурный настил
      if (roadImg.complete && roadImg.naturalWidth > 0) {
        ctx.drawImage(roadImg, BRIDGE_SRC.sx, BRIDGE_SRC.sy, 40, 40, px, py, C, C);
        continue;
      }
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(px, py, C, C);
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(px + 3, py); ctx.lineTo(px + 3, py + C);
      ctx.moveTo(px + C - 3, py); ctx.lineTo(px + C - 3, py + C);
      ctx.stroke();
    }
  }
}

function cellCenter(cell) {
  return { x: cell.x * C + C / 2, y: cell.y * C + C / 2 };
}
