import { store } from './state-manager.js';
import { bus } from './event-bus.js';
import { PHASE } from '../config/constants.js';
import { CONFIG } from '../config/config.js';

/**
 * КОНТРАКТ ТИКА (решение №1):
 *   for r in 0..4: fugitive.step(r) → detective.step(2r) → detective.step(2r+1) → echo.step(r)
 * Поимка проверяется после КАЖДОГО микро-шага.
 */
export function buildMicroSchedule() {
  const schedule = [];
  for (let r = 0; r < CONFIG.turn.microRounds; r++) {
    schedule.push({ who: 'fugitive', step: r });
    schedule.push({ who: 'detective', step: r * 2 });
    schedule.push({ who: 'detective', step: r * 2 + 1 });
    schedule.push({ who: 'echo', step: r });
  }
  return schedule;
}

export class GameLoop {
  constructor({ generateMap, resolveTurn, render }) {
    this.generateMap = generateMap;
    this.resolveTurn = resolveTurn;   // подключается в Фазе 4
    this.render = render;
    this.last = 0;
    this.running = false;
  }

  start() {
    this.running = true;
    requestAnimationFrame(this.frame);
  }

  /** Старт/рестарт партии (после нажатия «НОВАЯ ИГРА» в меню). */
  startGame() {
    this.enter(PHASE.MAP_GEN);
  }

  enter(phase) {
    store.setPhase(phase);
    switch (phase) {
      case PHASE.MAP_GEN:
        store.setMap(this.generateMap());
        // v0.7.0: дальше партией управляет main.js (раунды, роли, блокировка)
        bus.emit('round:begin', { round: 1 });
        break;
      case PHASE.PROGRAM_FUGITIVE:
        bus.emit('program:open', { who: 'fugitive', maxSteps: CONFIG.turn.fugitiveSteps });
        break;
      // PROGRAM_DETECTIVE / RESOLVE подключаются в Фазе 4 и 10
      default:
        break;
    }
  }

  frame = (t) => {
    if (!this.running) return;
    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;
    this.render(dt);
    requestAnimationFrame(this.frame);
  };
}
