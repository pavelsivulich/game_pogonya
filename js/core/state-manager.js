import { bus } from './event-bus.js';
import { PHASE } from '../config/constants.js';
import { CONFIG } from '../config/config.js';
import { STARTS } from './map-generator.js';

const state = {
  phase: PHASE.BOOT,
  turn: 1,
  maxTurns: CONFIG.turn.maxTurns,
  round: 1,                      // 1..CONFIG.game.roundCount (GDD §3)
  playerRole: 'fugitive',        // роль игрока в текущем раунде
  roundResults: {},              // { 1: 'fugitive'|'detective', 2: ... }
  map: null,                 // { cols, rows, tiles[], metroPairs[], exits[] }
  actors: {
    fugitive:  { id: 'fugitive',  x: 1,  y: 1,  path: [], alive: true },
    detective: { id: 'detective', x: 18, y: 10, path: [], alive: true,
                 lastKnown: null,      // { x, y } — последняя видимая позиция беглеца
                 patrolTarget: null,   // цель патрулирования (GDD §10)
                 waitTurns: 0,         // сколько ходов ждёт на последней позиции
                 epiphanyUntilTurn: 0 }, // озарение: видит беглеца до конца этого хода
    echo:      { id: 'echo',      x: 0,  y: 0,  path: [], start: null, active: false, captured: false },
  },
  blockedExits: new Set(),   // 'x,y' — финальные точки, сожжённые навсегда
  revealedExits: new Set(),  // 'x,y' — блокировки, которые игрок уже узнал (GDD §9)
  pathHistory: {},           // { [turn]: ['up','right',...] } — для двойника
  lastKnownFugitive: null,   // { x, y, turn }
  result: null,
};

export const store = {
  get: () => state,

  setPhase(phase) {
    const prev = state.phase;
    state.phase = phase;
    bus.emit('phase:change', { prev, next: phase });
  },

  setMap(map) { state.map = map; bus.emit('map:set', map); },

  setPath(who, path) {
    state.actors[who].path = path;
    bus.emit('path:set', { who, path });
  },

  // v0.11.0: выход двухклеточный — блокируем обе клетки (ключи в blockedExits),
  // чтобы проверки has(key) работали для любой клетки выхода.
  blockExit(exit) {
    for (const c of exit.cells ?? [exit]) state.blockedExits.add(`${c.x},${c.y}`);
    bus.emit('exit:blocked', { x: exit.x, y: exit.y });
  },

  nextTurn() {
    state.turn += 1;
    const e = state.actors.echo;      // двойник живёт 1 фазу — сброс к новому ходу
    e.active = false; e.captured = false; e.path = [];
    bus.emit('turn:change', { turn: state.turn });
  },

  // Записать ход для двойника: направления + стартовая позиция беглеца.
  recordPath(turn, dirs, start) {
    state.pathHistory[turn] = { dirs: dirs.slice(), start: { ...start } };
  },

  // Маршрут предыдущего хода (для воспроизведения двойником).
  getPreviousPath(turn) {
    const prev = state.pathHistory[turn - 1];
    return prev ? { dirs: prev.dirs.slice(), start: { ...prev.start } } : null;
  },

  finish(result) {
    state.result = result;
    state.phase = PHASE.GAME_OVER;
    bus.emit('game:over', { result });
  },

  // Новый раунд: та же карта, сброс позиций/истории, смена ролей (GDD §3).
  resetForRound(round) {
    state.round = round;
    state.playerRole = round === 1 ? 'fugitive' : 'detective';
    state.turn = 1;
    state.result = null;
    if (round === 1) state.roundResults = {}; // новая партия — чистый счёт
    state.pathHistory = {};
    state.blockedExits = new Set();
    state.revealedExits = new Set();
    state.lastKnownFugitive = null;
    const { map, actors } = state;
    actors.fugitive.x = STARTS.fugitive.x; actors.fugitive.y = STARTS.fugitive.y;
    actors.detective.x = STARTS.detective.x; actors.detective.y = STARTS.detective.y;
    for (const a of Object.values(actors)) { a.path = []; }
    const e = actors.echo;
    e.active = false; e.captured = false; e.start = null;
    actors.detective.lastKnown = null;
    actors.detective.patrolTarget = null;
    actors.detective.waitTurns = 0;
    actors.detective.epiphanyUntilTurn = 0;
    bus.emit('round:reset', { round, playerRole: state.playerRole, map });
  },

  setRoundResult(round, winner) {
    state.roundResults[round] = winner;
    bus.emit('round:result', { round, winner });
  },
};
