import { CONFIG } from '../config/config.js';
import { TILE, EXIT_KIND } from '../config/constants.js';
import { mulberry32, randInt } from './rng.js';
import { reachable } from './connectivity.js';
import { key, isPassable, metroPartner } from './grid.js';

const STARTS = {
  fugitive:  { x: 1, y: 1 },
  detective: { x: CONFIG.grid.cols - 2, y: CONFIG.grid.rows - 3 },
};

// 13-я строка (y = rows-1) — железная дорога: непроходима, по ней ездит поезд.
// Вокзал (станция выхода) всегда на строке над ней.
const RAIL_Y = CONFIG.grid.rows - 1;

const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Сколько непроходимых соседей (стена/река/рельсы/край карты) у клетки.
 * Для станции метро это число критично: шаг на станцию всегда телепортирует,
 * поэтому если к станции ведёт единственный проход и он перекрыт —
 * персонаж «проваливается» в метро в ловушку. Правило: не более 1.
 */
function blockedNeighbors(tiles, cols, rows, x, y) {
  let n = 0;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) { n++; continue; }
    const t = tiles[ny][nx];
    if (t === TILE.WALL || t === TILE.RIVER || t === TILE.RAIL) n++;
  }
  return n;
}

export function generateMap(seed = Date.now()) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const rnd = mulberry32(seed + attempt * 7919);
    const map = tryBuild(rnd, attempt);
    if (map && validateMap(map)) return { ...map, seedUsed: seed + attempt * 7919, attempt };
  }
  return fallback();
}

/* ---------- построение ---------- */

