// Тесты механики двойника (v0.5.0 «эхо»).
import { Echo } from '../src/echo.js';

let failed = 0;
const ok = (cond, name) => {
  if (!cond) { failed += 1; console.error('FAIL:', name); }
};

// 1. record хранит копию маршрута
{
  const e = new Echo();
  const src = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  e.record(src);
  src[0].x = 99;
  ok(e.steps[0].x === 0, 'record: копия не зависит от источника');
  ok(e.steps.length === 2, 'record: длина маршрута');
}

// 2. record принимает только массив
{
  const e = new Echo();
  let threw = false;
  try { e.record('нет'); } catch { threw = true; }
  ok(threw, 'record: не-массив → TypeError');
}

// 3. start на пустом → false
{
  const e = new Echo();
  ok(e.start() === false, 'start: пустой маршрут → false');
}

// 4. последовательное воспроизведение
{
  const e = new Echo();
  e.record([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
  ok(e.start() === true, 'start: непустой → true');
  ok(e.next().x === 0, 'next: шаг 0');
  ok(e.current().x === 1, 'current: шаг 1 без сдвига');
  ok(e.next().x === 1, 'next: шаг 1');
  ok(e.next().x === 2, 'next: шаг 2');
  ok(e.playing === false, 'next: после последнего — стоп');
  ok(e.done === true, 'done: все шаги пройдены');
  ok(e.next() === null, 'next: после завершения → null');
}

// 5. stop (отмена) сбрасывает воспроизведение
{
  const e = new Echo();
  e.record([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  e.start();
  e.next();
  e.stop();
  ok(e.playing === false, 'stop: playing=false');
  ok(e.current() === null, 'stop: current=null');
  ok(e.next() === null, 'stop: next=null');
}

// 6. record во время воспроизведения — остановка
{
  const e = new Echo();
  e.record([{ x: 0, y: 0 }]);
  e.start();
  e.record([{ x: 5, y: 5 }, { x: 6, y: 6 }]);
  ok(e.playing === false, 'record: прерывает воспроизведение');
  ok(e.steps[0].x === 5, 'record: новый маршрут записан');
}

// 7. clear
{
  const e = new Echo();
  e.record([{ x: 0, y: 0 }]);
  e.clear();
  ok(e.steps.length === 0, 'clear: маршрут пуст');
  ok(e.start() === false, 'clear: старт невозможен');
}

console.log(failed === 0 ? 'echo: OK (7 групп)' : `echo: ${failed} FAIL`);
process.exit(failed === 0 ? 0 : 1);
