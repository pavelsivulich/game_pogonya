# 🎮 FUGITIVE vs. DETECTIVE
### Game Design Document v1.0

---

## 📋 СОДЕРЖАНИЕ

1. [Обзор проекта](#1-обзор-проекта)
2. [Связь с темой геймджема](#2-связь-с-темой-геймджема)
3. [Игровой процесс](#3-игровой-процесс)
4. [Карта](#4-карта)
5. [Программирование ходов](#5-программирование-ходов)
6. [Беглец](#6-беглец)
7. [Детектив](#7-детектив)
8. [Двойник (Эхо)](#8-двойник-эхо)
9. [Блокировка финальной точки](#9-блокировка-финальной-точки)
10. [Искусственный интеллект](#10-искусственный-интеллект)
11. [Система медалей](#11-система-медалей)
12. [Визуальный стиль](#12-визуальный-стиль)
13. [Звуковой дизайн](#13-звуковой-дизайн)
14. [Техническая архитектура](#14-техническая-архитектура)
15. [Файловая структура](#15-файловая-структура)
16. [Конфигурация](#16-конфигурация)
17. [Псевдокод основных систем](#17-псевдокод-основных-систем)
18. [План разработки (18 суток)](#18-план-разработки-18-суток)
19. [Балансировка и тестирование](#19-балансировка-и-тестирование)
20. [Риски и митигация](#20-риски-и-митигация)

---

## 1. ОБЗОР ПРОЕКТА

### Название
**«Fugitive vs. Detective»**

### Жанр
Пошаговая тактическая головоломка с асимметричным геймплеем

### Платформа
Веб-браузер (ПК, монитор 16:9)

### Технологии
Чистый JavaScript + HTML5 Canvas, без фреймворков

### Формат
- 2 раунда (игрок играет за обе стороны)
- 5–10 минут на раунд
- 10–20 минут на полную партию

### Сеттинг
Нуарный город. Беглец пытается скрыться от детектива, достигнув одной из трёх точек эвакуации. Детектив преследует беглеца по улицам города.

### Ключевая особенность
Игрок играет **оба раунда на одной и той же процедурно сгенерированной карте**, но с разных сторон. В первом раунде — за беглеца, во втором — за детектива (или наоборот). Это создаёт эффект «обратной стороны медали»: ты уже знаешь карту, но смотришь на неё другими глазами.

---

## 2. СВЯЗЬ С ТЕМОЙ ГЕЙМДЖЕМА

Набор темы джема: **2 механики + 1 тема + 1 ограничение**

| Элемент темы | Реализация в игре |
|---|---|
| **Механика 1:** Управление временем через шаги | Двухфазный геймплей: программирование 5 шагов → воспроизведение. Время движется только когда персонаж двигается |
| **Механика 2:** Призыв эха | Двойник беглеца, повторяющий все 5 шагов предыдущего хода |
| **Тема:** «Обратная сторона медали» | Два раунда за обе стороны на одной карте. Игрок видит ситуацию с двух перспектив |
| **Ограничение:** Минимализм в палитре (3 цвета) | Чёрный, белый, красный акцент |

---

## 3. ИГРОВОЙ ПРОЦЕСС

### Структура партии

```
ПАРТИЯ
├── РАУНД 1: Игрок = Беглец, ИИ = Детектив
│   ├── Детектив-ИИ блокирует финальную точку
│   ├── Беглец программирует и воспроизводит ходы
│   ├── Детектив-ИИ преследует
│   └── Результат: побег или поимка
│
├── ПЕРЕХОД: Та же карта, смена ролей
│
└── РАУНД 2: Игрок = Детектив, ИИ = Беглец
    ├── Игрок-детектив блокирует финальную точку
    ├── Беглец-ИИ убегает
    ├── Игрок-детектив преследует
    └── Результат: побег или поимка

ИТОГ: Медаль (или её отсутствие)
```

### Двухфазный цикл каждого хода

```
ХОД
├── ФАЗА 1: ПРОГРАММИРОВАНИЕ
│   ├── Игрок кликает 5 клеток пути
│   ├── Игрок размещает двойника (со 2-го хода)
│   ├── Валидация: все 5 шагов + двойник установлены
│   └── Кнопка «ВОСПРОИЗВЕСТИ»
│
└── ФАЗА 2: ВОСПРОИЗВЕДЕНИЕ
    ├── Пошаговая анимация (300мс на шаг)
    ├── Шаг беглеца → 2 шага детектива → шаг двойника
    ├── Проверка видимости после каждого шага
    ├── Проверка поимки после каждого шага
    └── Переход к следующему ходу
```

### Условия победы

| Раунд | Победа беглеца | Победа детектива |
|---|---|---|
| Раунд 1 | Беглец достиг свободной финальной точки | Детектив поймал беглеца |
| Раунд 2 | Беглец-ИИ достиг свободной финальной точки | Игрок-детектив поймал беглеца-ИИ |

---

## 4. КАРТА

### Параметры

| Параметр | Значение |
|---|---|
| Размер | 20 × 12 клеток |
| Ориентация | Горизонтальная (под монитор ПК) |
| Тип сетки | Квадратная |
| Направления движения | 4 (вверх, вниз, влево, вправо) |

### Элементы карты

| Элемент | Обозначение | Проходимость | Описание |
|---|---|---|---|
| Дорога | `.` | ✅ Проходима | Обычная клетка для движения |
| Здание | `█` | ❌ Непроходима | Блокирует движение и видимость |
| Река | `≈` | ❌ Непроходима | Делит карту на 2 части |
| Мост | `═` | ✅ Проходима | Единственный путь через реку |
| Метро (вход) | `Ⓜ` | ✅ Проходима | Телепорт на парную клетку |
| Метро (выход) | `Ⓜ` | ✅ Проходима | Парная клетка для входа |
| Старт беглеца | `★` | ✅ Проходима | Начальная позиция беглеца |
| Старт детектива | `◈` | ✅ Проходима | Начальная позиция детектива |
| Финальная точка | `⬟` | ✅ Проходима | Аэропорт / Вокзал / Пирс |
| Заблокированная точка | `⬟̸` | ❌ Закрыта | Точка, заблокированная детективом |

### Процедурная генерация

#### Алгоритм

```
ГЕНЕРАЦИЯ КАРТЫ:

Шаг 1: КЛЮЧЕВЫЕ ТОЧКИ
  1.1. Старт беглеца → случайная клетка в центральной трети карты
  1.2. Финальные точки → 3 зоны:
       - Аэропорт: верхняя треть (север)
       - Вокзал: нижняя левая треть (юго-запад)
       - Пирс: нижняя правая треть (юго-восток)
  1.3. Метро-пары → 2-3 пары, не ближе 4 клеток к ключевым точкам
  1.4. Старт детектива → случайная клетка, не ближе 5 клеток к старту беглеца

Шаг 2: РЕКА И МОСТЫ
  2.1. Река → горизонтальная линия между строками 4 и 8
  2.2. Мосты → 2-3 моста на случайных колонках через реку

Шаг 3: ЗДАНИЯ
  3.1. Размещение 8-12 блоков зданий
  3.2. Размеры блоков: 2×2, 3×3, 1×4, 2×5
  3.3. Ограничения:
       - Не перекрывают реку
       - Не перекрывают мосты
       - Не перекрывают метро
       - Не перекрывают старты и финальные точки
       - Не создают замкнутых зон

Шаг 4: ПРОВЕРКА СВЯЗНОСТИ
  4.1. Flood fill от старта беглеца
  4.2. Все финальные точки должны быть достижимы
  4.3. Если есть замкнутые зоны → перегенерация зданий

Шаг 5: ПРОВЕРКА БАЛАНСА ПУТЕЙ
  5.1. A* от старта до каждой финальной точки
  5.2. Расчёт: (макс_путь - мин_путь) / мин_путь
  5.3. Если > 20% → коррекция или перегенерация

Шаг 6: КОРРЕКЦИЯ БАЛАНСА
  6.1. Если точка ближе других:
       - Добавить препятствия на её пути
       - ИЛИ убрать ближайший мост/метро
  6.2. Если точка дальше других:
       - Убрать препятствия с её пути
       - ИЛИ добавить мост/метро
  6.3. Максимум 10 итераций
  6.4. Если не удалось → полная перегенерация с Шага 1
```

#### Псевдокод генератора

```javascript
function generateMap(config) {
    let attempts = 0;
    const MAX_ATTEMPTS = config.exits.generationMaxIterations;
    
    while (attempts < MAX_ATTEMPTS) {
        // Шаг 1: Ключевые точки
        const startFugitive = randomCellInZone('center');
        const exits = [
            randomCellInZone('north'),
            randomCellInZone('southwest'),
            randomCellInZone('southeast')
        ];
        const startDetective = randomCellAwayFrom(startFugitive, 5);
        const metroPairs = generateMetroPairs(config.map.metroPairsCount);
        
        // Шаг 2: Река и мосты
        const river = generateRiver(config.map.riverRows);
        const bridges = generateBridges(river, config.map.bridgesCount);
        
        // Шаг 3: Здания
        const buildings = generateBuildings(
            config.map.buildingsCount,
            config.map.buildingSizes,
            [river, bridges, metroPairs, startFugitive, startDetective, ...exits]
        );
        
        // Шаг 4: Проверка связности
        if (!checkConnectivity(grid, startFugitive, exits)) {
            attempts++;
            continue;
        }
        
        // Шаг 5: Проверка баланса
        const balance = checkBalance(grid, startFugitive, exits);
        if (balance.isValid) {
            return buildFinalGrid();
        }
        
        // Шаг 6: Коррекция
        correctBalance(grid, balance, startFugitive, exits);
        
        // Повторная проверка после коррекции
        if (checkBalance(grid, startFugitive, exits).isValid) {
            return buildFinalGrid();
        }
        
        attempts++;
    }
    
    // Если не удалось за все попытки — упрощённая генерация
    return generateSimpleMap(config);
}

function checkBalance(grid, start, exits) {
    const distances = exits.map(exit => {
        const path = aStar(grid, start, exit);
        return path ? path.length : Infinity;
    });
    
    const max = Math.max(...distances);
    const min = Math.min(...distances);
    const balanceRatio = (max - min) / min;
    
    return {
        distances,
        balanceRatio,
        isValid: balanceRatio <= config.exits.balanceTolerance
    };
}
```

### Пример сгенерированной карты

```
. . . . . . . . . . . . . . . . . . . .
. . . . . . . █ █ . . . . . . . . . . .
. . ★ . . . . █ █ . . . . . . . . ⬟ . .
. . . . . . . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . . . . . .
≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈
. . . . . . . . . . . . . . . . . . . .
. . . . . █ █ █ . . . . . . . . . . . .
. . . . . █ █ █ . . . . . . . . . . . .
. . . . . . . . . . . . . . . . . . . .
. . ⬟ . . . . . . . . . . . . . . ⬟ . .
. . . . . . . . . . . . . . . . . . . .

★ = Старт беглеца
⬟ = Финальные точки (Аэропорт, Вокзал, Пирс)
█ = Здания
≈ = Река
═ = Мосты (2-3 через реку)
Ⓜ = Метро-пары (2-3 на карте)
◈ = Старт детектива (не показан, для примера)
```

---

## 5. ПРОГРАММИРОВАНИЕ ХОДОВ

### Управление

| Действие | Результат |
|---|---|
| Клик по соседней клетке | Добавить шаг в маршрут |
| Клик по несоседней клетке | ❌ Красный крестик + звук ошибки |
| ПКМ по последней клетке пути | Отменить последний шаг (Undo) |
| Кнопка «Сброс» | Очистить весь маршрут |
| Кнопка «Воспроизвести» | Запуск фазы воспроизведения |

### Валидация пути

```
ПРАВИЛА ВАЛИДАЦИИ:

1. Направления: только 4 (вверх, вниз, влево, вправо)
2. Каждая следующая клетка должна быть соседней с предыдущей
3. Путь не может проходить через:
   - Здания (█)
   - Реку без моста (≈)
   - Заблокированные финальные точки (⬟̸)
   - Края карты
4. Путь может проходить через:
   - Дороги (.)
   - Мосты (═)
   - Метро (Ⓜ) — телепорт при входе
5. Для запуска воспроизведения ОБЯЗАТЕЛЬНО:
   - Все 5 шагов запрограммированы
   - Двойник установлен (со 2-го хода)
```

### Визуализация программирования

```
ФАЗА ПРОГРАММИРОВАНИЯ:

1. Клетки пути подсвечиваются белым
2. Траектория рисуется ПУНКТИРНОЙ линией
3. На каждой клетке пути отображается номер шага: ①②③④⑤
4. Текущая позиция беглеца — яркая точка
5. Двойник (если установлен) — полупрозрачный силуэт
6. Зона видимости детектива — затемнена для игрока-беглеца
7. Заблокированная точка (если известна) — красный крест
```

### Псевдокод программирования

```javascript
class PathProgrammer {
    constructor(config) {
        this.path = [];           // Массив клеток пути
        this.maxSteps = config.movement.fugitiveSteps; // 5
        this.echoPosition = null; // Позиция двойника
        this.isEchoPlaced = false;
        this.currentTurn = 0;
    }
    
    handleCellClick(cell) {
        // Проверка: клетка соседняя с последней в пути?
        const lastCell = this.path.length > 0 
            ? this.path[this.path.length - 1] 
            : this.fugitivePosition;
        
        if (!this.isAdjacent(lastCell, cell)) {
            this.showError(cell); // Красный крестик + звук
            return;
        }
        
        // Проверка: клетка проходима?
        if (!this.grid.isWalkable(cell)) {
            this.showError(cell);
            return;
        }
        
        // Проверка: не превышен лимит шагов?
        if (this.path.length >= this.maxSteps) {
            this.showError(cell); // «Максимум 5 шагов»
            return;
        }
        
        // Добавляем шаг
        this.path.push(cell);
        this.renderPath(); // Пунктир + номера
        this.playSound('step_placed');
    }
    
    undoLastStep() {
        if (this.path.length > 0) {
            this.path.pop();
            this.renderPath();
            this.playSound('undo');
        }
    }
    
    resetPath() {
        this.path = [];
        this.echoPosition = null;
        this.isEchoPlaced = false;
        this.renderPath();
    }
    
    canExecute() {
        const allStepsProgrammed = this.path.length === this.maxSteps;
        const echoRequired = this.currentTurn >= config.echo.allowedFromTurn;
        const echoPlaced = this.isEchoPlaced;
        
        return allStepsProgrammed && (!echoRequired || echoPlaced);
    }
    
    isAdjacent(cellA, cellB) {
        const dx = Math.abs(cellA.x - cellB.x);
        const dy = Math.abs(cellA.y - cellB.y);
        // 4 направления: сумма расстояний = 1
        return (dx + dy) === 1;
    }
}
```

---

## 6. БЕГЛЕЦ

### Параметры

| Параметр | Значение |
|---|---|
| Шагов за фазу | 5 |
| Видимость детектива | Всегда (вся карта) |
| Видимость беглеца детективом | Ограничена (радиус 3) |
| Двойник | Доступен со 2-го хода |
| Цель | Достичь свободной финальной точки |

### Логика беглеца

```
БЕГЛЕЦ:

Видит:
  ✓ Всю карту
  ✓ Местоположение детектива (всегда)
  ✓ Заблокированные точки (только если сам до них дошёл)
  ✗ Не знает, какая точка заблокирована заранее

Может:
  ✓ Программировать 5 шагов пути
  ✓ Размещать 1 двойника (со 2-го хода)
  ✓ Использовать метро для телепортации
  ✓ Менять маршрут между ходами

Не может:
  ✗ Проходить через здания и реку без моста
  ✗ Входить в заблокированные финальные точки
  ✗ Размещать двойника в зоне видимости детектива
```

### Действия беглеца за ход

```
ХОД БЕГЛЕЦА:

1. ФАЗА ПРОГРАММИРОВАНИЯ:
   a. Игрок видит карту и позицию детектива
   b. Кликает 5 клеток пути (валидация соседства)
   c. Со 2-го хода: размещает двойника
      - Клик по клетке вне видимости детектива
      - Двойник повторяет маршрут предыдущего хода
   d. Проверяет: все 5 шагов + двойник установлены?
   e. Нажимает «ВОСПРОИЗВЕСТИ»

2. ФАЗА ВОСПРОИЗВЕДЕНИЯ:
   a. Беглец делает 5 шагов по программе
   b. После каждого шага детектива: детектив делает 2 шага
   c. Двойник делает 5 шагов (повтор прошлого хода)
   d. Проверка поимки после каждого шага
   e. Проверка достижения финальной точки
```

### Псевдокод беглеца

```javascript
class Fugitive {
    constructor(position, config) {
        this.position = position;
        this.currentTurn = 0;
        this.pathHistory = []; // История маршрутов для двойника
        this.isCaught = false;
        this.isEscaped = false;
    }
    
    executeProgrammedPath(path) {
        for (let i = 0; i < path.length; i++) {
            const nextCell = path[i];
            
            // Проверяем, можно ли войти в клетку
            if (!this.grid.isWalkable(nextCell)) {
                continue; // Пропускаем, если заблокировано
            }
            
            // Перемещаемся
            this.position = nextCell;
            this.pathHistory[this.currentTurn].push(nextCell);
            
            // Анимация шага
            this.renderStep(nextCell, i + 1);
            
            // Проверяем финальную точку
            if (this.grid.isExitPoint(nextCell)) {
                if (this.grid.isExitBlocked(nextCell)) {
                    this.handleBlockedExit(nextCell);
                } else {
                    this.handleEscaped(nextCell);
                    return; // Побег удался
                }
            }
            
            // Проверяем метро
            if (this.grid.isMetro(nextCell)) {
                this.teleport(nextCell);
            }
            
            // Пауза между шагами
            await delay(config.animation.stepDelay);
        }
    }
    
    handleBlockedExit(exitCell) {
        // Точка заблокирована навсегда
        this.grid.blockExitPermanently(exitCell);
        
        // Визуальный эффект
        this.showBlockedExitAnimation(exitCell);
        this.playSound('blocked');
        
        // Беглец должен идти к другой точке со следующего хода
        // В текущем ходу он остаётся на месте
    }
    
    handleEscaped(exitCell) {
        this.isEscaped = true;
        this.showEscapeAnimation(exitCell);
        this.playSound('escape');
    }
}
```

---

## 7. ДЕТЕКТИВ

### Параметры

| Параметр | Значение |
|---|---|
| Шагов за фазу | 10 (по 2 после каждого шага беглеца) |
| Радиус видимости | 3 клетки |
| Скорость преследования | ×2 от шагов беглеца |
| Цель | Поймать беглеца до его побега |

### Логика детектива

```
ДЕТЕКТИВ:

Видит:
  ✓ Клетки в радиусе 3 (манхэттенское расстояние)
  ✓ Беглеца, если тот в радиусе видимости
  ✓ Двойника, если тот в радиусе видимости
  ✗ Не видит беглеца вне радиуса
  ✗ Не видит маршрут беглеца (кроме «озарения»)

Может:
  ✓ Преследовать беглеца по видимости
  ✓ Заблокировать 1 финальную точку в начале раунда
  ✓ Ловить двойников для получения «озарения»

Не может:
  ✗ Видеть сквозь здания
  ✗ Проходить через здания и реку без моста
```

### Зона видимости детектива

```
Радиус 3 (манхэттенское расстояние) = ромб

        ░
      ░ ░ ░
    ░ ░ ░ ░ ░
      ░ ░ ░
        ░

░ = Зона видимости детектива
Центр = Позиция детектива

Клетки в радиусе видны, если между детективом и клеткой
нет зданий (проверка линии зрения опциональна)
```

### Преследование

```
ПРЕСЛЕДОВАНИЕ:

ЕСЛИ беглец в зоне видимости детектива:
  → Детектив активирует режим преследования
  → Детектив движется к беглецу по кратчайшему пути (A*)
  → Скорость: 2 шага на каждый шаг беглеца
  → Преследование продолжается, пока:
    a. Беглец не пойман (детектив встал на клетку беглеца)
    b. Беглец не вышел из зоны видимости на 3+ хода

ЕСЛИ беглец вне зоны видимости:
  → Детектив идёт к последней известной позиции беглеца
  → По достижении последней позиции: ждёт 3 хода
  → Если не видит беглеца: возвращается к патрулированию
```

### Псевдокод детектива

```javascript
class Detective {
    constructor(position, config) {
        this.position = position;
        this.visionRadius = config.visibility.detectiveRadius; // 3
        this.stepsPerTurn = config.movement.detectiveSteps; // 10
        this.lastKnownFugitivePosition = null;
        this.memoryTurns = config.ai.detectiveMemoryTurns; // 3
        this.hasEpiphany = false; // «Озарение» от поимки двойника
        this.isChasing = false;
    }
    
    executeTurn(fugitive, echoes) {
        // Фаза 1: Проверка видимости
        const canSeeFugitive = this.canSee(fugitive.position);
        const visibleEcho = this.findVisibleEcho(echoes);
        
        // Фаза 2: Определение цели
        let target;
        if (canSeeFugitive || this.hasEpiphany) {
            target = fugitive.position;
            this.lastKnownFugitivePosition = fugitive.position;
            this.isChasing = true;
        } else if (visibleEcho) {
            target = visibleEcho.position;
            this.isChasing = true;
        } else if (this.lastKnownFugitivePosition) {
            target = this.lastKnownFugitivePosition;
            this.isChasing = false;
        } else {
            this.patrol();
            return;
        }
        
        // Фаза 3: Движение к цели (2 шага на каждый шаг беглеца)
        const path = aStar(this.grid, this.position, target);
        
        for (let i = 0; i < Math.min(this.stepsPerTurn, path.length); i++) {
            this.position = path[i];
            this.renderStep(this.position);
            
            // Проверка поимки
            if (this.position === fugitive.position) {
                this.catchFugitive(fugitive);
                return;
            }
            
            if (visibleEcho && this.position === visibleEcho.position) {
                this.catchEcho(visibleEcho);
                return;
            }
            
            await delay(config.animation.stepDelay);
        }
    }
    
    canSee(cell) {
        const dx = Math.abs(this.position.x - cell.x);
        const dy = Math.abs(this.position.y - cell.y);
        const distance = dx + dy; // Манхэттенское расстояние
        return distance <= this.visionRadius;
    }
    
    catchEcho(echo) {
        echo.destroy();
        this.hasEpiphany = true; // Видит беглеца до конца следующего хода
        this.playSound('echo_caught');
        this.showEpiphanyAnimation();
    }
    
    catchFugitive(fugitive) {
        fugitive.isCaught = true;
        this.playSound('caught');
        this.showCaughtAnimation();
    }
}
```

---

## 8. ДВОЙНИК (ЭХО)

### Параметры

| Параметр | Значение |
|---|---|
| Максимум на карте | 1 |
| Время жизни | 1 фаза (один цикл воспроизведения) |
| Доступен с хода | 2 |
| Повторяет | Все 5 шагов предыдущего хода беглеца |
| Размещение | Только вне зоны видимости детектива |
| При препятствии | Пропускает шаг и делает следующий |

### Логика двойника

```
ДВОЙНИК:

Установка:
  ✓ В фазе программирования (после 5 шагов пути)
  ✓ Только 1 на карте одновременно
  ✓ Нельзя ставить в радиусе видимости детектива (радиус 3)
  ✓ Со 2-го хода беглеца

Поведение:
  ✓ Повторяет ВСЕ 5 шагов предыдущего хода беглеца
  ✓ Если шаг невозможен (стена, река, край) → ПРОПУСКАЕТ его
  ✓ Если следующий шаг возможен → делает его
  ✓ После воспроизведения 5 шагов → ИСЧЕЗАЕТ
  ✓ В следующем ходу выставляется заново

Поимка детективом:
  ✓ Детектив ловит двойника
  ✓ Двойник исчезает
  ✓ Детектив получает «озарение»
  ✓ «Озарение»: детектив видит беглеца ДО КОНЦА СЛЕДУЮЩЕГО ХОДА
```

### Пример работы двойника

```
ХОД 1 (Беглец):
  Маршрут: Вверх → Вверх → Вправо → Вниз → Вправо
  Результат: Беглец продвинулся на 2 квартала севернее

ХОД 2 (Беглец):
  Маршрут: Влево → Влево → Вверх → Вверх → Вправо
  Двойник ставится в точке А (вне видимости детектива)
  
  ДВОЙНИК повторяет маршрут ХОДА 1:
    Шаг 1: Вверх → ✅ Делает
    Шаг 2: Вверх → ✅ Делает
    Шаг 3: Вправо → ❌ Стена! ПРОПУСКАЕТ
    Шаг 4: Вниз → ✅ Делает (если возможно с текущей позиции)
    Шаг 5: Вправо → ✅ Делает
  
  Итог: Двойник прошёл не тот же путь, что беглец в ХОДЕ 1,
  потому что на Шаге 3 упёрся в стену
```

### Псевдокод двойника

```javascript
class Echo {
    constructor(position, previousPath, config) {
        this.position = position;
        this.previousPath = previousPath; // Маршрут прошлого хода беглеца
        this.isAlive = true;
        this.isCaught = false;
    }
    
    executeTurn() {
        if (!this.isAlive) return;
        
        // Повторяем все 5 шагов предыдущего хода
        for (let i = 0; i < this.previousPath.length; i++) {
            const direction = this.previousPath[i]; // Направление шага
            const nextCell = this.getNextCell(direction);
            
            // Проверяем, можно ли сделать шаг
            if (!this.grid.isWalkable(nextCell)) {
                // Пропускаем шаг, делаем следующий
                this.showSkipAnimation(nextCell);
                continue;
            }
            
            // Перемещаемся
            this.position = nextCell;
            this.renderStep(this.position);
            
            // Проверяем метро
            if (this.grid.isMetro(nextCell)) {
                this.teleport(nextCell);
            }
            
            await delay(config.animation.stepDelay);
        }
        
        // После воспроизведения всех шагов — исчезаем
        this.destroy();
    }
    
    getNextCell(direction) {
        switch (direction) {
            case 'up':    return { x: this.position.x, y: this.position.y - 1 };
            case 'down':  return { x: this.position.x, y: this.position.y + 1 };
            case 'left':  return { x: this.position.x - 1, y: this.position.y };
            case 'right': return { x: this.position.x + 1, y: this.position.y };
        }
    }
    
    destroy() {
        this.isAlive = false;
        this.showFadeOutAnimation();
    }
}
```

---

## 9. БЛОКИРОВКА ФИНАЛЬНОЙ ТОЧКИ

### Параметры

| Параметр | Значение |
|---|---|
| Кто блокирует | Детектив (игрок или ИИ) |
| Когда | В начале раунда |
| Сколько точек блокируется | 1 из 3 |
| Беглец знает о блокировке? | ❌ Нет, узнаёт только достигнув точки |
| Блокировка постоянная? | ✅ Да, до конца раунда |
| Что происходит при достижении | Беглец должен со следующего хода идти к другой точке |

### Логика блокировки

```
БЛОКИРОВКА:

В начале раунда детектива:
  1. Игрок-детектив видит карту с 3 финальными точками
  2. Появляется надпись: «Выберите точку для блокировки»
  3. Игрок кликает на одну из точек
  4. Точка помечается как заблокированная
  5. Раунд начинается

В раунде беглеца (ИИ-детектив):
  1. ИИ-детектив блокирует случайную точку
  2. Игрок-беглец НЕ знает, какая точка заблокирована
  3. Беглец видит все 3 точки как доступные

Когда беглец достигает заблокированной точки:
  1. Точка закрыта навсегда для этого беглеца
  2. Визуальный эффект: красный крест, звук «закрыто»
  3. Надпись: «ТОЧКА ЗАБЛОКИРОВАНА!»
  4. Беглец НЕ входит в точку
  5. Со следующего хода беглец должен идти к другой точке
  6. Оставшиеся 2 точки доступны

Когда беглец достигает свободной точки:
  1. Беглец входит в точку
  2. Побег удался
  3. Раунд завершён
```

### Псевдокод блокировки

```javascript
class Blockade {
    constructor(exits, config) {
        this.exits = exits; // Массив из 3 финальных точек
        this.blockedExit = null;
        this.isBlockadeChosen = false;
    }
    
    // Для игрока-детектива
    chooseBlockade(clickedExit) {
        if (!this.exits.includes(clickedExit)) return false;
        
        this.blockedExit = clickedExit;
        this.isBlockadeChosen = true;
        
        // Визуальный эффект: красный крест на точке
        this.renderBlockedMarker(clickedExit);
        this.playSound('blockade_placed');
        
        return true;
    }
    
    // Для ИИ-детектива
    aiChooseBlockade(strategy) {
        switch (strategy) {
            case 'random':
                this.blockedExit = randomChoice(this.exits);
                break;
            case 'nearest':
                // Блокируем ближайшую к старту беглеца
                this.blockedExit = this.findNearestExit();
                break;
            case 'smart':
                // Блокируем точку с лучшим путём (для будущего расширения)
                this.blockedExit = this.findBestExit();
                break;
        }
        this.isBlockadeChosen = true;
    }
    
    // Проверка при достижении точки беглецом
    checkExit(exitCell) {
        if (exitCell === this.blockedExit) {
            return {
                isBlocked: true,
                message: 'ТОЧКА ЗАБЛОКИРОВАНА!',
                action: 'reroute' // Беглец должен идти к другой точке
            };
        }
        return {
            isBlocked: false,
            message: 'ПОБЕГ УДАЛСЯ!',
            action: 'escape' // Беглец сбежал
        };
    }
    
    // Беглец узнаёт о блокировке
    revealBlockadeToFugitive() {
        this.showBlockedAnimation(this.blockedExit);
        this.playSound('blocked');
        // Беглец видит красный крест на заблокированной точке
        // и должен выбрать другую со следующего хода
    }
}
```

---

## 10. ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ

### Философия ИИ

ИИ **тупой и предсказуемый**. Это сознательное решение для джема:
- Проще в реализации (2-3 дня вместо 2 недель)
- Даёт игроку пространство для тактики
- Предсказуемость = возможность планировать
- Не нужно балансировать «умный» ИИ

### ИИ Детектива (когда игрок = Беглец)

```
ИИ ДЕТЕКТИВА:

Состояние 1: ПАТРУЛИРОВАНИЕ
  - Детектив не видит беглеца
  - Идёт к случайной точке в радиусе 5 клеток
  - По достижении: ждёт 2 хода, выбирает новую точку
  - Повторяет

Состояние 2: ПРЕСЛЕДОВАНИЕ
  - Детектив увидел беглеца (или двойника) в радиусе 3
  - Переходит в режим преследования
  - Движется к беглецу по A* (кратчайший путь)
  - Скорость: 2 шага на каждый шаг беглеца
  - Продолжает, пока беглец в видимости

Состояние 3: ПОИСК
  - Беглец вышел из видимости
  - Детектив идёт к последней известной позиции
  - По достижении: ждёт 3 хода (память)
  - Если не видит беглеца: возвращается к ПАТРУЛИРОВАНИЮ

Состояние 4: ОЗАРЕНИЕ
  - Детектив поймал двойника
  - Видит беглеца до конца следующего хода
  - Движется напрямую к беглецу, игнорируя стены видимости
```

### ИИ Беглеца (когда игрок = Детектив)

```
ИИ БЕГЛЕЦА:

Состояние 1: ПОБЕГ
  - Беглец знает, где детектив (видит всю карту)
  - Выбирает ближайшую свободную финальную точку
  - Строит путь к ней через A*
  - Программирует 5 шагов по этому пути
  - Воспроизводит

Состояние 2: УКЛОНЕНИЕ
  - Детектив в радиусе 5 клеток от пути беглеца
  - Беглец добавляет 30% случайных отклонений в маршрут
  - Может выбрать другую финальную точку, если текущая опасна

Состояние 3: ДВОЙНИК
  - Со 2-го хода: размещает двойника
  - Двойник ставится в точке вне видимости детектива
  - Двойник повторяет предыдущий маршрут

Состояние 4: ЗАБЛОКИРОВАННАЯ ТОЧКА
  - Беглец достиг заблокированной точки
  - Выбирает другую свободную точку
  - Перестраивает маршрут
```

### Псевдокод ИИ детектива

```javascript
class DetectiveAI {
    constructor(detective, config) {
        this.detective = detective;
        this.state = 'patrol'; // patrol | chase | search | epiphany
        this.patrolTarget = null;
        this.lastKnownPosition = null;
        this.memoryCounter = 0;
    }
    
    update(fugitive, echoes) {
        switch (this.state) {
            case 'patrol':
                this.patrol(fugitive);
                break;
            case 'chase':
                this.chase(fugitive);
                break;
            case 'search':
                this.search(fugitive);
                break;
            case 'epiphany':
                this.epiphany(fugitive);
                break;
        }
    }
    
    patrol(fugitive) {
        // Проверяем, не видим ли беглеца
        if (this.detective.canSee(fugitive.position)) {
            this.state = 'chase';
            this.lastKnownPosition = fugitive.position;
            return;
        }
        
        // Проверяем, не видим ли двойника
        const visibleEcho = this.findVisibleEcho();
        if (visibleEcho) {
            this.state = 'chase';
            this.patrolTarget = visibleEcho.position;
            return;
        }
        
        // Патрулирование: идём к случайной точке
        if (!this.patrolTarget || this.reachedTarget()) {
            this.patrolTarget = this.randomPatrolPoint();
        }
        
        this.moveTowards(this.patrolTarget);
    }
    
    chase(fugitive) {
        // Проверяем, видим ли ещё беглеца
        if (this.detective.canSee(fugitive.position)) {
            this.lastKnownPosition = fugitive.position;
            this.moveTowards(fugitive.position);
            return;
        }
        
        // Беглец скрылся из виду
        this.state = 'search';
        this.memoryCounter = 0;
    }
    
    search(fugitive) {
        // Идём к последней известной позиции
        if (!this.reachedLastKnownPosition()) {
            this.moveTowards(this.lastKnownPosition);
            return;
        }
        
        // Ждём 3 хода
        this.memoryCounter++;
        if (this.memoryCounter >= config.ai.detectiveMemoryTurns) {
            this.state = 'patrol';
            this.memoryCounter = 0;
        }
        
        // Проверяем, не появился ли беглец в видимости
        if (this.detective.canSee(fugitive.position)) {
            this.state = 'chase';
            this.lastKnownPosition = fugitive.position;
        }
    }
    
    epiphany(fugitive) {
        // Видим беглеца до конца следующего хода
        this.moveTowards(fugitive.position);
        
        // После следующего хода — возвращаемся к обычной логике
        this.state = 'patrol';
    }
}
```

### Псевдокод ИИ беглеца

```javascript
class FugitiveAI {
    constructor(fugitive, config) {
        this.fugitive = fugitive;
        this.targetExit = null;
        this.currentPath = [];
    }
    
    update(detective) {
        // Шаг 1: Выбираем целевую финальную точку
        if (!this.targetExit || this.targetExit.isBlocked) {
            this.targetExit = this.chooseExit(detective);
        }
        
        // Шаг 2: Строим путь к цели
        this.currentPath = this.buildPathTo(this.targetExit);
        
        // Шаг 3: Проверяем, не слишком ли близко детектив
        if (this.isDetectiveNear(detective)) {
            this.addEvasionToPath();
        }
        
        // Шаг 4: Программируем 5 шагов
        const programmedPath = this.currentPath.slice(0, 5);
        
        // Шаг 5: Размещаем двойника (со 2-го хода)
        if (this.fugitive.currentTurn >= 2) {
            this.placeEcho(detective);
        }
        
        return programmedPath;
    }
    
    chooseExit(detective) {
        const availableExits = this.fugitive.grid.exits
            .filter(exit => !exit.isBlocked);
        
        // Выбираем ближайшую свободную точку
        let nearest = availableExits[0];
        let minDistance = Infinity;
        
        for (const exit of availableExits) {
            const path = aStar(this.grid, this.fugitive.position, exit);
            if (path && path.length < minDistance) {
                minDistance = path.length;
                nearest = exit;
            }
        }
        
        return nearest;
    }
    
    isDetectiveNear(detective) {
        const dx = Math.abs(this.fugitive.position.x - detective.position.x);
        const dy = Math.abs(this.fugitive.position.y - detective.position.y);
        return (dx + dy) <= 5; // Радиус 5 клеток
    }
    
    addEvasionToPath() {
        // 30% шанс случайного отклонения
        if (Math.random() < config.ai.fugitiveRandomTurnChance) {
            const randomDirection = randomChoice(['up', 'down', 'left', 'right']);
            // Вставляем случайный шаг в путь
            this.currentPath.splice(2, 0, randomDirection);
        }
    }
    
    placeEcho(detective) {
        // Ищем клетку вне видимости детектива
        const candidates = this.grid.getAllCells()
            .filter(cell => {
                const dx = Math.abs(cell.x - detective.position.x);
                const dy = Math.abs(cell.y - detective.position.y);
                return (dx + dy) > config.visibility.detectiveRadius;
            });
        
        if (candidates.length > 0) {
            const echoPosition = randomChoice(candidates);
            this.fugitive.placeEcho(echoPosition);
        }
    }
}
```

---

## 11. СИСТЕМА МЕДАЛЕЙ

### Логика медалей

| Результат Раунда 1 | Результат Раунда 2 | Медаль |
|---|---|---|
| ✅ Победа за беглеца | ❌ Поражение за детектива | 🥉 Односторонняя медаль |
| ❌ Поражение за беглеца | ✅ Победа за детектива | 🥉 Односторонняя медаль |
| ✅ Победа за беглеца | ✅ Победа за детектива | 🥇 Двусторонняя медаль |
| ❌ Поражение за беглеца | ❌ Поражение за детектива | ❌ Без медали |

### Визуализация медали

```
ОДНОСТОРОННЯЯ МЕДАЛЬ:
  ┌─────────────┐
  │             │
  │   ★         │  ← Одна сторона гравирована
  │             │
  │  FUGITIVE   │
  │             │
  └─────────────┘
  (обратная сторона пустая)

ДВУСТОРОННЯЯ МЕДАЛЬ:
  ┌─────────────┐
  │             │
  │   ★    ◈   │  ← Обе стороны гравированы
  │             │
  │  FUGITIVE   │
  │  DETECTIVE  │
  │             │
  └─────────────┘
```

### Псевдокод медалей

```javascript
class MedalSystem {
    constructor() {
        this.round1Result = null; // 'win' | 'lose'
        this.round2Result = null; // 'win' | 'lose'
    }
    
    setRoundResult(round, result) {
        if (round === 1) this.round1Result = result;
        if (round === 2) this.round2Result = result;
    }
    
    getMedal() {
        if (this.round1Result === null || this.round2Result === null) {
            return null; // Игра не завершена
        }
        
        const wins = [this.round1Result, this.round2Result]
            .filter(r => r === 'win').length;
        
        switch (wins) {
            case 2: return 'double_medal';   // Двусторонняя
            case 1: return 'single_medal';   // Односторонняя
            case 0: return 'no_medal';       // Без медали
        }
    }
    
    showMedalScreen() {
        const medal = this.getMedal();
        
        switch (medal) {
            case 'double_medal':
                this.showDoubleMedalAnimation();
                this.playSound('victory_fanfare');
                break;
            case 'single_medal':
                this.showSingleMedalAnimation();
                this.playSound('victory_short');
                break;
            case 'no_medal':
                this.showDefeatScreen();
                this.playSound('defeat');
                break;
        }
    }
}
```

---

## 12. ВИЗУАЛЬНЫЙ СТИЛЬ

### Палитра (3 цвета)

| Цвет | HEX | Назначение |
|---|---|---|
| Чёрный | `#0A0A0A` | Фон, здания, непроходимые клетки, реки |
| Белый | `#F4F1DE` | Дороги, беглец, текст, интерфейсы, мосты |
| Красный | `#E63946` | Детектив, двойник, финальные точки, опасности, UI-акценты |

### Элементы карты (визуал)

```
ДОРОГА:        ЗДАНИЕ:         РЕКА:           МОСТ:
┌───┐          ┌───┐           ≈ ≈ ≈           ═══
│   │          │███│           ≈ ≈ ≈           ═══
└───┘          └───┘           ≈ ≈ ≈           ═══
Белый контур   Чёрный блок     Белые волны     Белая линия

МЕТРО:         СТАРТ:          ФИНАЛ:          ЗАБЛОКИРОВАНО:
┌───┐          ┌───┐           ┌───┐           ┌───┐
│ Ⓜ │          │ ★ │           │ ⬟ │           │ ⬟̸ │
└───┘          └───┘           └───┘           └───┘
Белый круг     Белая звезда    Красный ромб    Красный ромб + крест
```

### Персонажи

```
БЕГЛЕЦ:                ДЕТЕКТИВ:              ДВОЙНИК:
   ●                      ◈                      ○
Белый круг           Красный ромб           Полупрозрачный
                                             белый круг (50% opacity)
                                             + пунктирный контур
```

### Визуальные эффекты

| Эффект | Реализация | Назначение |
|---|---|---|
| **Scanlines** | CSS: повторяющийся градиент | Ощущение старого монитора |
| **Vignette** | CSS: радиальный градиент | Фокус на центре экрана |
| **Glow** | Canvas: `shadowBlur` на красных элементах | Выделение детектива и финальных точек |
| **Noise** | PNG-текстура поверх всего | Зерно плёнки, «живость» картинки |
| **Typewriter** | Посимвольный вывод текста | Нуарная атмосфера |
| **Trail** | Полупрозрачные следы за персонажами | Отслеживание маршрутов |
| **Pulse** | Масштабирование зоны видимости 1.0↔1.05 | Показ активности детектива |
| **Glitch** | Кратковременное смещение слоёв | Момент «озарения» детектива |
| **Fade In** | Постепенное появление клеток карты | Начало раунда, «изучение карты» |

### Псевдокод эффектов

```javascript
class VisualEffects {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.noiseTexture = this.loadNoiseTexture();
        this.scanlineOffset = 0;
    }
    
    renderScanlines() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        for (let y = 0; y < this.canvas.height; y += 4) {
            this.ctx.fillRect(0, y, this.canvas.width, 1);
        }
    }
    
    renderVignette() {
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    renderGlow(x, y, color, radius) {
        this.ctx.save();
        this.ctx.shadowBlur = radius;
        this.ctx.shadowColor = color;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
    
    renderNoise() {
        this.ctx.globalAlpha = 0.03;
        this.ctx.drawImage(this.noiseTexture, 0, 0);
        this.ctx.globalAlpha = 1.0;
    }
    
    typewriterText(text, x, y, speed = 50) {
        let index = 0;
        const interval = setInterval(() => {
            if (index < text.length) {
                this.ctx.fillText(text[index], x + index * 10, y);
                index++;
                this.playSound('typewriter');
            } else {
                clearInterval(interval);
            }
        }, speed);
    }
    
    renderTrail(positions, color) {
        for (let i = 0; i < positions.length; i++) {
            const alpha = 0.1 + (i / positions.length) * 0.3;
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = color;
            this.ctx.fillRect(
                positions[i].x * CELL_SIZE,
                positions[i].y * CELL_SIZE,
                CELL_SIZE, CELL_SIZE
            );
        }
        this.ctx.globalAlpha = 1.0;
    }
}
```

### UI и экраны

```
ГЛАВНОЕ МЕНЮ:
┌──────────────────────────────────────┐
│                                      │
│         FUGITIVE vs DETECTIVE        │
│                                      │
│         [ НОВАЯ ИГРА ]               │
│         [ ПРАВИЛА ]                  │
│                                      │
│              🎮                      │
│                                      │
└──────────────────────────────────────┘

ЭКРАН ПРОГРАММИРОВАНИЯ:
┌──────────────────────────────────────┐
│ ХОД 3          ФАЗА: ПРОГРАММИРОВАНИЕ│
│                                      │
│   [КАРТА 20×12]                      │
│                                      │
│   Путь: ①→②→③→④→⑤                  │
│   Двойник: [УСТАНОВИТЬ]              │
│                                      │
│   [СБРОС]  [ОТМЕНА]  [ВОСПРОИЗВЕСТИ]│
└──────────────────────────────────────┘

ЭКРАН ПОБЕГА:
┌──────────────────────────────────────┐
│                                      │
│         ПОБЕГ УДАЛСЯ!                │
│                                      │
│         Беглец достиг: АЭРОПОРТ      │
│                                      │
│         [ СЛЕДУЮЩИЙ РАУНД ]          │
│                                      │
└──────────────────────────────────────┘

ЭКРАН МЕДАЛИ:
┌──────────────────────────────────────┐
│                                      │
│         РАУНД 1: ✅ ПОБЕДА           │
│         РАУНД 2: ✅ ПОБЕДА           │
│                                      │
│         🥇 ДВУСТОРОННЯЯ МЕДАЛЬ       │
│                                      │
│         [ ИГРАТЬ СНОВА ]             │
│                                      │
└──────────────────────────────────────┘
```

---

## 13. ЗВУКОВОЙ ДИЗАЙН

### Список звуков

| Звук | Триггер | Описание |
|---|---|---|
| `step_placed` | Клик по клетке пути | Короткий щелчок |
| `error` | Клик в несоседнюю клетку | Низкий гудок |
| `undo` | Отмена последнего шага | Обратный щелчок |
| `execute` | Запуск воспроизведения | Короткий свист |
| `step_walk` | Шаг персонажа | Тихий стук |
| `echo_appear` | Появление двойника | Эхо-эффект |
| `echo_caught` | Детектив поймал двойника | Глитч + звоночек |
| `blocked` | Достижение заблокированной точки | Тревожный гудок |
| `escape` | Беглец достиг финальной точки | Победный аккорд |
| `caught` | Детектив поймал беглеца | Резкий удар |
| `blockade_placed` | Детектив блокирует точку | Металлический лязг |
| `epiphany` | «Озарение» детектива | Восходящий тон |
| `typewriter` | Вывод текста | Стук клавиш |
| `victory_fanfare` | Двусторонняя медаль | Фанфары |
| `victory_short` | Односторонняя медаль | Короткая мелодия |
| `defeat` | Без медали | Нисходящий тон |
| `metro_teleport` | Телепорт через метро | Свист + гудок |

### Музыка

- **Раунд беглеца:** Минималистичный напряжённый эмбиент (низкие частоты, редкие удары)
- **Раунд детектива:** Более агрессивный, ритмичный трек (нуарный джаз или синтвейв)
- **Меню:** Тихий фоновый шум города + далёкий дождь

---

## 14. ТЕХНИЧЕСКАЯ АРХИТЕКТУРА

### Стек технологий

| Компонент | Технология |
|---|---|
| Язык | Чистый JavaScript (ES6+) |
| Рендеринг | HTML5 Canvas 2D |
| UI | HTML + CSS |
| Звук | Web Audio API |
| Хранение | LocalStorage (для рекордов) |
| Деплой | itch.io / GitHub Pages |

### Архитектурные паттерны

- **Игровой цикл:** `requestAnimationFrame` с фиксированным тиком
- **Состояния игры:** Конечный автомат (меню → программирование → воспроизведение → результат)
- **События:** Простая система событий (EventEmitter) для коммуникации между модулями
- **Конфигурация:** Все балансные числа в отдельном конфиг-файле

### Игровые состояния

```
СОСТОЯНИЯ ИГРЫ:

MENU
  └→ ROUND_1_BLOCKADE (детектив блокирует точку)
      └→ ROUND_1_PROGRAMMING (игрок программирует ходы)
          └→ ROUND_1_PLAYING (воспроизведение)
              └→ ROUND_1_RESULT (побег или поимка)
                  └→ ROUND_2_BLOCKADE (игрок блокирует точку)
                      └→ ROUND_2_PROGRAMMING (ИИ программирует ходы)
                          └→ ROUND_2_PLAYING (воспроизведение)
                              └→ ROUND_2_RESULT (побег или поимка)
                                  └→ MEDAL_SCREEN (медали)
                                      └→ MENU
```

---

## 15. ФАЙЛОВАЯ СТРУКТУРА

```
/fugitive-vs-detective
│
├── index.html                    ← Главная страница
├── style.css                     ← Стили, эффекты (scanlines, vignette)
│
├── /src
│   ├── config.js                 ← ВСЕ балансные числа
│   ├── constants.js              ← Константы (цвета, размеры)
│   ├── main.js                   ← Точка входа, инициализация
│   ├── game-loop.js              ← Двухфазный игровой цикл
│   ├── state-manager.js          ← Конечный автомат состояний
│   ├── event-bus.js              ← Система событий
│   │
│   ├── /grid
│   │   ├── grid.js               ← Сетка 20×12, клетки
│   │   ├── cell.js               ← Класс клетки
│   │   ├── directions.js         ← 4 направления
│   │   └── visibility.js         ← Зона видимости (радиус 3)
│   │
│   ├── /map
│   │   ├── map-generator.js      ← Процедурная генерация
│   │   ├── river-generator.js    ← Генерация реки и мостов
│   │   ├── building-generator.js ← Генерация зданий
│   │   ├── metro-generator.js    ← Генерация метро-пар
│   │   ├── balance-checker.js    ← Проверка баланса путей
│   │   ├── balance-corrector.js  ← Коррекция баланса
│   │   └── connectivity-check.js ← Проверка связности (flood fill)
│   │
│   ├── /entities
│   │   ├── fugitive.js           ← Беглец
│   │   ├── detective.js          ← Детектив
│   │   ├── echo.js               ← Двойник
│   │   └── blockade.js           ← Блокировка финальной точки
│   │
│   ├── /ai
│   │   ├── detective-ai.js       ← ИИ детектива
│   │   ├── fugitive-ai.js        ← ИИ беглеца
│   │   └── pathfinding.js        ← A* алгоритм
│   │
│   ├── /input
│   │   ├── path-programmer.js    ← Программирование кликами
│   │   ├── path-validator.js     ← Валидация соседних клеток
│   │   ├── undo-manager.js       ← Undo/Cancel
│   │   └── echo-placer.js        ← Размещение двойника
│   │
│   ├── /renderer
│   │   ├── canvas-renderer.js    ← Отрисовка на canvas
│   │   ├── grid-renderer.js      ← Отрисовка сетки
│   │   ├── entity-renderer.js    ← Отрисовка персонажей
│   │   ├── path-renderer.js      ← Отрисовка траектории (пунктир)
│   │   ├── effects.js            ← Glow, trails, glitch
│   │   ├── scanlines.js          ← CRT-эффект
│   │   ├── vignette.js           ← Затемнение краёв
│   │   ├── noise.js              ← Зерно плёнки
│   │   └── typewriter.js         ← Посимвольный текст
│   │
│   ├── /ui
│   │   ├── ui-manager.js         ← Управление UI
│   │   ├── menu-screen.js        ← Главное меню
│   │   ├── rules-screen.js       ← Экран правил
│   │   ├── programming-ui.js     ← UI фазы программирования
│   │   ├── result-screen.js      ← Экран результата раунда
│   │   ├── medal-screen.js       ← Экран медалей
│   │   └── blockade-ui.js        ← UI выбора блокировки
│   │
│   ├── /audio
│   │   ├── sound-manager.js      ← Управление звуками
│   │   └── music-manager.js      ← Фоновая музыка
│   │
│   └── /utils
│       ├── helpers.js            ← Утилиты
│       ├── random.js             ← Рандом (сидированный)
│       └── timer.js              ← Таймеры и задержки
│
├── /assets
│   ├── /sounds
│   │   ├── step_placed.mp3
│   │   ├── error.mp3
│   │   ├── undo.mp3
│   │   ├── execute.mp3
│   │   ├── step_walk.mp3
│   │   ├── echo_appear.mp3
│   │   ├── echo_caught.mp3
│   │   ├── blocked.mp3
│   │   ├── escape.mp3
│   │   ├── caught.mp3
│   │   ├── blockade_placed.mp3
│   │   ├── epiphany.mp3
│   │   ├── typewriter.mp3
│   │   ├── victory_fanfare.mp3
│   │   ├── victory_short.mp3
│   │   ├── defeat.mp3
│   │   └── metro_teleport.mp3
│   │
│   ├── /music
│   │   ├── menu_ambience.mp3
│   │   ├── fugitive_round.mp3
│   │   └── detective_round.mp3
│   │
│   └── /textures
│       └── noise.png             ← Текстура зерна
│
└── /tests
    ├── map-generator.test.js     ← Тесты генератора
    ├── pathfinding.test.js       ← Тесты A*
    ├── balance-checker.test.js   ← Тесты баланса
    └── echo-logic.test.js        ← Тесты двойника
```

---

## 16. КОНФИГУРАЦИЯ

### Полный конфиг-файл

```javascript
// src/config.js
// ВСЕ балансные числа игры. Меняй здесь — тестируй сразу.

const GAME_CONFIG = {
    
    // ═══════════════════════════════════════
    // СЕТКА
    // ═══════════════════════════════════════
    grid: {
        width: 20,               // Клеток по горизонтали
        height: 12,              // Клеток по вертикали
        cellSize: 48,            // Размер клетки в пикселях
    },
    
    // ═══════════════════════════════════════
    // НАПРАВЛЕНИЯ
    // ═══════════════════════════════════════
    directions: {
        count: 4,                // 4 направления (без диагоналей)
        // 'up', 'down', 'left', 'right'
    },
    
    // ═══════════════════════════════════════
    // ВИДИМОСТЬ
    // ═══════════════════════════════════════
    visibility: {
        detectiveRadius: 3,      // Радиус видимости детектива (манхэттен)
        fugitiveSeesAll: true,   // Беглец видит детектива везде
    },
    
    // ═══════════════════════════════════════
    // ДВИЖЕНИЕ
    // ═══════════════════════════════════════
    movement: {
        fugitiveSteps: 5,        // Шагов беглеца за фазу
        detectiveSteps: 10,      // Шагов детектива за фазу
        detectiveChaseMultiplier: 2, // ×2 при преследовании
    },
    
    // ═══════════════════════════════════════
    // ПРОГРАММИРОВАНИЕ ХОДОВ
    // ═══════════════════════════════════════
    programming: {
        requireAllSteps: true,   // Нужно запрограммировать все 5 шагов
        requireEcho: true,       // Нужно установить двойника (со 2-го хода)
        allowUndo: true,         // Разрешить отмену последнего шага
        allowReset: true,        // Разрешить сброс всего пути
        maxSteps: 5,             // Максимум шагов в программе
    },
    
    // ═══════════════════════════════════════
    // ДВОЙНИК (ЭХО)
    // ═══════════════════════════════════════
    echo: {
        maxCount: 1,             // Максимум двойников на карте
        lifetimePhases: 1,       // Живёт 1 фазу
        allowedFromTurn: 2,      // Доступен со 2-го хода
        placementRule: 'outsideDetectiveVision', // Вне видимости детектива
        placementRadius: 3,      // Тот же радиус, что у детектива
        repeatsAllPreviousSteps: true, // Повторяет все 5 шагов
        skipBlockedSteps: true,  // Пропускает невозможные шаги
    },
    
    // ═══════════════════════════════════════
    // БЛОКИРОВКА ФИНАЛЬНОЙ ТОЧКИ
    // ═══════════════════════════════════════
    blockade: {
        detectiveChooses: true,  // Детектив выбирает точку сам
        blockadePermanent: true, // Точка закрыта навсегда
        fugitiveMustReroute: true, // Беглец должен идти к другой точке
        aiBlockadeStrategy: 'random', // 'random' | 'nearest' | 'smart'
        revealOnReach: true,     // Беглец узнаёт при достижении
    },
    
    // ═══════════════════════════════════════
    // ФИНАЛЬНЫЕ ТОЧКИ
    // ═══════════════════════════════════════
    exits: {
        count: 3,                // Количество финальных точек
        balanceTolerance: 0.2,   // Допустимая разница в длине путей (20%)
        generationMaxIterations: 10, // Максимум итераций генерации
    },
    
    // ═══════════════════════════════════════
    // ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ
    // ═══════════════════════════════════════
    ai: {
        fugitiveRandomTurnChance: 0.3, // 30% случайный поворот
        detectiveMemoryTurns: 3,       // Сколько ходов помнит позицию
        detectivePatrolRadius: 5,      // Радиус патрулирования
        detectiveSearchWaitTurns: 3,   // Сколько ждать на последней позиции
    },
    
    // ═══════════════════════════════════════
    // КАРТА (ГЕНЕРАЦИЯ)
    // ═══════════════════════════════════════
    map: {
        riverRows: [4, 8],       // Река между строками 4 и 8
        bridgesCount: [2, 3],    // Количество мостов (мин-макс)
        metroPairsCount: [2, 3], // Количество пар метро (мин-макс)
        buildingsCount: [8, 12], // Количество зданий (мин-макс)
        buildingSizes: [         // Возможные размеры зданий
            [2, 2],
            [3, 3],
            [1, 4],
            [2, 5],
        ],
        startFugitiveZone: 'center', // Старт беглеца в центре
        exitZones: ['north', 'southwest', 'southeast'], // Зоны финальных точек
    },
    
    // ═══════════════════════════════════════
    // АНИМАЦИЯ
    // ═══════════════════════════════════════
    animation: {
        stepDelay: 300,          // Задержка между шагами (мс)
        echoFadeDuration: 500,   // Длительность исчезновения двойника
        typewriterSpeed: 50,     // Скорость печати текста (мс/символ)
        glitchDuration: 300,     // Длительность глитча (мс)
        mapFadeInDuration: 1000, // Появление карты (мс)
    },
    
    // ═══════════════════════════════════════
    // ЗВУК
    // ═══════════════════════════════════════
    audio: {
        masterVolume: 0.7,       // Громкость эффектов
        musicVolume: 0.4,        // Громкость музыки
        sfxVolume: 0.8,          // Громкость SFX
    },
    
    // ═══════════════════════════════════════
    // ИГРА
    // ═══════════════════════════════════════
    game: {
        maxTurns: 30,            // Максимум ходов в раунде (защита от бесконечности)
        roundCount: 2,           // Количество раундов
    },
};

export default GAME_CONFIG;
```

---

## 17. ПСЕВДОКОД ОСНОВНЫХ СИСТЕМ

### 17.1 Игровой цикл

```javascript
// src/game-loop.js

class GameLoop {
    constructor(config) {
        this.state = 'MENU'; // MENU | PROGRAMMING | PLAYING | RESULT
        this.currentRound = 1;
        this.currentTurn = 0;
        this.grid = null;
        this.fugitive = null;
        this.detective = null;
        this.echo = null;
        this.blockade = null;
        this.medalSystem = new MedalSystem();
    }
    
    startGame() {
        // Генерируем карту
        this.grid = generateMap(config);
        
        // Раунд 1: Игрок = Беглец
        this.startRound(1, 'fugitive');
    }
    
    startRound(roundNumber, playerRole) {
        this.currentRound = roundNumber;
        this.currentTurn = 0;
        
        // Создаём персонажей
        this.fugitive = new Fugitive(this.grid.startFugitive, config);
        this.detective = new Detective(this.grid.startDetective, config);
        
        // Блокировка финальной точки
        this.blockade = new Blockade(this.grid.exits, config);
        
        if (playerRole === 'detective') {
            // Игрок выбирает блокировку
            this.state = 'BLOCKADE_CHOICE';
            this.showBlockadeUI();
        } else {
            // ИИ блокирует случайную точку
            this.blockade.aiChooseBlockade(config.blockade.aiBlockadeStrategy);
            this.state = 'PROGRAMMING';
        }
    }
    
    update() {
        switch (this.state) {
            case 'MENU':
                this.updateMenu();
                break;
            case 'BLOCKADE_CHOICE':
                // Ждём выбора игрока
                break;
            case 'PROGRAMMING':
                this.updateProgramming();
                break;
            case 'PLAYING':
                this.updatePlaying();
                break;
            case 'RESULT':
                this.updateResult();
                break;
            case 'MEDAL':
                this.updateMedal();
                break;
        }
    }
    
    updateProgramming() {
        // Фаза программирования: ждём действий игрока
        // Обработка кликов, валидация пути, установка двойника
        
        if (this.programmer.canExecute()) {
            this.executeTurn();
        }
    }
    
    async executeTurn() {
        this.state = 'PLAYING';
        this.currentTurn++;
        
        // Фаза воспроизведения
        // 1. Беглец делает 5 шагов
        await this.fugitive.executeProgrammedPath(this.programmer.path);
        
        // 2. Детектив делает 10 шагов (по 2 после каждого шага беглеца)
        await this.detective.executeTurn(this.fugitive, [this.echo]);
        
        // 3. Двойник делает 5 шагов (повтор прошлого хода)
        if (this.echo) {
            await this.echo.executeTurn();
        }
        
        // 4. Проверка условий завершения
        if (this.fugitive.isCaught) {
            this.endRound('detective');
        } else if (this.fugitive.isEscaped) {
            this.endRound('fugitive');
        } else if (this.currentTurn >= config.game.maxTurns) {
            this.endRound('detective'); // Таймаут = победа детектива
        } else {
            // Следующий ход
            this.state = 'PROGRAMMING';
            this.programmer.resetForNextTurn();
        }
    }
    
    endRound(winner) {
        this.state = 'RESULT';
        this.showResultScreen(winner);
        
        if (this.currentRound === 1) {
            // Переход к раунду 2
            this.medalSystem.setRoundResult(1, winner === 'fugitive' ? 'win' : 'lose');
            this.startRound(2, 'detective'); // Смена ролей
        } else {
            // Конец игры
            this.medalSystem.setRoundResult(2, winner === 'detective' ? 'win' : 'lose');
            this.state = 'MEDAL';
            this.medalSystem.showMedalScreen();
        }
    }
}
```

### 17.2 A* Поиск пути

```javascript
// src/ai/pathfinding.js

function aStar(grid, start, goal) {
    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    gScore.set(key(start), 0);
    fScore.set(key(start), heuristic(start, goal));
    
    while (openSet.length > 0) {
        // Находим клетку с наименьшим fScore
        let current = openSet.reduce((min, cell) => {
            return (fScore.get(key(cell)) || Infinity) < 
                   (fScore.get(key(min)) || Infinity) ? cell : min;
        });
        
        if (current.x === goal.x && current.y === goal.y) {
            return reconstructPath(cameFrom, current);
        }
        
        openSet.splice(openSet.indexOf(current), 1);
        
        for (const neighbor of getNeighbors(grid, current)) {
            if (!grid.isWalkable(neighbor)) continue;
            
            const tentativeGScore = (gScore.get(key(current)) || Infinity) + 1;
            
            if (tentativeGScore < (gScore.get(key(neighbor)) || Infinity)) {
                cameFrom.set(key(neighbor), current);
                gScore.set(key(neighbor), tentativeGScore);
                fScore.set(key(neighbor), tentativeGScore + heuristic(neighbor, goal));
                
                if (!openSet.some(cell => cell.x === neighbor.x && cell.y === neighbor.y)) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    
    return null; // Путь не найден
}

function heuristic(a, b) {
    // Манхэттенское расстояние
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getNeighbors(grid, cell) {
    const directions = [
        { x: 0, y: -1 }, // up
        { x: 0, y: 1 },  // down
        { x: -1, y: 0 }, // left
        { x: 1, y: 0 },  // right
    ];
    
    return directions
        .map(d => ({ x: cell.x + d.x, y: cell.y + d.y }))
        .filter(c => grid.isInBounds(c));
}

function reconstructPath(cameFrom, current) {
    const path = [current];
    while (cameFrom.has(key(current))) {
        current = cameFrom.get(key(current));
        path.unshift(current);
    }
    return path;
}

function key(cell) {
    return `${cell.x},${cell.y}`;
}
```

### 17.3 Проверка связности (Flood Fill)

```javascript
// src/map/connectivity-check.js

function checkConnectivity(grid, start, targets) {
    const visited = new Set();
    const queue = [start];
    visited.add(key(start));
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        for (const neighbor of getNeighbors(grid, current)) {
            const k = key(neighbor);
            
            if (visited.has(k)) continue;
            if (!grid.isWalkable(neighbor)) continue;
            
            visited.add(k);
            queue.push(neighbor);
        }
    }
    
    // Проверяем, все ли целевые точки достижимы
    for (const target of targets) {
        if (!visited.has(key(target))) {
            return false; // Точка недостижима
        }
    }
    
    return true; // Все точки достижимы
}
```

### 17.4 Зона видимости

```javascript
// src/grid/visibility.js

class Visibility {
    constructor(radius) {
        this.radius = radius; // 3
    }
    
    isVisible(from, to) {
        const dx = Math.abs(from.x - to.x);
        const dy = Math.abs(from.y - to.y);
        const distance = dx + dy; // Манхэттенское расстояние
        
        return distance <= this.radius;
    }
    
    getVisibleCells(center) {
        const cells = [];
        
        for (let dx = -this.radius; dx <= this.radius; dx++) {
            for (let dy = -this.radius; dy <= this.radius; dy++) {
                const distance = Math.abs(dx) + Math.abs(dy);
                if (distance <= this.radius) {
                    cells.push({
                        x: center.x + dx,
                        y: center.y + dy,
                    });
                }
            }
        }
        
        return cells;
    }
}

// Пример для радиуса 3:
//
//        ░
//      ░ ░ ░
//    ░ ░ ░ ░ ░
//      ░ ░ ░
//        ░
```

### 17.5 Рендерер траектории

```javascript
// src/renderer/path-renderer.js

class PathRenderer {
    constructor(ctx, cellSize) {
        this.ctx = ctx;
        this.cellSize = cellSize;
    }
    
    renderProgrammedPath(path) {
        if (path.length === 0) return;
        
        // Пунктирная линия
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeStyle = '#F4F1DE'; // Белый
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        
        for (let i = 0; i < path.length; i++) {
            const x = path[i].x * this.cellSize + this.cellSize / 2;
            const y = path[i].y * this.cellSize + this.cellSize / 2;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Сброс пунктира
        
        // Номера шагов на клетках
        for (let i = 0; i < path.length; i++) {
            this.renderStepNumber(path[i], i + 1);
        }
    }
    
    renderStepNumber(cell, number) {
        const x = cell.x * this.cellSize + this.cellSize / 2;
        const y = cell.y * this.cellSize + this.cellSize / 2;
        
        // Круг
        this.ctx.fillStyle = '#F4F1DE';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Число
        this.ctx.fillStyle = '#0A0A0A';
        this.ctx.font = 'bold 12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(number.toString(), x, y);
    }
    
    renderError(cell) {
        const x = cell.x * this.cellSize + this.cellSize / 2;
        const y = cell.y * this.cellSize + this.cellSize / 2;
        const size = 8;
        
        // Красный крестик
        this.ctx.strokeStyle = '#E63946';
        this.ctx.lineWidth = 3;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x - size, y - size);
        this.ctx.lineTo(x + size, y + size);
        this.ctx.moveTo(x + size, y - size);
        this.ctx.lineTo(x - size, y + size);
        this.ctx.stroke();
    }
}
```

---

## 18. ПЛАН РАЗРАБОТКИ (18 СУТОК)

### Неделя 1: Фундамент (Дни 1–7)

| День | Задача | Результат |
|---|---|---|
| **1** | Настройка проекта, конфиг, сетка 20×12 | `index.html`, `config.js`, `grid.js` — пустая сетка рендерится |
| **2** | Рендерер сетки, клетки, направления | Сетка с дорогами и зданиями, 4 направления работают |
| **3** | Процедурная генерация: река, мосты, здания | Карта генерируется, есть река с мостами |
| **4** | Проверка связности, метро-пары | Все клетки связаны, метро телепортирует |
| **5** | Балансировка финальных точек | 3 точки с равными путями (±20%) |
| **6** | Программирование кликами, валидация | Игрок кликает 5 клеток, путь рисуется пунктиром |
| **7** | Двухфазный цикл: программирование → воспроизведение | Беглец двигается по программе |

### Неделя 2: Механики (Дни 8–12)

| День | Задача | Результат |
|---|---|---|
| **8** | Двойник: размещение, повтор маршрута | Двойник появляется и повторяет прошлый ход |
| **9** | Видимость детектива (радиус 3), преследование | Детектив видит в радиусе, преследует |
| **10** | ИИ детектива: патруль, преследование, поиск | ИИ-детектив работает в раунде беглеца |
| **11** | Блокировка финальной точки | Детектив блокирует, беглец узнаёт при достижении |
| **12** | ИИ беглеца: побег, уклонение, двойник | ИИ-беглец работает в раунде детектива |

### Неделя 3: Полировка (Дни 13–18)

| День | Задача | Результат |
|---|---|---|
| **13** | Визуал: 3-цветная палитра, эффекты | Игра выглядит в стиле нуар |
| **14** | Звуки и музыка | Все звуки на месте, фоновая музыка |
| **15** | UI: меню, экраны, медали | Полный цикл игры работает |
| **16** | Балансировка: тесты, подстройка конфига | Игра сбалансирована |
| **17** | Багфикс, оптимизация | Нет критических багов |
| **18** | Финальный полишинг, деплой | Игра на itch.io / GitHub Pages |

---

## 19. БАЛАНСИРОВКА И ТЕСТИРОВАНИЕ

### Чек-лист тестирования

| Тест | Ожидаемый результат |
|---|---|
| Беглец программирует 5 шагов | Путь рисуется пунктиром с номерами |
| Клик в несоседнюю клетку | Красный крестик + звук ошибки |
| Клик в здание | Красный крестик + звук ошибки |
| Клик в реку без моста | Красный крестик + звук ошибки |
| Двойник повторяет прошлый ход | Двойник проходит тот же маршрут |
| Двойник упирается в стену | Двойник пропускает шаг, делает следующий |
| Двойник в зоне видимости детектива | Нельзя поставить, красный крестик |
| Детектив видит беглеца в радиусе 3 | Детектив начинает преследование |
| Детектив ловит двойника | «Озарение»: видит беглеца до конца следующего хода |
| Детектив ловит беглеца | Раунд завершён, победа детектива |
| Беглец достигает свободной точки | Раунд завершён, победа беглеца |
| Беглец достигает заблокированной точки | Точка закрыта, беглец идёт к другой |
| Детектив блокирует точку в начале | Точка закрыта, беглец не знает |
| Все 3 финальные точки сбалансированы | Разница в путях ≤ 20% |
| Карта связная | Все клетки достижимы от старта |
| Метро телепортирует | Вход → выход работает |

### Параметры для балансировки

```
ЕСЛИ беглец слишком силён:
  → Уменьшить detectiveSteps (10 → 8)
  → Увеличить detectiveChaseMultiplier (2 → 2.5)
  → Уменьшить visionRadius детектива (3 → 2)

ЕСЛИ детектив слишком силён:
  → Увеличить detectiveSteps (10 → 12)
  → Уменьшить detectiveMemoryTurns (3 → 2)
  → Увеличить fugitiveSteps (5 → 6)

ЕСЛИ двойник слишком силён:
  → Уменьшить maxCount (1 → 1, уже минимум)
  → Увеличить allowedFromTurn (2 → 3)
  → Уменьшить lifetimePhases (1 → 1, уже минимум)

ЕСЛИ блокировка слишком сильна:
  → Изменить blockadePermanent (true → false)
  → Разрешить беглецу «взломать» блокировку за 1 ход

ЕСЛИ игра слишком длинная:
  → Уменьшить maxTurns (30 → 20)
  → Уменьшить размер карты (20×12 → 16×10)
  → Увеличить скорость детектива
```

---

## 20. РИСКИ И МИТИГАЦИЯ

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| Процедурная генерация не балансируется | Средняя | Высокое | Начать с перегенерации вместо коррекции. Шаблоны как запасной вариант |
| ИИ слишком тупой / слишком умный | Высокая | Среднее | Конфиг-файл для быстрой подстройки. Тесты на бумаге |
| Двойник создаёт неразрешимые ситуации | Средняя | Высокое | Ограничить размещение двойника. Тесты edge cases |
| Не успеваю за 18 дней | Средняя | Критическое | MVP на день 10. Полировка на день 13. Деплой на день 16 |
| Баланс 5 шагов беглеца vs 10 шагов детектива | Высокая | Высокое | Конфиг-файл. Бумажное прототипирование до кода |
| Визуальные эффекты тормозят | Низкая | Среднее | Отключать эффекты при низком FPS. Минимум частиц |
| Звук не работает в браузере | Низкая | Низкое | Проверка поддержки. Запасной вариант без звука |

### Запасные планы

```
ЕСЛИ не успеваю визуальные эффекты (день 13-14):
  → Убираю scanlines, noise, glitch
  → Оставляю: 3 цвета + пунктир + номера шагов
  → Этого достаточно для играбельности

ЕСЛИ не успеваю ИИ (день 10-12):
  → ИИ детектива: просто идёт к беглецу по A*
  → ИИ беглеца: просто идёт к ближайшей точке по A*
  → Без патрулирования и уклонения

ЕСЛИ не успеваю блокировку (день 11):
  → Убираю механику блокировки
  → Беглец всегда знает, какие точки доступны
  → Игра проще, но играбельна

ЕСЛИ не успеваю двойника (день 8):
  → Убираю двойника
  → Игра становится классической «догони/убеги»
  → Но теряет ключевую механику темы джема ⚠️
```

---

## 📎 ПРИЛОЖЕНИЕ А: Быстрая справка по механикам

```
╔══════════════════════════════════════════════════════════╗
║              FUGITIVE vs DETECTIVE                       ║
║              Быстрая справка                             ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  БЕГЛЕЦ:                                                 ║
║  • 5 шагов за ход                                        ║
║  • Видит детектива всегда                                ║
║  • Двойник со 2-го хода (1 на карте, 1 фаза)            ║
║  • Цель: дойти до свободной финальной точки              ║
║                                                          ║
║  ДЕТЕКТИВ:                                               ║
║  • 10 шагов за ход (по 2 после каждого шага беглеца)    ║
║  • Видимость: радиус 3 клетки                            ║
║  • Блокирует 1 финальную точку в начале                 ║
║  • Цель: поймать беглеца                                 ║
║                                                          ║
║  ДВОЙНИК:                                                ║
║  • Повторяет все 5 шагов прошлого хода                   ║
║  • Пропускает невозможные шаги                           ║
║  • Вне видимости детектива при размещении                ║
║  • Поимка → детектив видит беглеца до конца след. хода  ║
║                                                          ║
║  БЛОКИРОВКА:                                             ║
║  • Детектив блокирует 1 из 3 точек                       ║
║  • Беглец узнаёт только при достижении                   ║
║  • Точка закрыта навсегда                                ║
║  • Беглец должен идти к другой точке                     ║
║                                                          ║
║  КАРТА:                                                  ║
║  • 20×12 клеток                                          ║
║  • 4 направления движения                                ║
║  • Процедурная генерация с балансировкой                 ║
║  • 3 финальные точки с равными путями (±20%)            ║
║                                                          ║
║  МЕДАЛИ:                                                 ║
║  • Победил 1 раунд → односторонняя медаль                ║
║  • Победил оба раунда → двусторонняя медаль              ║
║  • Проиграл оба → без медали                             ║
║                                                          ║
║  ПАЛИТРА: Чёрный #0A0A0A | Белый #F4F1DE | Красный #E63946 ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

---

## 📎 ПРИЛОЖЕНИЕ Б: Глоссарий

| Термин | Определение |
|---|---|
| **Фаза программирования** | Игрок кликает клетки пути и размещает двойника |
| **Фаза воспроизведения** | Запрограммированные действия выполняются пошагово |
| **Двойник (Эхо)** | Призрак, повторяющий все 5 шагов предыдущего хода беглеца |
| **Блокировка** | Закрытие детективом одной финальной точки |
| **Озарение** | Бонус детектива после поимки двойника: видит беглеца |
| **Манхэттенское расстояние** | \|x1-x2\| + \|y1-y2\|. Используется для видимости |
| **A*** | Алгоритм поиска кратчайшего пути |
| **Flood Fill** | Алгоритм проверки связности карты |
| **Балансировка путей** | Обеспечение равной длины путей к финальным точкам |

---

## 📎 ПРИЛОЖЕНИЕ В: Чек-лист готовности к деплою

- [ ] Все механики работают (беглец, детектив, двойник, блокировка)
- [ ] Процедурная генерация создаёт сбалансированные карты
- [ ] ИИ работает в обоих раундах
- [ ] Двухфазный цикл без багов
- [ ] Визуал в 3 цвета
- [ ] Звуки на всех ключевых событиях
- [ ] Медали отображаются корректно
- [ ] Нет критических багов
- [ ] Игра запускается в браузере без сервера
- [ ] Размер игры < 50 МБ
- [ ] Деплой на itch.io / GitHub Pages
- [ ] Скриншоты и описание для страницы проекта

---