function tryBuild(rnd, attempt) {
  const { cols, rows } = CONFIG.grid;
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(TILE.FLOOR));

  // 1. Железная дорога — последняя строка целиком (v0.10.0)
  for (let x = 0; x < cols; x++) tiles[RAIL_Y][x] = TILE.RAIL;

  // 2. Река — ровно одна строка (решение №6)
  const [rMin, rMax] = CONFIG.map.riverRowRange;
  const riverY = rMin + randInt(rnd, rMax - rMin + 1);
  for (let x = 0; x < cols; x++) tiles[riverY][x] = TILE.RIVER;

  // 3. Мосты — не у краёв, с интервалом
  const bridges = [];
  const used = [];
  let guard = 0;
  while (bridges.length < CONFIG.map.bridges && guard++ < 400) {
    const x = 2 + randInt(rnd, cols - 4);
    if (used.some((u) => Math.abs(u - x) < 3)) continue;
    used.push(x); bridges.push(x); tiles[riverY][x] = TILE.BRIDGE;
  }
  if (bridges.length < CONFIG.map.bridges) return null;

  // 4. Выходы по тематике (v0.10.0), ДВУХКЛЕТОЧНЫЕ (v0.11.0):
  //    вокзал — у рельсов (горизонтально, главная — правая клетка),
  //    порт — у реки (горизонтально, главная — левая),
  //    аэропорт — свободно (вертикально, главная — нижняя).
  //    exit.x/y — главная клетка: к ней подводится дорога и на неё
  //    ориентируются анимации decor; exit.cells — обе клетки выхода.
  const exits = [];

  /** Регистрация выхода: обе клетки становятся EXIT. */
  const addExit = (main, second, kind) => {
    const exit = { x: main.x, y: main.y, kind, cells: [main, second] };
    for (const c of exit.cells) tiles[c.y][c.x] = TILE.EXIT;
    exits.push(exit);
    return exit;
  };
  /** Все клетки уже размещённых выходов (для проверки дистанции). */
  const exitCells = () => exits.flatMap((e) => e.cells);
  /** Клетки выхода не должны пересекаться/касаться уже размещённых. */
  const farFromExits = (cells) =>
    exitCells().every((ec) => cells.every((c) => manhattan(ec, c) >= 3));

  let station = null;
  guard = 0;
  while (!station && guard++ < 400) {
    // главная — правая клетка; левая (x-1) — вторая
    const c = { x: 2 + randInt(rnd, cols - 4), y: RAIL_Y - 1 };
    const pair = [c, { x: c.x - 1, y: c.y }];
    if (pair.some((p) => tiles[p.y][p.x] !== TILE.FLOOR)) continue;
    if (manhattan(c, STARTS.fugitive) < 8) continue;
    if (!farFromExits(pair)) continue;
    station = addExit(c, pair[1], EXIT_KIND.STATION);
  }
  if (!station) return null;

  let port = null;
  guard = 0;
  while (!port && guard++ < 400) {
    const y = riverY + (rnd() < 0.5 ? -1 : 1);          // выше или ниже реки
    if (y < 1 || y >= RAIL_Y) continue;
    // главная — левая клетка; правая (x+1) — вторая
    const c = { x: 1 + randInt(rnd, cols - 4), y };
    const pair = [c, { x: c.x + 1, y: c.y }];
    if (pair.some((p) => tiles[p.y][p.x] !== TILE.FLOOR)) continue;
    if (manhattan(c, STARTS.fugitive) < 8) continue;
    if (!farFromExits(pair)) continue;
    // (v0.11.0) порт не ставим на соседнюю клетку с мостом (обе клетки)
    if (pair.some((p) => bridges.some((b) => manhattan(p, { x: b, y: riverY }) <= 1))) continue;
    port = addExit(c, pair[1], EXIT_KIND.PORT);
  }
  if (!port) return null;

  let airport = null;
  guard = 0;
  while (!airport && guard++ < 400) {
    const side = randInt(rnd, 2);
    // главная — нижняя клетка; верхняя (y-1) — вторая
    const c = side === 0
      ? { x: cols - 1, y: 2 + randInt(rnd, rows - 4) }  // правый край
      : { x: 1 + randInt(rnd, cols - 2), y: 1 };        // верхняя граница
    const pair = [c, { x: c.x, y: c.y - 1 }];
    if (pair.some((p) => p.y === riverY || p.y >= RAIL_Y)) continue;
    if (manhattan(c, STARTS.fugitive) < 8) continue;
    if (!farFromExits(pair)) continue;
    if (pair.some((p) => tiles[p.y][p.x] !== TILE.FLOOR)) continue;
    airport = addExit(c, pair[1], EXIT_KIND.AIRPORT);
  }
  if (!airport) return null;

  // 5. Метро-пары: станция обязана иметь минимум 3 проходимых соседа —
  //    шаг на станцию всегда телепортирует, и единственный вход-ловушка
  //    сделал бы метро непроходимым (см. blockedNeighbors)
  const metroPairs = [];
  guard = 0;
  while (metroPairs.length < CONFIG.map.metroPairs && guard++ < 400) {
    const a = freeCell(rnd, tiles, cols, rows, riverY);
    const b = freeCell(rnd, tiles, cols, rows, riverY);
    if (!a || !b) continue;
    if (blockedNeighbors(tiles, cols, rows, a.x, a.y) > 1) continue;
    if (blockedNeighbors(tiles, cols, rows, b.x, b.y) > 1) continue;
    if (manhattan(a, b) < 6) continue;
    if (manhattan(a, STARTS.fugitive) < 3 || manhattan(b, STARTS.detective) < 3) continue;
    if (metroPairs.flat().some((p) => manhattan(p, a) < 3 || manhattan(p, b) < 3)) continue;
    tiles[a.y][a.x] = TILE.METRO; tiles[b.y][b.x] = TILE.METRO;
    metroPairs.push([a, b]);
  }
  if (metroPairs.length < CONFIG.map.metroPairs) return null;

  // 6. Здания: плотность падает с каждой попыткой → генератор всегда сходится
  const density = Math.max(0.06, 0.20 - attempt * 0.004);
  const protectedSet = new Set([
    ...exits.flatMap((e) => e.cells.map((c) => key(c.x, c.y))),
    ...metroPairs.flat().map((p) => key(p.x, p.y)),
    ...bridges.map((x) => key(x, riverY)),
    key(STARTS.fugitive.x, STARTS.fugitive.y),
    key(STARTS.detective.x, STARTS.detective.y),
  ]);
  // подходы к мостам с обоих берегов — стена здесь перерезала бы переправу
  for (const x of bridges) {
    protectedSet.add(key(x, riverY - 1));
    protectedSet.add(key(x, riverY + 1));
  }
  // Станции метро: шаг на станцию всегда телепортирует, поэтому у станции
  // допускается не более 1 непроходимой клетки (стена/река/рельсы/край).
  const metroSet = new Set(metroPairs.flat().map((p) => key(p.x, p.y)));
  const canPlaceWall = (x, y) => {
    if (tiles[y][x] !== TILE.FLOOR || protectedSet.has(key(x, y))) return false;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (!metroSet.has(key(nx, ny))) continue;
      // считаем блокировки станции с учётом будущей стены в (x,y)
      let blocked = 0;
      for (const [mx, my] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const sx = nx + mx, sy = ny + my;
        if (sx === x && sy === y) { blocked++; continue; }
        if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) { blocked++; continue; }
        const t = tiles[sy][sx];
        if (t === TILE.WALL || t === TILE.RIVER || t === TILE.RAIL) blocked++;
      }
      if (blocked > 1) return false;
    }
    return true;
  };

  let placed = 0;
  for (let y = 1; y < RAIL_Y; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (tiles[y][x] !== TILE.FLOOR) continue;
      if (protectedSet.has(key(x, y))) continue;
      if (rnd() > density) continue;
      if (!canPlaceWall(x, y)) continue;
      tiles[y][x] = TILE.WALL; placed++;
      // иногда достраиваем блок на 2 клетки
      if (rnd() < 0.45) {
        const horiz = rnd() < 0.5;
        const nx = x + (horiz ? 1 : 0), ny = y + (horiz ? 0 : 1);
        if (nx < cols - 1 && ny < RAIL_Y && canPlaceWall(nx, ny)) {
          tiles[ny][nx] = TILE.WALL; placed++;
        }
      }
    }
  }

  // (v0.11.0) Тайлсет зданий (assets/buildings.png, 4×4): каждой стене —
  // случайный тайл атласа 0..15. Индекс хранится в wallVariants, чтобы
  // рисунок стены не «мигал» между кадрами.
  const wallVariants = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (tiles[y][x] === TILE.WALL) wallVariants[y][x] = randInt(rnd, 16);

  // (v0.12.0) Тайлсет реки (assets/roads.png, 4-й столбец): строка реки
  // собирается из 16 ОСНОВНЫХ (0) и 4 ДОПОЛНИТЕЛЬНЫХ (1) тайлов в случайном
  // порядке. Индексы в riverVariants — рисунок реки стабилен между кадрами.
  const riverVariants = Array.from({ length: rows }, () => Array(cols).fill(0));
  {
    const pool = [...Array(16).fill(0), ...Array(4).fill(1)];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let x = 0; x < cols; x++) riverVariants[riverY][x] = pool[x];
  }

  // 7. Дороги (v0.10.0): визуальная сеть, соединяющая значимые точки.
  //    Проходимы, на логику не влияют — только оформление.
  const roadPoints = [
    STARTS.fugitive, STARTS.detective,
    ...exits, ...metroPairs.flat(),
    ...bridges.flatMap((x) => [{ x, y: riverY - 1 }, { x, y: riverY + 1 }]),
  ];
  buildRoads(tiles, cols, rows, roadPoints);

  return { cols, rows, tiles, metroPairs, exits, riverY, railY: RAIL_Y, bridges, walls: placed, wallVariants, riverVariants };
}

