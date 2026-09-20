export const CONFIG = {
  grid: { cols: 20, rows: 13, cell: 40 },   // 13-я строка (y=12) — железная дорога

  turn: {
    fugitiveSteps: 5,
    detectiveSteps: 10,
    microRounds: 5,          // 1 шаг беглеца : 2 шага детектива : 1 шаг двойника
    maxTurns: 12,
  },

  vision: {
    detectiveRadius: 3,
    memoryTurns: 3,          // память о последней позиции беглеца
  },

  map: {
    riverRowRange: [4, 8],   // река — ровно одна строка
    bridges: 3,
    metroPairs: 2,
    exits: 3,
  },

  echo: {
    steps: 5,
    allowedFromTurn: 2,      // доступен со 2-го хода
    maxCount: 1,             // один двойник на карте
    requireOutsideVision: true, // ставить только вне видимости детектива
  },
  blockade: {
    aiStrategy: 'random',      // 'random' | 'nearest' (GDD §9/§16)
  },

  ai: {
    fugitiveRandomTurnChance: 0.3, // 30% случайный уклон (GDD §10)
    detectiveMemoryTurns: 3,       // память о последней позиции
    detectivePatrolRadius: 5,      // радиус патрулирования (v0.7+)
  },

  game: {
    roundCount: 2,                 // раундов в партии (GDD §3)
  },

  animation: { stepDelay: 300 },
  debug: { showLos: false },
};
