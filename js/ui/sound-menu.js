/**
 * Окно настроек звука (v0.13.0).
 * Кнопка в правом верхнем углу поля; клик — панель с двумя ползунками:
 *   МУЗЫКА — мастер-громкость musicBus (плеера пока нет, шина и ползунок готовы);
 *   ЭФФЕКТЫ — мастер-громкость sfxBus; при регулировке играются 3 случайных
 *   шага (sfx.demoSteps) как демонстрация текущей громкости.
 *
 * ВАЖНО: панель — обычный DOM-оверлей. Звук живёт в WebAudio-графе и от
 * DOM не зависит, поэтому открытие/закрытие панели музыку НЕ останавливает —
 * громкость музыки меняется на слух сразу.
 */
import {
  getSfxVolume, getMusicVolume, setSfxVolume, setMusicVolume, sfx,
} from '../audio/sfx.js';

export function createSoundMenu({ parent }) {
  const btn = document.createElement('button');
  btn.id = 'sound-btn';
  btn.title = 'Настройки звука';
  btn.textContent = '♪';

  const panel = document.createElement('div');
  panel.id = 'sound-panel';
  panel.innerHTML = `
    <div class="sound-row">
      <label for="vol-music">МУЗЫКА</label>
      <input id="vol-music" type="range" min="0" max="100" value="${Math.round(getMusicVolume() * 100)}">
      <output id="out-music">${Math.round(getMusicVolume() * 100)}%</output>
    </div>
    <div class="sound-row">
      <label for="vol-sfx">ЭФФЕКТЫ</label>
      <input id="vol-sfx" type="range" min="0" max="100" value="${Math.round(getSfxVolume() * 100)}">
      <output id="out-sfx">${Math.round(getSfxVolume() * 100)}%</output>
    </div>
    <p class="sound-hint">ползунок эффектов — 3 шага для примера</p>`;

  parent.appendChild(btn);
  parent.appendChild(panel);

  const musicInput = panel.querySelector('#vol-music');
  const sfxInput = panel.querySelector('#vol-sfx');
  const musicOut = panel.querySelector('#out-music');
  const sfxOut = panel.querySelector('#out-sfx');

  const close = () => { panel.classList.remove('visible'); btn.classList.remove('active'); };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = panel.classList.toggle('visible');
    btn.classList.toggle('active', open);
  });
  // клик мимо панели закрывает её (по кнопке — stopPropagation выше)
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('visible') && !panel.contains(e.target)) close();
  });

  musicInput.addEventListener('input', () => {
    const v = setMusicVolume(musicInput.value / 100);
    musicOut.textContent = `${Math.round(v * 100)}%`;
  });

  // Демо эффектов: после окончания движения ползунка (debounce) — 3 шага.
  let demoTimer = 0;
  sfxInput.addEventListener('input', () => {
    const v = setSfxVolume(sfxInput.value / 100);
    sfxOut.textContent = `${Math.round(v * 100)}%`;
    clearTimeout(demoTimer);
    demoTimer = setTimeout(() => sfx.demoSteps(), 350);
  });

  return { close };
}
