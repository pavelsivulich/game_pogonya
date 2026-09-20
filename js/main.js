import { store } from './core/state-manager.js';
import { bus } from './core/event-bus.js';
import { GameLoop } from './core/game-loop.js';
import { PathProgrammer } from './core/path-programmer.js';
import { generateMap as gen, STARTS } from './core/map-generator.js';
import { resolveTurn } from './core/turn-resolver.js';
import {
  echoRequired, validateEchoPlacement, hasLegalEchoCell, applyEchoPlacement,
} from './core/echo-placer.js';
import { chooseBlockadeAI } from './core/blockade.js';
import { exitAt } from './core/grid.js';
import { createFugitiveAI } from './core/fugitive-ai.js';
import { planDetectivePath } from './core/detective-ai.js';
import { createRenderer } from './render/renderer.js';
import { createDecor } from './render/decor.js';
import { createScreens } from './ui/screens.js';
import { createIntro } from './ui/intro.js';
import { createSoundMenu } from './ui/sound-menu.js';
import { attachSfx, sfx } from './audio/sfx.js';
import { createMusicPlayer, createIntroTrack } from './audio/music-player.js';
import { CONFIG } from './config/config.js';
import { PHASE, ROLE } from './config/constants.js';

const logEl = document.getElementById('log');
const hudPhase = document.getElementById('hud-phase');
const hudTurn = document.getElementById('hud-turn');
const hudInfo = document.getElementById('hud-info');
const canvas = document.getElementById('game');
const screens = createScreens({ canvas });
// v0.13.0: кнопка настроек звука (правый верхний угол поля)
const soundMenu = createSoundMenu({ parent: canvas.parentElement });

// v0.15.1: консоль скрыта по умолчанию; ›_ рядом с ♪ включает/выключает
const logBtn = document.createElement('button');
logBtn.id = 'log-btn';
logBtn.title = 'Показать/скрыть консоль';
logBtn.textContent = '>_';
logBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const on = logEl.classList.toggle('visible');
  logBtn.classList.toggle('active', on);
  if (on) logEl.scrollTop = logEl.scrollHeight;
});
canvas.parentElement.appendChild(logBtn);

// v0.16.3: кнопка «?» — правила поверх игры (возврат — просто закрыть)
const helpBtn = document.createElement('button');
helpBtn.id = 'help-btn';
helpBtn.title = 'Правила';
helpBtn.textContent = '?';
helpBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  screens.showRules({ onBack: () => screens.hide() });
});
canvas.parentElement.appendChild(helpBtn);

