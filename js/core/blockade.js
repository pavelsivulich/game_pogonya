import { bfsPath } from './pathfinding.js';

/**
 * v0.6.0 «блокировка» (GDD §9): детектив в начале раунда закрывает 1 из 3 выходов.
 * Беглец НЕ знает, какой именно, — узнаёт только при достижении.
 *
 * Стратегии ИИ:
 *  • 'random'  — случайная точка (по умолчанию, GDD);
 *  • 'nearest' — ближайшая к старту беглеца по BFS (недоступные игнорируются).
 *
 * @param rand — источник случайности (инжектится для тестов).
 * @returns координата выхода или null, если выходов нет.
 */
export function chooseBlockadeAI({ map, fugitiveStart, strategy = 'random', rand = Math.random }) {
  const exits = map?.exits ?? [];
  if (!exits.length) return null;

  if (strategy === 'nearest') {
    let best = null;
    let bestLen = Infinity;
    for (const e of exits) {
      const p = bfsPath(map, fugitiveStart, e);
      const len = p ? p.length : Infinity;
      if (len < bestLen) { bestLen = len; best = e; }
    }
    if (best) return best;
    // все недостижимы (не должно случаться) — откат к случайной
  }
  return exits[Math.floor(rand() * exits.length)];
}
