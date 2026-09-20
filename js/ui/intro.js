/**
 * Заставка (v0.15.5):
 *   0. чёрный экран с белой надписью «СТАРТ» — клик по нему запускает
 *      анимацию и трек intro.mp3 (жест пользователя = политика автоплея);
 *   1. assets/intro_bg.png        — попиксельное появление (блоки 4 px
 *      в случайном порядке, 7 с, canvas);
 *   2. assets/intro_detective.png — fade-in (старт через 7 с, 2 с);
 *   3. assets/intro_criminal.png  — проявление справа налево (clip-path
 *      wipe, старт через 9 с);
 *   4. assets/intro_logo.png      — глитч-появление через 9 с;
 *   5. через 10 с — кнопки меню. Клик до появления меню пропускает
 *      анимацию (всё сразу).
 * Отсутствующий PNG молча пропускает свой слой.
 */
const LAYERS = [
  { src: 'assets/intro_bg.png', w: 917, h: 483 },
];
const TIMINGS = { detective: 7000, criminal: 9500, logo: 9500, menu: 12000, reveal: 7000 };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createIntro({ parent, onPlay, onRules, onEnter }) {
  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `
    <svg width="0" height="0" style="position:absolute">
      <filter id="glitch-red" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix"
          values="0.33 0.5 0.16 0 0.05
                  0    0   0    0 0
                  0    0   0    0 0
                  0    0   0    1 0"/>
      </filter>
    </svg>
    <canvas class="intro-layer intro-bg"></canvas>
    <img class="intro-layer intro-detective" src="assets/intro_detective.png" alt="">
    <img class="intro-layer intro-criminal" src="assets/intro_criminal.png" alt="">
    <img class="intro-logo" src="assets/intro_logo.png" alt="">
    <div class="intro-menu">
      <button class="screen-btn primary" data-act="play">НОВАЯ ИГРА</button>
      <button class="screen-btn" data-act="rules">ПРАВИЛА</button>
    </div>
    <div class="intro-start"><span>СТАРТ</span></div>`;
  parent.appendChild(el);
  // нет файла логотипа — слой не мешает (404: картинку убираем)
  const logoImg = el.querySelector('.intro-logo');
  logoImg.addEventListener('error', () => logoImg.remove());

  const cv = el.querySelector('.intro-bg');
  const ctx = cv.getContext('2d');
  const startEl = el.querySelector('.intro-start');
  let tmp = null;          // bg, отмасштабированный «под поле» (cover)
  let started = false;     // анимация запущена кликом «СТАРТ»
  let menuReady = false;
  let timers = [];

  /** Запуск по клику на «СТАРТ»: скрываем экран, стартуем анимацию + музыку. */
  function begin() {
    if (started) return;
    started = true;
    startEl.classList.add('gone');
    if (onEnter) onEnter(); // intro.mp3 (жест уже произошёл — автоплей разрешён)
    loadBg();
    timers = [
      setTimeout(() => el.classList.add('d-in'), TIMINGS.detective),
      setTimeout(() => el.classList.add('c-in'), TIMINGS.criminal),
      setTimeout(() => el.classList.add('l-in'), TIMINGS.logo),
      setTimeout(reveal, TIMINGS.menu),
    ];
  }

  /** Финальное состояние: все слоя открыты, меню видно. */
  function reveal() {
    timers.forEach(clearTimeout);
    menuReady = true;
    el.classList.add('d-in', 'c-in', 'l-in', 'menu-in');
    if (tmp) ctx.drawImage(tmp, 0, 0); // домусорить фон целиком
  }

  /** Попиксельное появление: блоки tmp в случайном порядке за TIMINGS.reveal мс. */
  function pixelReveal() {
    const W = cv.width, H = cv.height;
    const B = 4;
    const cols = Math.ceil(W / B), rows = Math.ceil(H / B);
    const order = shuffle(Array.from({ length: cols * rows }, (_, i) => i));
    const t0 = performance.now();
    let placed = 0;
    (function frame(now) {
      const p = Math.min(1, (now - t0) / TIMINGS.reveal);
      const target = Math.floor(p * order.length);
      while (placed < target) {
        const i = order[placed++];
        const x = (i % cols) * B, y = Math.floor(i / cols) * B;
        ctx.drawImage(tmp, x, y, B, B, x, y, B, B);
      }
      if (p < 1 && !menuReady) requestAnimationFrame(frame);
      else if (p < 1) { /* пропущено кликом — reveal() дорисовал */ }
    })(t0);
  }

  // Фон: грузим, готовим cover-версию под размер поля, запускаем pop-reveal.
  function loadBg() {
    const bg = new Image();
    bg.onload = () => {
      const W = cv.clientWidth || 800, H = cv.clientHeight || 520;
      cv.width = W; cv.height = H;
      const { w: iw, h: ih } = LAYERS[0];
      const s = Math.max(W / iw, H / ih); // cover
      tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      tmp.getContext('2d').drawImage(
        bg, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      pixelReveal();
    };
    bg.src = LAYERS[0].src; // 404 — слой просто остаётся пустым
  }

  el.addEventListener('click', (e) => {
    if (!started) { begin(); return; }        // экран «СТАРТ»
    if (!menuReady) { reveal(); return; }     // клик-пропуск анимации
    const act = e.target?.dataset?.act;
    if (act === 'play') { hide(); onPlay(); }
    if (act === 'rules') { hide(); onRules(); }
  });

  function hide() { el.classList.add('hidden'); }
  function show() { el.classList.remove('hidden'); }

  return { hide, show };
}
