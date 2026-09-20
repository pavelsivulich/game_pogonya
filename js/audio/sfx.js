/**
 * Звук (GDD §13) — чистый WebAudio-синтез, без аудиофайлов.
 * Нуарная палитра: короткие щелчки, глухие удары, тревожные гудки.
 * Мэппинг на события event-bus — в attachSfx().
 */
let ctx = null;
let enabled = true;

/* --- Громкость (v0.13.0): две мастер-шины WebAudio.
 * sfxBus — все эффекты; musicBus — музыка (плеера пока нет, шина готова).
 * Музыка играет через musicBus, НЕ через DOM-оверлеи, поэтому открытие
 * окна настроек её не останавливает — WebAudio живёт независимо от вёрстки.
 * Значения сохраняются в localStorage. --- */
let sfxBus = null;
let musicBus = null;
const clamp01 = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : def;
};
/* --- Кривая громкости (v0.14.1): экспоненциальная, равнотзывчивая.
 * Линейный gain субъективно «взрывается» в верхней половине: 30% уже громко.
 * gain = (A^v − 1)/(A − 1), A=100 (диапазон 40 дБ): каждый ход ползунка
 * на 10% ощущается одинаковым шагом. 50% → 0.1 (фон), 100% → 1.0 (слушаем).
 * В localStorage хранится значение ПОЛЗУНКА (0..1), кривая — только к gain. --- */
const CURVE_A = 100;
const volumeCurve = (v) => (Math.pow(CURVE_A, v) - 1) / (CURVE_A - 1);
let sfxVol = clamp01(localStorage.getItem('fvd.sfxVol'), 1);
let musicVol = clamp01(localStorage.getItem('fvd.musicVol'), 1);

function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // мастер-шины громкости (v0.13.0), кривая — v0.14.1
    sfxBus = ctx.createGain();
    sfxBus.gain.value = volumeCurve(sfxVol);
    sfxBus.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = volumeCurve(musicVol);
    musicBus.connect(ctx.destination);
    loadSamples(); // v0.12.0: OGG-семплы грузятся лениво при первом звуке
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Мастер-громкость эффектов (0..1 — значение ползунка; к gain — кривая). */
export function setSfxVolume(v) {
  sfxVol = clamp01(v, sfxVol);
  localStorage.setItem('fvd.sfxVol', String(sfxVol));
  if (sfxBus) sfxBus.gain.value = volumeCurve(sfxVol);
  return sfxVol;
}
/** Мастер-громкость музыки (0..1 — значение ползунка; к gain — кривая). */
export function setMusicVolume(v) {
  musicVol = clamp01(v, musicVol);
  localStorage.setItem('fvd.musicVol', String(musicVol));
  if (musicBus) musicBus.gain.value = volumeCurve(musicVol);
  return musicVol;
}
export const getSfxVolume = () => sfxVol;
export const getMusicVolume = () => musicVol;
/** Мастер-шина музыки для внешнего плеера (v0.14.0). null, если WebAudio нет. */
export function getMusicBus() { audioCtx(); return musicBus; }

