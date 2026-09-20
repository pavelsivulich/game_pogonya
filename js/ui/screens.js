/**
 * Экранные оверлеи (GDD §12): меню, правила, интро раунда,
 * результат раунда, экран медали. Один div поверх canvas,
 * содержимое перерисовывается под каждый экран.
 */
export function createScreens({ canvas }) {
  const el = document.createElement('div');
  el.id = 'screen';
  canvas.parentElement.insertBefore(el, canvas);
  canvas.parentElement.style.position = 'relative';

  const btn = (label, onClick, cls = '') =>
    `<button class="screen-btn ${cls}" data-act="${label}">${label}</button>`;

  function show(html, handlers = {}) {
    el.innerHTML = `<div class="screen-box">${html}</div>`;
    el.classList.add('visible');
    el.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const fn = handlers[b.dataset.act];
        if (fn) fn();
      });
    });
  }

  function hide() { el.classList.remove('visible'); el.innerHTML = ''; }

  const title = '<h1 class="screen-title">ПОГОНЯ</h1>';

  return {
    hide,

    showMenu({ onNewGame, onRules }) {
      show(title + btn('НОВАЯ ИГРА', onNewGame, 'primary') + btn('ПРАВИЛА', onRules),
        { 'НОВАЯ ИГРА': onNewGame, 'ПРАВИЛА': onRules });
    },

    showRules({ onBack }) {
      show(`
        <h2 class="screen-sub">ПРАВИЛА</h2>
        <div class="screen-rules">
          <p>Партия состоит из 2 раундов на одной карте.</p>
          <p><b>РАУНД 1 — ты БЕГЛЕЦ.</b> Твоя цель: сбежать из города
          через один из трёх выходов (вокзал, аэропорт или речной порт).
          Программируй 5 шагов передвижения, но помни — детектив
          программирует 10. Один из трёх выходов заблокирован, но узнаешь
          о блокировке, только дойдя до него. Начиная со второго хода
          размещай «эхо», своего двойника — он повторит, при возможности,
          твою траекторию передвижения в прошлом ходу.</p>
          <p><b>РАУНД 2 — ты ДЕТЕКТИВ.</b> Цель: поймать беглеца, не
          позволив ему сбежать из города. Заблокируй выход, а затем
          программируй погоню. Видимость ограничена радиусом в 3 клетки.</p>
          <p><b>ДВОЙНИК:</b> со 2-го хода беглец оставляет «эхо» — повтор
          прошлого хода. Если детектив поймает «эхо», то получит озарение:
          беглец виден 1 ход.</p>
          <p><b>МЕДАЛЬ:</b> 1 победа своей стороной — односторонняя,
          2 — двусторонняя.</p>
        </div>` + btn('НАЗАД', onBack),
        { 'НАЗАД': onBack });
    },

    showRoundIntro({ round, playerRole, onContinue }) {
      const role = playerRole === 'fugitive' ? 'БЕГЛЕЦ' : 'ДЕТЕКТИВ';
      show(`
        <h2 class="screen-sub">РАУНД ${round}</h2>
        <p class="screen-role">ТЫ ИГРАЕШЬ ЗА: <b class="role-${playerRole}">${role}</b></p>
        <p class="screen-hint">${playerRole === 'fugitive'
          ? 'Сбеги через любой из трёх выходов за 12 ходов'
          : 'Поймай беглеца или продержись 12 ходов'}</p>`
        + btn('ПРОДОЛЖИТЬ', onContinue, 'primary'),
        { 'ПРОДОЛЖИТЬ': onContinue });
    },

    showRoundResult({ round, winner, onContinue }) {
      const win = (winner === 'fugitive' && round === 1) || (winner === 'detective' && round === 2);
      show(`
        <h2 class="screen-sub">РАУНД ${round}: ${winner === 'escape' || winner === 'fugitive' ? 'ПОБЕГ' : 'ПОИМКА'}</h2>
        <p class="screen-role">${win
          ? '<b class="win">✓ ПОБЕДА ЗА ТОБОЙ</b>'
          : '<b class="lose">✗ ПОБЕДА СОПЕРНИКА</b>'}</p>`
        + btn('СЛЕДУЮЩИЙ РАУНД', onContinue, 'primary'),
        { 'СЛЕДУЮЩИЙ РАУНД': onContinue });
    },

    showMedal({ results, onRestart }) {
      const wins = [results[1] === 'fugitive', results[2] === 'detective'].filter(Boolean).length;
      const medal = wins === 2
        ? { icon: '🥇', text: 'ДВУСТОРОННЯЯ МЕДАЛЬ' }
        : wins === 1 ? { icon: '🥉', text: 'ОДНОСТОРОННЯЯ МЕДАЛЬ' }
        : { icon: '—', text: 'БЕЗ МЕДАЛИ' };
      const row = (n, won) =>
        `<p>РАУНД ${n}: ${won ? '✅ ПОБЕДА' : '❌ ПОРАЖЕНИЕ'}</p>`;
      show(`
        ${row(1, results[1] === 'fugitive')}
        ${row(2, results[2] === 'detective')}
        <p class="medal">${medal.icon} ${medal.text}</p>`
        + btn('ИГРАТЬ СНОВА', onRestart, 'primary'),
        { 'ИГРАТЬ СНОВА': onRestart });
    },
  };
}
