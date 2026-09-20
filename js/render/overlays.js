import { COLORS } from '../config/constants.js';
import { CONFIG } from '../config/config.js';
import { visibleCells } from '../core/visibility.js';

const C = CONFIG.grid.cell;

/**
 * Оверлеи фазы программирования (игрок = беглец):
 * 1. Красная штриховка — зона видимости детектива (сюда нельзя).
 * 2. Пунктирная связь между клетками метро-пары.
 * (v0.16.1: контур стартовой клетки убран — спрайты актёров самодостаточны.)
 */
export function drawProgrammingOverlays(ctx, { map, actors, programmer }) {
  if (!map) return;

  // 1. Зона видимости детектива
  const vis = visibleCells(map, actors.detective);
  ctx.save();
  ctx.fillStyle = COLORS.danger;
  for (const c of vis) {
    ctx.fillRect(c.x * C, c.y * C, C, C);
  }
  // пульс по краю ромба
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
  ctx.strokeStyle = COLORS.blood;
  ctx.globalAlpha = 0.25 + 0.25 * pulse;
  for (const c of vis) {
    const isEdge = ![[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) =>
      vis.some((v) => v.x === c.x + dx && v.y === c.y + dy));
    if (isEdge) ctx.strokeRect(c.x * C + 0.5, c.y * C + 0.5, C - 1, C - 1);
  }
  ctx.restore();

  // 2. Связи метро-пар
  ctx.save();
  ctx.strokeStyle = COLORS.paper;
  ctx.globalAlpha = 0.15;
  ctx.setLineDash([2, 6]);
  for (const [a, b] of map.metroPairs) {
    ctx.beginPath();
    ctx.moveTo(a.x * C + C / 2, a.y * C + C / 2);
    ctx.lineTo(b.x * C + C / 2, b.y * C + C / 2);
    ctx.stroke();
  }
  ctx.restore();
}
