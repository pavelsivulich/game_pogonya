import { CONFIG } from '../config/config.js';
import { COLORS, EXIT_KIND } from '../config/constants.js';

const C = CONFIG.grid.cell;
const INTERVALS = [4, 5, 6, 7]; // секунд между запусками (случайно, GDD v0.11.0)
const randInterval = () => INTERVALS[Math.floor(Math.random() * INTERVALS.length)];

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 50/50: 1 = слева направо, -1 = справа налево (v0.11.0)
const randDir = () => (Math.random() < 0.5 ? 1 : -1);

/**
 * Реестр спрайтов (v0.10.0): положи PNG — и они подхватятся автоматически:
 *   setSprite('train', img); // new Image(), src = 'assets/train.png'
 * Пока спрайт не задан — рисуется процедурная заглушка в нуарной палитре.
 * СОГЛАШЕНИЕ: PNG поезда/корабля «смотрят» ВПРАВО — при движении влево
 * спрайт зеркалится; PNG самолёта — НОСОМ ВВЕРХ (поворачивается по курсу).
 */
const images = { train: null, ship: null, plane: null };
export function setSprite(name, img) { images[name] = img; }

// v0.12.0: автозагрузка PNG из assets/ — файл появился, и он подхвачен.
// 404 молча игнорируется (onerror не ставит src) — рисуется заглушка.
const SPRITE_FILES = { train: 'train', ship: 'ship', plane: 'airplane' };
for (const [name, file] of Object.entries(SPRITE_FILES)) {
  const img = new Image();
  img.onload = () => { images[name] = img; };
  img.src = `assets/${file}.png`;
}

/** Позиции ориентиров в пикселях (вокзал/порт/аэропорт, река, рельсы). */
function geo(map) {
  const w = map.cols * C, h = map.rows * C;
  const find = (k) => map.exits.find((e) => e.kind === k);
  const st = find(EXIT_KIND.STATION), pt = find(EXIT_KIND.PORT), ap = find(EXIT_KIND.AIRPORT);
  return {
    w, h,
    railYC: (map.railY ?? map.rows - 1) * C + C / 2,
    riverYC: map.riverY * C + C / 2,
    stationX: st ? st.x * C + C / 2 : w / 2,
    portX: pt ? pt.x * C + C / 2 : w / 2,
    airportX: ap ? ap.x * C + C / 2 : w - C / 2,
    airportY: ap ? ap.y * C + C / 2 : h / 2,
  };
}

const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeIn = (k) => k * k;

/** Горизонтальная анимация «проехал мимо станции» с направлением (поезд/корабль). */
function makeRunner(kind, g, opts) {
  const { len, cy, stopX, T1, T2, drawBody } = opts;
  const dir = randDir();
  const startX = dir === 1 ? -len - 10 : g.w + 10;
  const endX = dir === 1 ? g.w + 10 : -len - 10;
  const HOLD = 1.5;
  let t = 0, phase = 0;
  return {
    kind,
    done: false,
    update(dt) {
      t += dt;
      if (phase === 0 && t >= T1) { phase = 1; t = 0; }
      else if (phase === 1 && t >= HOLD) { phase = 2; t = 0; }
      else if (phase === 2 && t >= T2) this.done = true;
      return this.done;
    },
    draw(ctx) {
      let x;
      if (phase === 0) x = startX + (stopX - startX) * easeOut(Math.min(1, t / T1));
      else if (phase === 1) x = stopX;
      else x = stopX + (endX - stopX) * easeIn(Math.min(1, t / T2));
      // зеркалим всю отрисовку при движении влево (спрайт «смотрит» вправо)
      ctx.save();
      if (dir === -1) { ctx.translate(x + len, 0); ctx.scale(-1, 1); x = 0; }
      drawBody(ctx, x, cy, dir);
      ctx.restore();
    },
  };
}