const log = (m) => {
  logEl.textContent += `${m}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(m);
};

/* ---------- карта ---------- */

function generateMap() {
  const seedParam = Number(new URLSearchParams(location.search).get('seed'));
  const m = gen(Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Date.now());
  const s = store.get();
  s.actors.fugitive.x = STARTS.fugitive.x;  s.actors.fugitive.y = STARTS.fugitive.y;
  s.actors.detective.x = STARTS.detective.x; s.actors.detective.y = STARTS.detective.y;
  s.blockedExits.clear();
  s.revealedExits.clear();
  log(`map: seed=${m.seedUsed} attempt=${m.attempt} walls=${m.walls} riverY=${m.riverY}`);
  return m;
}

/* ---------- партия и раунды (v0.7.0, GDD §3) ---------- */

const fugitiveAI = createFugitiveAI();
let blockadePending = false;   // ждём выбора блокировки игроком-детективом

bus.on('round:begin', ({ round }) => beginRound(round));

function beginRound(round) {
  if (round > 1) store.resetForRound(round);
  fugitiveAI.reset();          // цель выхода не переносится между раундами
  resolving = false;
  echoPending = false;
  programmer = null;
  const s = store.get();
  log(`=== РАУНД ${round}: ты играешь за ${s.playerRole === ROLE.FUGITIVE ? 'БЕГЛЕЦА' : 'ДЕТЕКТИВА'} ===`);
  // Интро раунда (GDD §12): смена ролей — через экран
  screens.showRoundIntro({
    round, playerRole: s.playerRole, onContinue: () => { screens.hide(); beginRoundPlay(round); },
  });
}

/** Начало игровой части раунда (после экрана-интро). */
function beginRoundPlay(round) {
  const s = store.get();
  if (round === 1) {
    // ИИ-детектив блокирует выход тайно (GDD §9)
    const blocked = chooseBlockadeAI({
      map: s.map, fugitiveStart: STARTS.fugitive,
      strategy: CONFIG.blockade.aiStrategy, rand: Math.random,
    });
    if (blocked) store.blockExit(blocked);
    startPlayerPhase();
  } else {
    // игрок-детектив выбирает блокировку сам
    blockadePending = true;
    store.setPhase(PHASE.BLOCKADE_CHOICE);
    hudInfo.textContent = 'ВЫБЕРИ ВЫХОД ДЛЯ БЛОКИРОВКИ (клик по ромбу)';
  }
}

function startPlayerPhase() {
  const s = store.get();
  if (s.playerRole === ROLE.FUGITIVE) {
    store.setPhase(PHASE.PROGRAM_FUGITIVE);
    bus.emit('program:open', { who: 'fugitive', maxSteps: CONFIG.turn.fugitiveSteps });
  } else {
    store.setPhase(PHASE.PROGRAM_DETECTIVE);
    bus.emit('program:open', { who: 'detective', maxSteps: CONFIG.turn.detectiveSteps });
  }
}

function tryPlaceBlockade(cell) {
  const s = store.get();
  // v0.11.0: клик по ЛЮБОЙ из двух клеток выхода выбирает весь выход
  const exit = exitAt(s.map, cell.x, cell.y);
  if (!exit) {
    bus.emit('path:reject', { cell, error: 'NOT_AN_EXIT' });
    return false;
  }
  store.blockExit(exit);
  blockadePending = false;
  log(`blockade: ты закрыл выход (${exit.x},${exit.y}) — ИИ-беглец об этом не знает`);
  startPlayerPhase();
  return true;
}

/** Ход ИИ-беглеца: план + эхо (раунд 2). */
function runFugitiveAI(s) {
  const plan = fugitiveAI.plan(s);
  s.actors.fugitive.path = plan.dirs;
  if (plan.dirs.length) {
    store.recordPath(s.turn, plan.dirs, { x: s.actors.fugitive.x, y: s.actors.fugitive.y });
  }
  if (plan.echoCell) {
    const prev = store.getPreviousPath(s.turn);
    if (prev) {
      applyEchoPlacement(store, plan.echoCell, prev);
      log(`echo(ИИ): двойник в (${plan.echoCell.x},${plan.echoCell.y})`);
    }
  }
}

/* ---------- ввод и программирование пути ---------- */

let programmer = null;
let hover = null;
let errorCell = null;
let errorTimer = 0;

const C = CONFIG.grid.cell;

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  hover = { x: Math.floor((e.clientX - r.left) / C), y: Math.floor((e.clientY - r.top) / C) };
});
canvas.addEventListener('mouseleave', () => { hover = null; });

canvas.addEventListener('click', () => {
  if (!hover) return;
  if (blockadePending) { tryPlaceBlockade(hover); return; }
  if (echoPending) { tryPlaceEcho(hover); return; }
  if (!programmer || programmer.closed) return;
  programmer.click(hover);
  updateHud();
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (programmer && programmer.undo()) updateHud();
});

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') { screens.hide(); newGame(); return; }
  if (!programmer) return;
  if (e.key === 'Backspace') { programmer.undo(); updateHud(); e.preventDefault(); }
  if (e.key === 'Enter') { programmer.close(null); updateHud(); }
});

bus.on('program:open', ({ who, maxSteps }) => {
  programmer = new PathProgrammer({ store, who, maxSteps });
  updateHud();
});

bus.on('path:reject', ({ cell, error }) => {
  errorCell = { ...cell };
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => { errorCell = null; }, 500);
  log(`✗ ${error} (${cell.x},${cell.y})`);
});
bus.on('path:undo', () => log('↶ undo'));
bus.on('echo:caught', ({ x, y, epiphanyUntilTurn }) =>
  log(`⚡ эхо поймано (${x},${y}) — озарение: детектив видит беглеца до хода ${epiphanyUntilTurn}`));
bus.on('exit:blocked:hit', ({ x, y }) =>
  log(`⛔ ТОЧКА ЗАБЛОКИРОВАНА! (${x},${y}) — иди к другой`));
bus.on('echo:fade', () => log('echo: двойник исчез (фаза завершена)'));
/* ---------- воспроизведение хода ---------- */

let resolving = false;
let echoPending = false;   // ждём размещения двойника (v0.5.0)

/** Попытка поставить двойника в клетку cell. true — размещён. */
function tryPlaceEcho(cell) {
  const s = store.get();
  const prev = store.getPreviousPath(s.turn);
  const res = validateEchoPlacement({
    map: s.map, cell, detective: s.actors.detective, actors: s.actors,
  });
  if (!res.ok) {
    bus.emit('path:reject', { who: 'echo', cell, error: res.error });
    return false;
  }
  applyEchoPlacement(store, cell, prev);
  sfx.echoAppear();
  echoPending = false;
  log(`echo: двойник в (${cell.x},${cell.y}), повтор ${prev.dirs.length} шагов хода ${s.turn - 1}`);
  updateHud();
  runTurn();
  return true;
}

bus.on('path:closed', ({ who, steps, wasted, reason }) => {
  log(`✓ ${who}: путь ${steps} шагов, сгорело ${wasted}${reason ? ` (${reason})` : ''}`);
  if (resolving) return;
  const s = store.get();
  const playerIsFugitive = s.playerRole === ROLE.FUGITIVE;

  // история нужна для двойника — её ведёт беглец (игрок или ИИ)
  if (who === 'fugitive' && programmer && steps > 0) {
    store.recordPath(
      s.turn,
      programmer.steps.map((st) => st.dir),
      { x: programmer.ctx.actor.x, y: programmer.ctx.actor.y },
    );
  }

  // игрок-детектив завершил погоню → сразу воспроизведение
  if (!playerIsFugitive) { runTurn(); return; }

  if (steps <= 0) { runTurn(); return; } // тупик на старте: ход всё равно играет (детектив ходит)
  // v0.5.0: со 2-го хода — пауза на размещение двойника
  const prev = store.getPreviousPath(s.turn);
  if (echoRequired(s.turn, prev) &&
      hasLegalEchoCell({ map: s.map, detective: s.actors.detective, actors: s.actors })) {
    echoPending = true;
    log('echo: кликни клетку ВНЕ видимости детектива — разместить двойника');
    updateHud();
    return;
  }
  runTurn();
});

async function runTurn() {
  resolving = true;
  const s = store.get();
  const playerIsFugitive = s.playerRole === ROLE.FUGITIVE;

  // планы ИИ: в раунде 1 думает детектив, в раунде 2 — беглец
  if (playerIsFugitive) s.actors.detective.path = planDetectivePath(s);
  else runFugitiveAI(s);

  store.setPhase(PHASE.RESOLVE);
  hudInfo.textContent = 'воспроизведение…';

  const result = await resolveTurn({ store, bus });

  if (result === 'continue' && s.turn >= CONFIG.turn.maxTurns) {
    // таймаут раунда = победа детектива (GDD §17.1)
    finishRound('detective', 'время вышло');
    return;
  }

  if (result === 'continue') {
    store.nextTurn();
    resolving = false;
    startPlayerPhase();
  } else {
    // 'escape' — победил беглец, 'caught' — детектив
    finishRound(result === 'escape' ? 'fugitive' : 'detective');
  }
}

/**
 * Итог раунда → следующий раунд или экран медали (GDD §3/§11).
 */
function finishRound(winner, note = '') {
  const s = store.get();
  store.setRoundResult(s.round, winner);
  log(`=== РАУНД ${s.round}: победил ${winner === 'fugitive' ? 'БЕГЛЕЦ' : 'ДЕТЕКТИВ'}${note ? ` (${note})` : ''} ===`);

  if (s.round < CONFIG.game.roundCount) {
    store.setPhase(PHASE.ROUND_RESULT);
    hudInfo.textContent = `РАУНД ${s.round}: ${winner === 'fugitive' ? 'побег' : 'поимка'}`;
    resolving = false;
    screens.showRoundResult({
      round: s.round, winner,
      onContinue: () => { screens.hide(); bus.emit('round:begin', { round: s.round + 1 }); },
    });
    return;
  }

  resolving = false;
  store.finish(winner);
  hudPhase.textContent = PHASE.GAME_OVER;
  hudInfo.textContent = medalText();
  log(`=== ПАРТИЯ: ${medalText()} ===`);
  const r = store.get().roundResults;
  sfx.medal([r[1] === 'fugitive', r[2] === 'detective'].filter(Boolean).length);
  screens.showMedal({
    results: store.get().roundResults,
    onRestart: () => { screens.hide(); newGame(); },
  });
}

/** Новая партия: свежая карта, раунд 1 (GDD §3). */
function newGame() {
  store.resetForRound(1); // раунд 1 также очищает roundResults
  store.setMap(generateMap());
  decor.reset(); // анимации decor'а отвязываем от старой карты
  bus.emit('round:begin', { round: 1 });
}

function medalText() {
  const r = store.get().roundResults;
  // победа «своей» стороной: раунд 1 — за беглеца, раунд 2 — за детектива
  const wins = [r[1] === 'fugitive', r[2] === 'detective'].filter(Boolean).length;
  return wins === 2 ? '🥇 ДВУСТОРОННЯЯ МЕДАЛЬ'
    : wins === 1 ? '🥉 ОДНОСТОРОННЯЯ МЕДАЛЬ'
    : 'БЕЗ МЕДАЛИ';
}

function updateHud() {
  if (blockadePending) {
    hudInfo.textContent = 'ВЫБЕРИ ВЫХОД ДЛЯ БЛОКИРОВКИ (клик по ромбу)';
    return;
  }
  if (echoPending) {
    hudInfo.textContent = 'РАЗМЕСТИ ДВОЙНИКА: клик вне видимости детектива';
    return;
  }
  if (!programmer) return;
  hudInfo.textContent =
    `${programmer.who}: ${programmer.steps.length}/${programmer.maxSteps}` +
    (programmer.closed ? ' [готов]' : '');
}

/* ---------- HUD/события ---------- */

bus.on('phase:change', ({ prev, next }) => {
  hudPhase.textContent = next;
  log(`phase: ${prev} → ${next}`);
});
bus.on('turn:change', ({ turn }) => { hudTurn.textContent = `Turn ${turn}`; });
bus.on('map:set', (m) => log(`map: ${m.cols}×${m.rows}, exits=${m.exits.length}`));

/* ---------- запуск ---------- */

const decor = createDecor();

const render = createRenderer(canvas, () => ({
  map: store.get().map,
  actors: store.get().actors,
  playerRole: store.get().playerRole,
  blockedExits: store.get().blockedExits,
  revealedExits: store.get().revealedExits,
  hover,
  errorCell,
  pathSteps: programmer ? programmer.steps : null,
  // v0.16.2: фаза выбора блока — выходы должны подсвечиваться сквозь туман
  blockadeChoice: blockadePending,
  // оверлеи (зона видимости, метро) нужны и во время размещения двойника
  programming: !!programmer && (!programmer.closed || echoPending),
  programmer,
}), decor);

const loop = new GameLoop({ generateMap, resolveTurn: null, render });
loop.start(); // только render-цикл; партия стартует по кнопке меню
attachSfx(bus);

// v0.14.0: фоновая музыка игры (лейбл-плеер с кроссфейдом)
const music = createMusicPlayer({
  files: [
    'augmented_atmosphere.mp3', 'behind_the_lines.mp3', 'chasing_ghosts.mp3',
    'cheat_code.mp3', 'digital_drift.mp3', 'high_stacks.mp3',
  ],
});
// v0.15.5: intro.mp3 — зацикленный трек заставки; при входе в игру
// переключаемся на основной плейлист.
const introTrack = createIntroTrack({ file: 'intro.mp3' });

// v0.15.0: заставка вместо стартового меню (анимация + кнопки)
const intro = createIntro({
  parent: canvas.parentElement,
  onEnter: () => introTrack.start(),
  onPlay: () => { introTrack.stop(); music.start(); loop.startGame(); },
  onRules: () => { introTrack.stop(); music.start(); screens.showRules({ onBack: () => intro.show() }); },
});

log('ПОГОНЯ — boot ok');
log('ЛКМ — шаг | ПКМ/Backspace — отмена | Enter — завершить | R — новая партия');