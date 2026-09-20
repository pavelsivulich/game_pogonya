export const COLORS = {
  ink: '#0a0a0a',
  paper: '#f4f1ea',
  blood: '#e63946',
  grid: '#1c1c1c',
  fog: 'rgba(10,10,10,0.43)',
  danger: 'rgba(230,57,70,0.14)',
};

export const TILE = {
  FLOOR: 'floor',
  ROAD: 'road',       // проезжая дорога (v0.10.0): проходима, особое оформление
  WALL: 'wall',
  RIVER: 'river',
  RAIL: 'rail',       // железная дорога (v0.10.0): непроходимая строка, по ней ездит поезд
  BRIDGE: 'bridge',
  METRO: 'metro',
  EXIT: 'exit',
};

// Тематика выходов (v0.10.0): вокзал — на ж/д строке, порт — у реки, аэропорт — свободно
export const EXIT_KIND = {
  STATION: 'station',
  PORT: 'port',
  AIRPORT: 'airport',
};

export const PHASE = {
  BOOT: 'BOOT',
  MAP_GEN: 'MAP_GEN',
  ROUND_INTRO: 'ROUND_INTRO',           // баннер раунда + смена ролей
  BLOCKADE_CHOICE: 'BLOCKADE_CHOICE',   // игрок-детектив выбирает выход для блока
  PROGRAM_FUGITIVE: 'PROGRAM_FUGITIVE',
  PROGRAM_DETECTIVE: 'PROGRAM_DETECTIVE',
  RESOLVE: 'RESOLVE',
  ROUND_RESULT: 'ROUND_RESULT',
  GAME_OVER: 'GAME_OVER',
};

// Роль игрока в раунде (GDD §3): раунд 1 — беглец, раунд 2 — детектив.
export const ROLE = {
  FUGITIVE: 'fugitive',
  DETECTIVE: 'detective',
};

export const ERR = {
  NOT_ADJACENT: 'NOT_ADJACENT',
  IMPASSABLE: 'IMPASSABLE',
  REVISIT: 'REVISIT',
  START_CELL: 'START_CELL',
  ENEMY_CELL: 'ENEMY_CELL',
  BLOCKED_EXIT: 'BLOCKED_EXIT',
  WAIT_FORBIDDEN: 'WAIT_FORBIDDEN',
  DEADLINE: 'DEADLINE',
  DEAD_END: 'DEAD_END',
  ECHO_IN_VISION: 'ECHO_IN_VISION',   // двойник нельзя ставить в видимости детектива
  ECHO_OCCUPIED: 'ECHO_OCCUPIED',     // клетка занята персонажем
};