/** Поезд: 50/50 направление, тормозит у вокзала (1.5 с), разгоняется, уходит. */
function makeTrain(g) {
  const img = images.train;
  // длина сегмента = ширине PNG (иначе поезд вылезет за «состав» и встанет
  // не у вокзала); заглушка — 132 px
  const len = img ? img.width : 132, h = 22;
  return makeRunner('train', g, {
    len, cy: g.railYC, stopX: g.stationX - len / 2, T1: 2.6, T2: 2.6,
    drawBody(ctx, x, cy) {
      // PNG центрируется по сегменту [x, x+len] — ось зеркала совпадает с центром
      if (img) { ctx.drawImage(img, x + (len - img.width) / 2, cy - img.height / 2); return; }
      ctx.fillStyle = '#141414';
      ctx.strokeStyle = COLORS.paper;
      const cars = 3, gap = 6, cw = (len - gap * (cars - 1)) / cars;
      for (let i = 0; i < cars; i++) {
        const cx = x + i * (cw + gap);
        ctx.fillRect(cx, cy - h / 2, cw, h);
        ctx.strokeRect(cx + 0.5, cy - h / 2 + 0.5, cw - 1, h - 1);
        ctx.fillStyle = COLORS.paper; // окна
        for (let wI = 0; wI < 3; wI++) ctx.fillRect(cx + 5 + wI * (cw / 3), cy - h / 2 + 4, 5, 5);
        ctx.fillStyle = '#141414';
      }
    },
  });
}

/** Корабль: 50/50 направление, тормозит у порта (1.5 с), разгоняется, уходит.
 *  Слой ПОД мостами. */
