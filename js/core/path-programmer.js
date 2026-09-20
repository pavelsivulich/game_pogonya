import { bus } from './event-bus.js';
import { ERR } from '../config/constants.js';
import { createContext, validateStep, legalStepsFrom } from './path-validator.js';

function dirName(from, to) {
  if (to.y < from.y) return 'up';
  if (to.y > from.y) return 'down';
  if (to.x < from.x) return 'left';
  return 'right';
}

/**
 * Управляет процессом программирования пути одного персонажа.
 * maxSteps: 5 (беглец) или 10 (детектив).
 */
export class PathProgrammer {
  constructor({ store, who, maxSteps }) {
    this.store = store;
    this.who = who;
    this.maxSteps = maxSteps;
    this.reset();
  }

  reset() {
    const s = this.store.get();
    const actor = s.actors[this.who];
    const enemy = this.who === 'fugitive' ? s.actors.detective : null;
    this.ctx = createContext({
      map: s.map,
      actor: { x: actor.x, y: actor.y, path: [] },
      enemyPos: enemy ? { x: enemy.x, y: enemy.y } : null,
      blockedExits: s.blockedExits,
    });
    this.steps = [];   // { from, to, landOn, dir, marks[], metro }
    this.closed = false;
  }

  get current() {
    return this.steps.length
      ? this.steps[this.steps.length - 1].landOn
      : { x: this.ctx.actor.x, y: this.ctx.actor.y };
  }

  get remaining() { return this.maxSteps - this.steps.length; }

  /** Клик игрока. true — шаг принят. */
  click(cell) {
    if (this.closed) return false;
    if (this.remaining <= 0) return this.close(ERR.DEADLINE);

    const res = validateStep(this.ctx, cell);
    if (!res.ok) {
      bus.emit('path:reject', { who: this.who, cell, error: res.error });
      return false;
    }

    const from = this.current;
    const step = {
      from,
      to: cell,
      landOn: res.landOn,
      dir: dirName(from, cell),
      marks: res.marks,
      metro: res.marks.length > 1,
    };
    this.steps.push(step);
    this.ctx.actor.path.push(step);
    res.marks.forEach((m) => this.ctx.visited.add(m));

    bus.emit('path:step', { who: this.who, step });

    // Тупик → досрочное закрытие (шаги сгорают, ожидания нет)
    if (this.remaining > 0 && legalStepsFrom(this.ctx, this.current).length === 0) {
      this.close(ERR.DEAD_END);
    } else if (this.remaining === 0) {
      this.close(null);
    }
    return true;
  }

  /** Отменить последний шаг. */
  undo() {
    if (this.closed || !this.steps.length) return false;
    const step = this.steps.pop();
    this.ctx.actor.path.pop();
    step.marks.forEach((m) => this.ctx.visited.delete(m));
    this.closed = false;
    bus.emit('path:undo', { who: this.who });
    return true;
  }

  close(reason = null) {
    if (this.closed) return false;
    this.closed = true;
    this.store.setPath(this.who, this.steps.map((s) => s.dir));
    bus.emit('path:closed', {
      who: this.who,
      steps: this.steps.length,
      wasted: this.maxSteps - this.steps.length,
      reason,
    });
    return true;
  }
}