function freeCell(rnd, tiles, cols, rows, riverY) {
  for (let i = 0; i < 60; i++) {
    const x = 1 + randInt(rnd, cols - 2);
    const y = 1 + randInt(rnd, rows - 2);
    if (y === riverY) continue;
    if (tiles[y][x] === TILE.FLOOR) return { x, y };
  }
  return null;
}

/* ---------- дороги ---------- */

/** BFS по проходимым клеткам; возвращает массив клеток пути (цель включена) или null. */
function roadBfs(tiles, cols, rows, start, goal) {
  if (start.x === goal.x && start.y === goal.y) return [];
  const passable = (x, y) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    const t = tiles[y][x];
    return t !== TILE.WALL && t !== TILE.RIVER && t !== TILE.RAIL;
  };
  if (!passable(goal.x, goal.y)) return null;
  const prev = new Map([[key(start.x, start.y), null]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const k = key(nx, ny);
      if (prev.has(k) || !passable(nx, ny)) continue;
      prev.set(k, key(cur.x, cur.y));
      if (nx === goal.x && ny === goal.y) {
        const path = [];
        let kk = k;
        while (prev.get(kk)) { path.push(parse(kk)); kk = prev.get(kk); }
        return path.reverse();
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}
const parse = (k) => { const [x, y] = k.split(',').map(Number); return { x, y }; };

/**
 * Соединяет точки дорожной сетью (жадно: каждая следующая точка — к
 * ближайшей уже подключённой). Дорогой становятся только клетки FLOOR;
 * спец-клетки (выходы, метро, мосты) остаются как есть.
 */
function buildRoads(tiles, cols, rows, points) {
  const connected = [points[0]];
  const rest = points.slice(1);
  while (rest.length) {
    let best = null;
    for (const c of connected) {
      for (let i = 0; i < rest.length; i++) {
        const path = roadBfs(tiles, cols, rows, c, rest[i]);
        if (path && (!best || path.length < best.len)) best = { i, path, len: path.length };
      }
    }
    if (!best) { rest.shift(); continue; } // недостижимо — пропускаем
    for (const cell of best.path) {
      if (tiles[cell.y][cell.x] === TILE.FLOOR) tiles[cell.y][cell.x] = TILE.ROAD;
    }
    connected.push(rest.splice(best.i, 1)[0]);
  }
}

/* ---------- валидация ---------- */

/**
 * (v0.11.0) Дороги от каждого моста в обе стороны (вверх и вниз по берегу)
 * должны вести как минимум к одной значимой точке: выход, метро, старт
 * персонажа или другой мост. Иначе мост ведёт в дорожный «карман» без цели.
 */
function bridgeRoadsOk(map) {
  const basePoints = new Set([
    ...map.exits.flatMap((e) => e.cells.map((c) => key(c.x, c.y))),
    ...map.metroPairs.flat().map((p) => key(p.x, p.y)),
    key(STARTS.fugitive.x, STARTS.fugitive.y),
    key(STARTS.detective.x, STARTS.detective.y),
  ]);
  for (const bx of map.bridges) {
    // «другой мост» = его клетка на реке и подход с любого берега
    const points = new Set(basePoints);
    for (const ox of map.bridges) {
      if (ox === bx) continue;
      points.add(key(ox, map.riverY));
      points.add(key(ox, map.riverY - 1));
      points.add(key(ox, map.riverY + 1));
    }
    const walkable = (x, y) => {
      if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return false;
      // через САМОЙ проверяемый мост возвращаться нельзя: иначе берег
      // «соединялся» бы сам с собой и проверка всегда проходила (v0.11.0)
      if (x === bx && y === map.riverY) return false;
      const k = key(x, y);
      if (points.has(k)) return true; // к точке можно «войти», даже если это FLOOR (старт)
      const t = map.tiles[y][x];
      return t === TILE.ROAD || t === TILE.EXIT || t === TILE.METRO || t === TILE.BRIDGE;
    };
    for (const dir of [-1, 1]) {
      const sy = map.riverY + dir;
      if (points.has(key(bx, sy))) continue; // подход сам является точкой
      const seen = new Set([key(bx, sy)]);
      const q = [{ x: bx, y: sy }];
      let ok = false;
      for (let i = 0; i < q.length && !ok; i++) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nx = q[i].x + dx, ny = q[i].y + dy;
          const k = key(nx, ny);
          if (seen.has(k) || !walkable(nx, ny)) continue;
          if (points.has(k)) { ok = true; break; }
          seen.add(k);
          q.push({ x: nx, y: ny });
        }
      }
      if (!ok) return false;
    }
  }
  return true;
}

