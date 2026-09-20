import { CONFIG } from '../config/config.js';
import { TILE } from '../config/constants.js';
import { DIRS, key, tileAt, isPassable, metroPartner, exitAt } from './grid.js';
import { buildMicroSchedule } from './game-loop.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** Обычный шаг: соседняя клетка, метро телепортирует. Непроходимо — скип. */
function stepActor(map, a, dirName, bus, who) {
  const d = DIRS[dirName];
  if (!d) return;
  const nx = a.x + d.dx, ny = a.y + d.dy;
  const tile = tileAt(map, nx, ny);
  if (!isPassable(tile)) { bus.emit('step:skipped', { who }); return; }
  a.x = nx; a.y = ny;
  if (tile === TILE.METRO) {
    const p = metroPartner(map, nx, ny);
    if (p) { a.x = p.x; a.y = p.y; bus.emit('metro', { who }); }
  }
}

/** Шаг беглеца: + финальные точки (решение №4). */
export function stepFugitive(s, f, dirName, bus) {
  const d = DIRS[dirName];
  if (!d) return;
  // v0.12.1: после достижения блока остаток пути в ЭТОМ ходу не исполняется —
  // направления программировались от клетки выхода, а беглец стоит перед ним;
  // дальше идти бессмысленно (GDD §9 п.5: «со следующего хода» — новый план).
  if (f.blockedStop) return;
  const nx = f.x + d.dx, ny = f.y + d.dy;
  const tile = tileAt(s.map, nx, ny);
  if (!isPassable(tile)) { bus.emit('step:skipped', { who: 'fugitive' }); return; }

  if (tile === TILE.EXIT) {
    if (s.blockedExits.has(key(nx, ny))) {
      // шаг сгорает, позиция не меняется, программа продолжается;
      // v0.6.0: теперь беглец УЗНАЛ об этой блокировке (GDD §9)
      // v0.11.0: раскрываем обе клетки выхода (кресты на карте и ИИ)
      const exit = exitAt(s.map, nx, ny);
      for (const c of (exit ? exit.cells : [{ x: nx, y: ny }])) {
        s.revealedExits.add(key(c.x, c.y));
      }
      f.blockedStop = true; // стоп: остаток пути не исполняется (см. начало функции)
      bus.emit('exit:blocked:hit', { x: nx, y: ny });
      return;
    }
    f.x = nx; f.y = ny;
    f.isEscaped = true;
    bus.emit('escaped', { x: nx, y: ny });
    return;
  }

  stepActor(s.map, f, dirName, bus, 'fugitive');
}

/** Шаг двойника: невозможный шаг — скип; в финальную точку не заходит. */
function stepEcho(s, e, dirName, bus) {
  const d = DIRS[dirName];
  if (!d) return;
  const nx = e.x + d.dx, ny = e.y + d.dy;
  const tile = tileAt(s.map, nx, ny);
  if (!isPassable(tile) || tile === TILE.EXIT) {
    bus.emit('step:skipped', { who: 'echo' });
    return;
  }
  stepActor(s.map, e, dirName, bus, 'echo');
}

/**
 * КОНТРАКТ ТИКА (решение №1):
 *   r=0..4: fugitive.step(r) → detective.step(2r) → detective.step(2r+1) → echo.step(r)
 * Поимка проверяется после каждого микро-шага.
 * Возвращает: 'escape' | 'caught' | 'continue'.
 */
export async function resolveTurn({ store, bus }) {
  const s = store.get();
  const { actors } = s;
  const f = actors.fugitive, d = actors.detective, e = actors.echo;
  f.isEscaped = false;
  f.blockedStop = false; // v0.12.1: флаг «стоп после блока» живёт один ход

  for (const item of buildMicroSchedule()) {
    if (item.who === 'fugitive') {
      const dir = f.path[item.step];
      if (dir) stepFugitive(s, f, dir, bus);
    } else if (item.who === 'detective') {
      const dir = d.path[item.step];
      if (dir) stepActor(s.map, d, dir, bus, 'detective');
    } else if (item.who === 'echo') {
      // решение: после поимки оставшиеся шаги эхо доигрываются (e.captured не блокирует)
      if (e.active) {
        const dir = e.path[item.step];
        if (dir) stepEcho(s, e, dir, bus);
      }
    }

    bus.emit('microstep', { ...item });

    // поимка после каждого микро-шага (любой из двух пришедших в клетку)
    if (d.x === f.x && d.y === f.y) {
      bus.emit('caught', { x: f.x, y: f.y });
      return 'caught';
    }
    // поимка двойника (решение №3): озарение сразу, шаги двойника доигрываются
    if (e.active && !e.captured && d.x === e.x && d.y === e.y) {
      e.captured = true;
      // GDD §8: детектив видит беглеца ДО КОНЦА СЛЕДУЮЩЕГО ХОДА
      d.epiphanyUntilTurn = s.turn + 1;
      bus.emit('echo:caught', { x: e.x, y: e.y, epiphanyUntilTurn: d.epiphanyUntilTurn });
    }
    if (f.isEscaped) return 'escape';

    await delay(CONFIG.animation.stepDelay);
  }

  // двойник живёт ровно 1 фазу
  if (e.active) { e.active = false; bus.emit('echo:fade'); }

  return 'continue';
}
