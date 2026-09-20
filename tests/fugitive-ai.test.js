// Тесты ИИ беглеца (v0.7.0 «оба раунда»).
import { createFugitiveAI } from '../js/core/fugitive-ai.js';
import { TILE } from '../js/config/constants.js';
import assert from 'node:assert/strict';

const mkState = ({ exits, walls = [], metroPairs = [], f = { x: 1, y: 1 }, d = { x: 10, y: 1 }, turn = 1 }) => {
  const cols = 12, rows = 5;
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(TILE.FLOOR));
  for (const [x, y] of walls) tiles[y][x] = TILE.WALL;
  for (const e of exits) tiles[e.y][e.x] = TILE.EXIT;
  for (const [a, b] of metroPairs) { tiles[a.y][a.x] = TILE.METRO; tiles[b.y][b.x] = TILE.METRO; }
  return {
    turn,
    map: { cols, rows, tiles, metroPairs, exits },
    actors: {
      fugitive: { x: f.x, y: f.y },
      detective: { x: d.x, y: d.y },
      echo: { x: 0, y: 0, path: [], active: false, captured: false },
    },
    revealedExits: new Set(),
    blockedExits: new Set(),
    pathHistory: { 0: { dirs: ['right'], start: { x: 1, y: 1 } } }, // «предыдущий ход» для эха
  };
};

// 1. ПОБЕГ: цель — ближайший выход, путь не длиннее 5 шагов
{
  const exits = [{ x: 11, y: 1 }, { x: 11, y: 4 }];
  const s = mkState({ exits, d: { x: 0, y: 4 } });
  const ai = createFugitiveAI({ rand: () => 0.99 }); // без уклонения
  const plan = ai.plan(s);
  assert.ok(plan.dirs.length > 0 && plan.dirs.length <= 5, 'путь 1..5 шагов');
  assert.ok(plan.dirs.every((dd) => ['up', 'down', 'left', 'right'].includes(dd)), 'только направления');
  assert.deepEqual(ai.target, exits[0], 'цель — ближайший выход');
}

// 2. ЗАБЛОКИРОВАННАЯ ТОЧКА: после раскрытия цель пересчитывается
{
  const exits = [{ x: 11, y: 1 }, { x: 11, y: 4 }];
  const s = mkState({ exits, d: { x: 0, y: 4 } });
  const ai = createFugitiveAI({ rand: () => 0.99 });
  ai.plan(s);
  assert.deepEqual(ai.target, exits[0]);
  s.revealedExits.add('11,1');
  ai.plan(s);
  assert.deepEqual(ai.target, exits[1], 'цель переключена на свободный выход');
}

// 3. МЕТРО: без телепорта путь недостижим (глухие стены x=5,6) — ИИ идёт через метро
{
  const walls = [];
  for (let y = 0; y < 5; y++) { walls.push([5, y]); walls.push([6, y]); }
  const metro = [[{ x: 4, y: 2 }, { x: 7, y: 2 }]];
  const exits = [{ x: 11, y: 2 }];
  const s = mkState({ exits, walls, metroPairs: metro, f: { x: 1, y: 2 }, d: { x: 0, y: 0 } });
  const ai = createFugitiveAI({ rand: () => 0.99 });
  const plan = ai.plan(s);
  // (1,2)→(2,2)→(3,2)→(4,2)=телепорт→(7,2)→(8,2)→(9,2): 5 шагов, дальше ещё 2
  assert.equal(plan.dirs.length, 5, 'ход ограничен 5 шагами');
  assert.ok(plan.dirs.every((dd) => dd === 'right'), 'прямой путь через метро');
}

// 4. ДВОЙНИК: со 2-го хода ИИ предлагает клетку вне видимости детектива
{
  const exits = [{ x: 11, y: 1 }];
  const s = mkState({ exits, d: { x: 6, y: 2 }, turn: 2 });
  s.pathHistory[1] = { dirs: ['right'], start: { x: 1, y: 1 } }; // есть что повторять
  const ai = createFugitiveAI({ rand: () => 0 });
  const plan = ai.plan(s);
  assert.ok(plan.echoCell, 'ход 2: клетка для эха предложена');
  const dist = Math.abs(plan.echoCell.x - 6) + Math.abs(plan.echoCell.y - 2);
  assert.ok(dist > 3, 'эхо вне радиуса 3');
}

// 5. ход 1 — эха нет
{
  const exits = [{ x: 11, y: 1 }];
  const s = mkState({ exits, d: { x: 6, y: 2 }, turn: 1 });
  const ai = createFugitiveAI({ rand: () => 0 });
  const plan = ai.plan(s);
  assert.equal(plan.echoCell, null, 'ход 1: эха нет');
}

// 6. УКЛОНЕНИЕ: детектив рядом + rand < 0.3 — первый шаг увеличивает дистанцию
{
  const exits = [{ x: 11, y: 1 }];
  const s = mkState({ exits, f: { x: 5, y: 1 }, d: { x: 7, y: 1 }, turn: 1 });
  const ai = createFugitiveAI({ rand: () => 0.1 }); // срабатывает уклонение
  const plan = ai.plan(s);
  assert.ok(plan.dirs.length > 0);
  // первый шаг — не «right» (к детективу)
  assert.notEqual(plan.dirs[0], 'right', 'уклонение: не идём к детективу');
}

// 7. reset: цель забывается
{
  const exits = [{ x: 11, y: 1 }, { x: 11, y: 4 }];
  const s = mkState({ exits, d: { x: 0, y: 4 } });
  const ai = createFugitiveAI({ rand: () => 0.99 });
  ai.plan(s);
  ai.reset();
  assert.equal(ai.target, null, 'reset: цель сброшена');
}

console.log('fugitive-ai: OK (7 групп)');
