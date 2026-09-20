import { generateMap, STARTS } from '../js/core/map-generator.js';
import { planDetectivePath, patrolPosts } from '../js/core/detective-ai.js';
import { isPassable, tileAt } from '../js/core/grid.js';
import { hasLineOfSight } from '../js/core/visibility.js';
import { CONFIG } from '../js/config/config.js';
import assert from 'node:assert/strict';

const STEPS = CONFIG.turn.detectiveSteps;
const R = CONFIG.vision.detectiveRadius;
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const mkState = (map, d, f, opts = {}) => ({
  map,
  actors: {
    detective: {
      x: d.x, y: d.y, epiphanyUntilTurn: 0, lastKnown: null, patrolTarget: null,
      ...(opts.detective || {}),
    },
    fugitive: { x: f.x, y: f.y },
    echo: { active: false, captured: false, x: 0, y: 0 },
  },
  blockedExits: new Set(opts.blocked || []),
  turn: 1,
});

const map = generateMap(7);
const d = { ...STARTS.detective };

// беглец далеко и не виден — детектив гарантированно в режиме патруля
let far = null;
for (let y = 0; y < map.rows && !far; y++) {
  for (let x = 0; x < map.cols && !far; x++) {
    if (!isPassable(tileAt(map, x, y))) continue;
    if (manhattan({ x, y }, d) <= R) continue;
    if (hasLineOfSight(map, d, { x, y })) continue;
    far = { x, y };
  }
}
assert.ok(far, 'нет далёкой невидимой клетки для бегльца');

/* --- A. Патруль использует ВЕСЬ бюджет шагов (без «ожиданий») --- */
{
  const s = mkState(map, d, far);
  const posts = patrolPosts(s);
  assert.ok(posts.length >= 1, 'на сгенерированной карте должен быть хотя бы 1 пост');
  const dirs = planDetectivePath(s);
  assert.equal(dirs.length, STEPS, 'патруль обязан использовать весь бюджет');
}

/* --- B. Разворот к другому посту в том же ходу --- */
{
  const posts = patrolPosts(mkState(map, d, far));
  assert.equal(posts.length, 2, 'должно быть 2 поста (2 незаблокированных выхода)');
  // стартуем ровно на первом посту: путь до него 0 — разворот к другому сразу
  const s = mkState(map, posts[0], far);
  const dirs = planDetectivePath(s);
  assert.equal(dirs.length, STEPS, 'разворот не должен «съедать» бюджет');
  // цель патруля переключилась на другой пост
  const t = s.actors.detective.patrolTarget;
  assert.ok(t && !(t.x === posts[0].x && t.y === posts[0].y), 'patrolTarget должен смениться');
}

/* --- C. Заблокированные выходы игнорируются --- */
{
  const blocked2 = map.exits.slice(0, 2).map((e) => `${e.x},${e.y}`);
  assert.equal(patrolPosts(mkState(map, d, far, { blocked: blocked2 })).length, 1);
  const blockedAll = map.exits.map((e) => `${e.x},${e.y}`);
  assert.equal(patrolPosts(mkState(map, d, far, { blocked: blockedAll })).length, 0);
  assert.deepEqual(planDetectivePath(mkState(map, d, far, { blocked: blockedAll })), []);
}

/* --- D. Преследование: видимый беглец → цель — он, lastKnown обновляется --- */
{
  let adj = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = { x: d.x + dx, y: d.y + dy };
    if (c.x < 0 || c.y < 0 || c.x >= map.cols || c.y >= map.rows) continue;
    if (!isPassable(tileAt(map, c.x, c.y))) continue;
    if (!hasLineOfSight(map, d, c)) continue;
    adj = c; break;
  }
  assert.ok(adj, 'нет соседней видимой клетки');
  const s = mkState(map, d, adj);
  const dirs = planDetectivePath(s);
  assert.ok(dirs.length >= 1, 'должен сделать шаг к бегльцу');
  assert.deepEqual(s.actors.detective.lastKnown, adj, 'lastKnown должен обновиться');
}

/* --- E. Дошли до lastKnown, бегльца нет → улика исчерпана, сразу патруль --- */
{
  const s = mkState(map, d, far, { detective: { lastKnown: { x: d.x, y: d.y } } });
  const dirs = planDetectivePath(s);
  assert.equal(s.actors.detective.lastKnown, null, 'улика должна быть сброшена');
  assert.equal(dirs.length, STEPS, 'переход в патруль — полный бюджет');
}

console.log('detective-ai: ok');