/** Один тон с огибающей. type: sine|square|sawtooth|triangle. */
function tone({ freq = 440, dur = 0.08, type = 'square', gain = 0.08, slide = 0, delay = 0 }) {
  const ac = audioCtx();
  if (!ac || !enabled) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Короткий шум (стук/шаг). */
function noise({ dur = 0.05, gain = 0.06, delay = 0 }) {
  const ac = audioCtx();
  if (!ac || !enabled) return;
  const t0 = ac.currentTime + delay;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  const g = ac.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(sfxBus);
  src.start(t0);
}

/* --- Библиотека OGG-семплов (v0.12.0): assets/audio/*.ogg.
 * Файл появился — подхватывается; 404/ошибка декодирования молча
 * оставляют процедурный fallback. Имена — с учётом регистра на Linux-серверах. --- */
const samples = {}; // name -> AudioBuffer
const SAMPLE_FILES = {
  footstep: ['Footstep1.ogg', 'Footstep2.ogg', 'Footstep3.ogg', 'Footstep4.ogg', 'Footstep5.ogg'],
  stepPlaced: ['stepPlaced.ogg'],
  caught: ['caught.ogg'],
  metro: ['metro.ogg'],
};

/** Играет случайный семпл из группы (или null, если группа не загружена). */
function playSample(name, gain = 0.5) {
  const ac = audioCtx();
  if (!ac || !enabled) return false;
  const pool = samples[name];
  if (!pool || !pool.length) return false;
  const buf = pool[Math.floor(Math.random() * pool.length)];
  const src = ac.createBufferSource();
  const g = ac.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(sfxBus);
  src.start();
  return true;
}

/** Асинхронно грузит все семплы; вызывается лениво при первом звуке. */
let samplesLoading = false;
function loadSamples() {
  if (samplesLoading || !audioCtx()) return;
  samplesLoading = true;
  const ac = audioCtx();
  for (const [name, files] of Object.entries(SAMPLE_FILES)) {
    for (const file of files) {
      fetch(`assets/audio/${file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(file))))
        .then((ab) => ac.decodeAudioData(ab))
        .then((buf) => { (samples[name] ??= []).push(buf); })
        .catch(() => { /* файла нет — остаётся синтез */ });
    }
  }
}

export const sfx = {
  setEnabled(v) { enabled = v; },
  isEnabled: () => enabled,

  // v0.12.0: прокладка шага на карте — OGG/WAV-семпл; синтез — fallback
  // v0.12.2: шаги на 50% тише (0.4 → 0.2)
  stepPlaced: () => { if (!playSample('stepPlaced', 0.2)) tone({ freq: 900, dur: 0.04, type: 'square', gain: 0.05 }); },
  error:      () => tone({ freq: 120, dur: 0.18, type: 'sawtooth', gain: 0.09 }),
  undo:       () => tone({ freq: 500, dur: 0.05, slide: -250, gain: 0.05 }),
  execute:    () => tone({ freq: 300, dur: 0.15, slide: 500, type: 'triangle', gain: 0.07 }),
  // v0.12.0: шаги — OGG-семплы (5 вариантов, случайный); синтез — fallback
  // v0.12.2: шаги тише (0.35 → 0.1)
  stepWalk:   () => { if (!playSample('footstep', 0.1)) noise({ dur: 0.035, gain: 0.035 }); },
  echoAppear: () => { tone({ freq: 660, dur: 0.12, type: 'sine', gain: 0.05 });
                      tone({ freq: 660, dur: 0.12, type: 'sine', gain: 0.03, delay: 0.1 }); },
  echoCaught: () => { tone({ freq: 220, dur: 0.06, type: 'square', gain: 0.08 });
                      tone({ freq: 880, dur: 0.2, type: 'sine', gain: 0.06, delay: 0.06 }); },
  blocked:    () => { tone({ freq: 180, dur: 0.25, type: 'sawtooth', gain: 0.1 });
                      tone({ freq: 180, dur: 0.25, type: 'sawtooth', gain: 0.1, delay: 0.28 }); },
  escape:     () => [523, 659, 784].forEach((f, i) =>
                tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.08, delay: i * 0.12 })),
  // v0.12.0: поимка — OGG-семпл; синтез — fallback
  caught:     () => { if (!playSample('caught', 0.5)) {
                        noise({ dur: 0.12, gain: 0.12 });
                        tone({ freq: 150, dur: 0.3, slide: -100, type: 'square', gain: 0.1 }); } },
  blockade:   () => { tone({ freq: 100, dur: 0.08, type: 'square', gain: 0.1 });
                      noise({ dur: 0.08, gain: 0.08, delay: 0.05 }); },
  epiphany:   () => [440, 554, 659, 880].forEach((f, i) =>
                tone({ freq: f, dur: 0.1, type: 'sine', gain: 0.06, delay: i * 0.07 })),
  // v0.12.0: метро — OGG-семпл; синтез — fallback
  metro:      () => { if (playSample('metro', 0.5)) return;
                      tone({ freq: 200, dur: 0.2, slide: 900, type: 'sine', gain: 0.06 });
                      tone({ freq: 90, dur: 0.12, type: 'square', gain: 0.05, delay: 0.18 }); },
};

/** Подключает звуки на шину событий. Вызывать один раз из main.js. */
export function attachSfx(bus) {
  bus.on('path:step', () => sfx.stepPlaced());
  bus.on('path:reject', () => sfx.error());
  bus.on('path:undo', () => sfx.undo());
  bus.on('path:closed', () => sfx.execute());
  bus.on('microstep', () => sfx.stepWalk());
  bus.on('metro', () => sfx.metro());
  bus.on('echo:caught', () => { sfx.echoCaught(); sfx.epiphany(); });
  bus.on('exit:blocked:hit', () => sfx.blocked());
  bus.on('exit:blocked', () => sfx.blockade());
  bus.on('escaped', () => sfx.escape());
  bus.on('caught', () => sfx.caught());
  // фанфары медали вызывает main.js напрямую (sfx.medal(wins)) — там известен счёт
}

/** Фанфары по числу побед «своей» стороной: 2, 1 или 0. */
sfx.medal = (wins) => {
  if (wins === 2) [523, 659, 784, 1046, 784, 1046].forEach((f, i) =>
    tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.08, delay: i * 0.13 }));
  else if (wins === 1) [523, 659, 784].forEach((f, i) =>
    tone({ freq: f, dur: 0.2, type: 'triangle', gain: 0.08, delay: i * 0.15 }));
  else [392, 330, 262, 196].forEach((f, i) =>
    tone({ freq: f, dur: 0.22, type: 'sawtooth', gain: 0.06, delay: i * 0.16 }));
};

/**
 * Демо громкости эффектов (v0.13.0): 3 случайных шага друг за другом.
 * Для окна настроек — чтобы ползунок эффектов слышно было сразу.
 */
sfx.demoSteps = () => {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => sfx.stepWalk(), i * 260);
  }
};
