/**
 * Фоновая музыка (v0.14.0): MP3-треки через WebAudio, подключение к
 * musicBus (общий ползунок громкости в окне настроек).
 *
 * - Перемешанный порядок без повторов (Fisher-Yates); когда очередь
 *   кончается — новое перемешивание, при этом первый трек нового цикла
 *   не совпадает с последним сыгранным.
 * - Кроссфейд 6 с: следующий трек стартует за 6 с до конца текущего,
 *   старый плавно уходит, новый входит (у треков уже есть своё затухание
 *   в конце ~5–6 с — кроссфейд накладывается на него).
 * - Старт только после жеста пользователя (политика автоплея браузеров) —
 *   main.js вызывает start() при первом клике.
 */
import { getMusicBus } from './sfx.js';

const CROSSFADE = 6; // секунд

/** Детерминированно не нужно — музыка тасуется Math.random (не геймплей). */
function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createMusicPlayer({ files, crossfade = CROSSFADE }) {
  let started = false;
  let stopped = false;
  let queue = [];        // оставшиеся индексы текущего цикла
  let lastPlayed = -1;   // чтобы новый цикл не начинался с того же трека
  const cache = new Map(); // index -> Promise<AudioBuffer>

  function nextIndex() {
    if (!queue.length) {
      queue = shuffle(files.map((_, i) => i));
      if (queue[0] === lastPlayed && queue.length > 1) {
        // меняем первый трек местами со случайным другим
        const j = 1 + Math.floor(Math.random() * (queue.length - 1));
        [queue[0], queue[j]] = [queue[j], queue[0]];
      }
    }
    lastPlayed = queue.shift();
    return lastPlayed;
  }

  function load(i) {
    if (!cache.has(i)) {
      const ac = getMusicBus().context;
      cache.set(i,
        fetch(`assets/audio/music/${files[i]}`)
          .then((r) => { if (!r.ok) throw new Error(files[i]); return r.arrayBuffer(); })
          .then((ab) => ac.decodeAudioData(ab)));
    }
    return cache.get(i);
  }

  /** Играет buf с кроссфейдом; по окончании готовит следующий трек. */
  function playBuf(buf, t0) {
    const bus = getMusicBus();
    const ac = bus.context;
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(1, t0 + crossfade);
    const fadeOutAt = Math.max(t0 + crossfade, t0 + buf.duration - crossfade);
    g.gain.setValueAtTime(1, fadeOutAt);
    g.gain.linearRampToValueAtTime(0.0001, t0 + buf.duration);
    src.connect(g).connect(bus);
    src.start(t0);
    src.stop(t0 + buf.duration + 0.1);

    // следующий стартует ровно в момент начала нашего fadeOut
    setTimeout(async () => {
      if (stopped) return;
      try {
        const nb = await load(nextIndex());
        playBuf(nb, ac.currentTime + 0.05);
      } catch { /* трек не загрузился — пробуем следующий в след. цикле */ }
    }, Math.max(0, (fadeOutAt - ac.currentTime) * 1000));
  }

  return {
    /** Запуск по первому жесту пользователя; повторные вызовы игнорируются. */
    async start() {
      if (started) return;
      const bus = getMusicBus();
      if (!bus) return; // WebAudio недоступен — музыки не будет
      started = true;
      stopped = false;
      try {
        const buf = await load(nextIndex());
        if (stopped) return;
        playBuf(buf, bus.context.currentTime + 0.05);
      } catch { /* музыка не загрузилась — играем без неё */ }
    },
    stop() { stopped = true; },
  };
}

/**
 * Одиночный зацикленный трек для заставки (v0.15.5): intro.mp3 через
 * musicBus (общий ползунок МУЗЫКА). loop — пока не вызван stop()
 * (обычно при входе в игру, где стартует основной плейлист).
 */
export function createIntroTrack({ file }) {
  let src = null;
  return {
    async start() {
      const bus = getMusicBus();
      if (!bus || src) return;
      try {
        const ac = bus.context;
        const r = await fetch(`assets/audio/music/${file}`);
        if (!r.ok) return;
        const buf = await ac.decodeAudioData(await r.arrayBuffer());
        src = ac.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(bus);
        src.start();
      } catch { src = null; /* нет файла — заставка без музыки */ }
    },
    stop() {
      if (!src) return;
      try { src.stop(); } catch { /* уже остановлен */ }
      src = null;
    },
  };
}
