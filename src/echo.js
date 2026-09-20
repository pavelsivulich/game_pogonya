// v0.5.0 «эхо» — механика двойника.
// Чистая логика состояний (без DOM): запись маршрута, пошаговое
// воспроизведение, отмена. Таймер/подсветку подключает UI-слой.

export class Echo {
  constructor() {
    this.steps = [];      // записанный маршрут: [{x,y}, ...]
    this.playing = false; // идёт ли воспроизведение
    this.index = -1;      // текущий шаг при воспроизведении
  }

  // Записать маршрут (копия, чтобы внешние правки не влияли).
  record(steps) {
    if (!Array.isArray(steps)) throw new TypeError('steps должен быть массивом');
    this.stop();
    this.steps = steps.map((s) => ({ ...s }));
  }

  // Очистить запись и остановить воспроизведение.
  clear() {
    this.stop();
    this.steps = [];
  }

  // Начать воспроизведение с первого шага. false — если записывать нечего.
  start() {
    if (this.steps.length === 0) return false;
    this.playing = true;
    this.index = 0;
    return true;
  }

  // Вернуть текущий шаг и сдвинуться дальше.
  // null — если воспроизведение не идёт или уже завершено.
  next() {
    if (!this.playing) return null;
    const step = this.steps[this.index];
    this.index += 1;
    if (this.index >= this.steps.length) this.playing = false; // дошли до конца
    return step;
  }

  // Текущий шаг без сдвига (для подсветки). null — если не воспроизводим.
  current() {
    return this.playing ? this.steps[this.index] : null;
  }

  // Отменить/остановить воспроизведение.
  stop() {
    this.playing = false;
    this.index = -1;
  }

  // Воспроизведение завершено (все шаги пройдены).
  get done() {
    return this.steps.length > 0 && this.index >= this.steps.length;
  }
}
