import { generateMap, STARTS } from '../js/core/map-generator.js';
import { reachable } from '../js/core/connectivity.js';
import { key, isPassable, metroPartner } from '../js/core/grid.js';
import { TILE, EXIT_KIND } from '../js/config/constants.js';
import { CONFIG } from '../js/config/config.js';
import assert from 'node:assert/strict';

for (let seed = 1; seed <= 200; seed++) {
  const m = generateMap(seed);

  // v0.10.0: 13-я строка — рельсы целиком; тематика выходов
  assert.equal(m.rows, 13, `seed ${seed}: строк не 13`);
  const railY = m.rows - 1;
  for (let x = 0; x < m.cols; x++)
    assert.equal(m.tiles[railY][x], TILE.RAIL, `seed ${seed}: рельсы не на последней строке`);
  const st = m.exits.find((e) => e.kind === EXIT_KIND.STATION);
  const pt = m.exits.find((e) => e.kind === EXIT_KIND.PORT);
  const ap = m.exits.find((e) => e.kind === EXIT_KIND.AIRPORT);
  assert.ok(st && st.y === railY - 1, `seed ${seed}: вокзал не над рельсами`);
  assert.ok(pt && Math.abs(pt.y - m.riverY) === 1, `seed ${seed}: порт не у реки`);
  assert.ok(ap, `seed ${seed}: нет аэропорта`);

  // v0.11.0: каждый выход — 2 клетки; главная: вокзал — правая,
  // порт — левая, аэропорт — нижняя; обе помечены EXIT
  for (const e of m.exits) {
    assert.equal(e.cells.length, 2, `seed ${seed}: выход не из 2 клеток`);
    for (const c of e.cells)
      assert.equal(m.tiles[c.y][c.x], TILE.EXIT, `seed ${seed}: клетка выхода не EXIT`);
  }
  assert.deepEqual(st.cells[1], { x: st.x - 1, y: st.y }, `seed ${seed}: вокзал не горизонтален (главная — правая)`);
  assert.deepEqual(pt.cells[1], { x: pt.x + 1, y: pt.y }, `seed ${seed}: порт не горизонтален (главная — левая)`);
  assert.deepEqual(ap.cells[1], { x: ap.x, y: ap.y - 1 }, `seed ${seed}: аэропорт не вертикален (главная — нижняя)`);
  // порт (обе клетки) не на соседней клетке с мостом
  for (const c of pt.cells)
    assert.ok(!m.bridges.some((b) => Math.abs(c.x - b) + Math.abs(c.y - m.riverY) <= 1),
      `seed ${seed}: порт у моста`);

  // река — ровно одна строка
  const riverRows = new Set();
  for (let y = 0; y < m.rows; y++)
    for (let x = 0; x < m.cols; x++)
      if (m.tiles[y][x] === TILE.RIVER) riverRows.add(y);
  assert.equal(riverRows.size, 1, `seed ${seed}: река не в одной строке`);

  // мосты ровно CONFIG.map.bridges и они на строке реки
  assert.equal(m.bridges.length, CONFIG.map.bridges, `seed ${seed}: мосты`);
  m.bridges.forEach((x) => assert.equal(m.tiles[m.riverY][x], TILE.BRIDGE));

  // подходы к мостам с обоих берегов не забиты стенами (GDD §5: переправа открыта)
  for (const x of m.bridges) {
    assert.ok(isPassable(m.tiles[m.riverY - 1][x]), `seed ${seed}: подход к мосту сверху забит (${x})`);
    assert.ok(isPassable(m.tiles[m.riverY + 1][x]), `seed ${seed}: подход к мосту снизу забит (${x})`);
  }

  // 3 выхода, все достижимы от беглеца
  assert.equal(m.exits.length, CONFIG.map.exits, `seed ${seed}: выходы`);
  const rf = reachable(m, STARTS.fugitive);
  m.exits.forEach((e) => assert.ok(rf.has(key(e.x, e.y)), `seed ${seed}: выход недостижим`));

  // метро: 2 пары, взаимные партнёры, достижимы обеими сторонами
  assert.equal(m.metroPairs.length, CONFIG.map.metroPairs, `seed ${seed}: метро`);
  const rd = reachable(m, STARTS.detective);
  for (const [a, b] of m.metroPairs) {
    const p = metroPartner(m, a.x, a.y);
    assert.deepEqual(p, { x: b.x, y: b.y }, `seed ${seed}: метро-пара разорвана`);
    assert.ok(rf.has(key(a.x, a.y)) && rf.has(key(b.x, b.y)), `seed ${seed}: метро F`);
    assert.ok(rd.has(key(a.x, a.y)) && rd.has(key(b.x, b.y)), `seed ${seed}: метро D`);
    // у станции не более 1 непроходимой клетки (стена/река/край) — иначе ловушка
    for (const c of [a, b]) {
      let blocked = 0;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= m.cols || ny >= m.rows) { blocked++; continue; }
        const t = m.tiles[ny][nx];
        if (t === TILE.WALL || t === TILE.RIVER || t === TILE.RAIL) blocked++;
      }
      assert.ok(blocked <= 1, `seed ${seed}: у станции (${c.x},${c.y}) блокировок ${blocked} > 1`);
    }
  }

  // старты проходимы
  for (const p of Object.values(STARTS))
    assert.ok(isPassable(m.tiles[p.y][p.x]), `seed ${seed}: старт заблокирован`);

  // детерминизм: тот же seed → та же карта
  assert.deepEqual(generateMap(seed).tiles, m.tiles, `seed ${seed}: недетерминированно`);
}
console.log('map-generator: OK (200 seed)');