function validateMap(map) {
  // железная дорога — последняя строка целиком
  for (let x = 0; x < map.cols; x++) {
    if (map.tiles[RAIL_Y][x] !== TILE.RAIL) return false;
  }
  // тематика выходов (v0.10.0) + двухклеточность (v0.11.0)
  const st = map.exits.find((e) => e.kind === EXIT_KIND.STATION);
  if (!st || st.y !== RAIL_Y - 1) return false;
  const pt = map.exits.find((e) => e.kind === EXIT_KIND.PORT);
  if (!pt || Math.abs(pt.y - map.riverY) !== 1) return false;
  // (v0.11.0) порт не на соседней клетке с мостом (обе клетки)
  if (pt.cells.some((c) => map.bridges.some((b) => manhattan(c, { x: b, y: map.riverY }) <= 1))) return false;
  const ap = map.exits.find((e) => e.kind === EXIT_KIND.AIRPORT);
  if (!ap) return false;
  // каждый выход — ровно 2 клетки, обе помечены EXIT
  for (const e of map.exits) {
    if (!e.cells || e.cells.length !== 2) return false;
    for (const c of e.cells) {
      if (map.tiles[c.y][c.x] !== TILE.EXIT) return false;
    }
  }
  // ориентация: вокзал/порт — горизонталь, аэропорт — вертикаль
  if (st.cells[1].y !== st.y || Math.abs(st.cells[1].x - st.x) !== 1) return false;
  if (pt.cells[1].y !== pt.y || Math.abs(pt.cells[1].x - pt.x) !== 1) return false;
  if (ap.cells[1].x !== ap.x || Math.abs(ap.cells[1].y - ap.y) !== 1) return false;
  // главная клетка: вокзал — правая, порт — левая, аэропорт — нижняя
  if (st.cells[1].x !== st.x - 1) return false;
  if (pt.cells[1].x !== pt.x + 1) return false;
  if (ap.cells[1].y !== ap.y - 1) return false;

  const reachF = reachable(map, STARTS.fugitive);
  const reachD = reachable(map, STARTS.detective);

  // беглец обязан доставать все выходы (главную клетку каждой пары)
  for (const e of map.exits) if (!reachF.has(key(e.x, e.y))) return false;
  // обе стороны обязаны доставать все клетки метро
  for (const [a, b] of map.metroPairs) {
    for (const c of [a, b]) {
      if (!reachF.has(key(c.x, c.y)) || !reachD.has(key(c.x, c.y))) return false;
      // у станции не более 1 непроходимой клетки — иначе вход-ловушка
      if (blockedNeighbors(map.tiles, map.cols, map.rows, c.x, c.y) > 1) return false;
    }
  }
  // детектив обязан доставать старт беглеца (иначе погоня невозможна)
  if (!reachD.has(key(STARTS.fugitive.x, STARTS.fugitive.y))) return false;
  // метро не должно быть самопарным
  for (const [a, b] of map.metroPairs) {
    const p = metroPartner(map, a.x, a.y);
    if (!p || p.x !== b.x || p.y !== b.y) return false;
  }
  // (v0.11.0) дороги от мостов в обе стороны ведут к значимой точке
  if (!bridgeRoadsOk(map)) return false;
  return true;
}