function makeShip(g) {
  const len = 96, h = 18;
  const img = images.ship;
  return makeRunner('ship', g, {
    len, cy: g.riverYC, stopX: g.portX - len / 2, T1: 6.0, T2: 6.0,
    drawBody(ctx, x, cy) {
      // PNG центрируется по сегменту [x, x+len]; ватерлиния корабля —
      // на 2/3 высоты (как в заглушке), поэтому верх = cy − h·0.66
      if (img) { ctx.drawImage(img, x + (len - img.width) / 2, cy - img.height * 0.66); return; }
      ctx.fillStyle = '#141414';
      ctx.strokeStyle = COLORS.paper;
      ctx.beginPath(); // корпус
      ctx.moveTo(x, cy - 2); ctx.lineTo(x + len, cy - 2);
      ctx.lineTo(x + len - 12, cy + h / 2); ctx.lineTo(x + 10, cy + h / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeRect(x + len * 0.45 + 0.5, cy - h, len * 0.25, h - 2); // рубка
      ctx.beginPath(); // мачта
      ctx.moveTo(x + len * 0.25, cy - 2); ctx.lineTo(x + len * 0.25, cy - h);
      ctx.stroke();
    },
  });
}

/** Квадратическая кривая Безье и её касательная. */
const qbez = (p0, c, p1, k) => ({
  x: (1 - k) * (1 - k) * p0.x + 2 * (1 - k) * k * c.x + k * k * p1.x,
  y: (1 - k) * (1 - k) * p0.y + 2 * (1 - k) * k * c.y + k * k * p1.y,
});
const qtan = (p0, c, p1, k) => ({
  x: 2 * (1 - k) * (c.x - p0.x) + 2 * k * (p1.x - c.x),
  y: 2 * (1 - k) * (c.y - p0.y) + 2 * k * (p1.y - c.y),
});

/**
 * Самолёт (v0.11.0): старт в случайной точке за ЛЕВЫМ или НИЖНИМ краем,
 * подлёт по дуге, которая выпрямляется ВЕРТИКАЛЬНО снизу вверх к аэропорту
 * (торможение + уменьшение), висит 1.5 с, затем взлёт вертикально вверх
 * с уходом в случайную точку за ВЕРХНИМ краем (разгон + рост).
 * Слой ПОВЕРХ всего. Курс спрайта — по касательной к траектории.
 */
function makePlane(g) {
  const T1 = 3.2, HOLD = 1.5, T2 = 3.2;
  const A = { x: g.airportX, y: g.airportY };
  const S = Math.random() < 0.5
    ? { x: -60, y: Math.random() * g.h }            // за левым краем
    : { x: Math.random() * g.w, y: g.h + 60 };      // за нижним краем
  const C1 = { x: A.x, y: A.y + 140 };              // финал захода — строго снизу вверх
  const E = { x: 40 + Math.random() * (g.w - 80), y: -70 }; // за верхним краем
  const C2 = { x: A.x, y: A.y - 140 };              // начало взлёта — строго вверх
  let t = 0, phase = 0;
  return {
    kind: 'plane',
    done: false,
    update(dt) {
      t += dt;
      if (phase === 0 && t >= T1) { phase = 1; t = 0; }
      else if (phase === 1 && t >= HOLD) { phase = 2; t = 0; }
      else if (phase === 2 && t >= T2) this.done = true;
      return this.done;
    },
    draw(ctx) {
      let pos, tan, s;
      if (phase === 0) {
        const k = easeOut(Math.min(1, t / T1));
        pos = qbez(S, C1, A, k); tan = qtan(S, C1, A, k); s = 1.5 - 0.8 * k;
      } else if (phase === 1) {
        pos = A; tan = { x: 0, y: -1 }; s = 0.7;
      } else {
        const k = easeIn(Math.min(1, t / T2));
        pos = qbez(A, C2, E, k); tan = qtan(A, C2, E, k); s = 0.7 + 0.8 * k;
      }
      const ang = Math.atan2(tan.y, tan.x) + Math.PI / 2; // спрайт нарисован носом вверх
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(ang);
      ctx.scale(s, s);
      const img = images.plane;
      if (img) { ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore(); return; }
      ctx.fillStyle = '#141414';
      ctx.strokeStyle = COLORS.paper;
      ctx.beginPath(); // фюзеляж (вид сверху)
      ctx.moveTo(0, -26); ctx.lineTo(6, -12); ctx.lineTo(6, 18); ctx.lineTo(0, 26);
      ctx.lineTo(-6, 18); ctx.lineTo(-6, -12); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); // крылья
      ctx.moveTo(-26, 4); ctx.lineTo(26, 4); ctx.lineTo(20, 10); ctx.lineTo(-20, 10);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
  };
}

const MAKERS = { train: makeTrain, ship: makeShip, plane: makePlane };

/**
 * Диспетчер декоративных анимаций. Каждые randInterval() секунд
 * ([4..7] случайно) запускается следующая анимация из перемешанной
 * тройки [train, ship, plane]. Допускается несколько анимаций
 * одновременно (например, долгий корабль + поезд).
 */
export function createDecor() {
  let bag = [];
  let active = [];
  let timer = 0;
  let nextGap = randInterval();

  return {
    /** Сброс при новой карте/партии. */
    reset() { bag = []; active = []; timer = 0; nextGap = randInterval(); },

    update(dt, map) {
      if (!map) return;
      active.forEach((a) => { a.update(dt, geo(map)); });
      active = active.filter((a) => !a.done);
      timer += dt;
      if (timer >= nextGap) {
        timer = 0;
        nextGap = randInterval();
        if (!bag.length) bag = shuffle(['train', 'ship', 'plane']);
        // A: не запускать тот же kind, пока предыдущий ещё активен
        // (иначе «паровозик», напр. два корабля у порта). Если все
        // три kind заняты — пропускаем тик, ждём следующий интервал.
        const busy = new Set(active.map((a) => a.kind));
        const idx = bag.findIndex((k) => !busy.has(k));
        if (idx >= 0) active.push(MAKERS[bag.splice(idx, 1)[0]](geo(map)));
      }
    },

    // слои: корабль — под мостами, поезд — на рельсах, самолёт — поверх всего
    drawShip(ctx, map) { active.forEach((a) => { if (a.kind === 'ship') a.draw(ctx, geo(map)); }); },
    drawTrain(ctx, map) { active.forEach((a) => { if (a.kind === 'train') a.draw(ctx, geo(map)); }); },
    drawPlane(ctx, map) { active.forEach((a) => { if (a.kind === 'plane') a.draw(ctx, geo(map)); }); },
  };
}