/* ---------- страховка: всегда валидная пустая карта ---------- */

function fallback() {
  const { cols, rows } = CONFIG.grid;
  const riverY = CONFIG.map.riverRowRange[0];
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(TILE.FLOOR));
  for (let x = 0; x < cols; x++) {
    tiles[riverY][x] = TILE.RIVER;
    tiles[RAIL_Y][x] = TILE.RAIL;
  }
  const bridges = [3, Math.floor(cols / 2), cols - 4];
  bridges.forEach((x) => (tiles[riverY][x] = TILE.BRIDGE));
  // Двухклеточные выходы (v0.11.0): главная клетка — x/y (к ней ведётся
  // дорога и на неё смотрит decor), cells — обе клетки.
  const mkExit = (x, y, sx, sy, kind) => {
    const e = { x, y, kind, cells: [{ x, y }, { x: sx, y: sy }] };
    for (const c of e.cells) if (c.y !== riverY && c.y !== RAIL_Y) tiles[c.y][c.x] = TILE.EXIT;
    return e;
  };
  const exits = [
    // аэропорт — вертикаль, главная (x/y) — нижняя клетка
    mkExit(cols - 1, 2, cols - 1, 1, EXIT_KIND.AIRPORT),
    // порт — горизонталь, главная — левая; не у мостов (3, cols/2, cols-4)
    mkExit(Math.floor(cols / 2) + 2, riverY + 1, Math.floor(cols / 2) + 3, riverY + 1, EXIT_KIND.PORT),
    // вокзал — горизонталь, главная — правая
    mkExit(2, RAIL_Y - 1, 1, RAIL_Y - 1, EXIT_KIND.STATION),
  ];
  const metroPairs = [
    [{ x: 2, y: 2 }, { x: cols - 3, y: rows - 4 }],
    [{ x: 6, y: rows - 3 }, { x: cols - 6, y: 1 }],
  ];
  metroPairs.flat().forEach((p) => { if (p.y !== riverY && p.y !== RAIL_Y) tiles[p.y][p.x] = TILE.METRO; });
  return { cols, rows, tiles, metroPairs, exits, riverY, railY: RAIL_Y, bridges, walls: 0, seedUsed: -1, attempt: -1 };
}

export { STARTS, RAIL_Y };