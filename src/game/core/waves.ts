import type { EnemyTypeKey } from './gameConfig';
import type { BossTypeKey } from './bosses';

// ============================================================================
// ВОЛНЫ И УРОВНИ
// Уровень — отдельный спуск: три этажа по три волны и босс в конце.
// Новая локация открывается победой над боссом предыдущей.
// ============================================================================

export interface WaveEscort {
  type: EnemyTypeKey;
  count: number;
}

/** Свита, которая продолжает появляться, пока босс жив. */
export interface BossAddsConfig {
  /** Пауза перед первым появлением свиты. */
  startDelay: number;
  /** Пауза между появлениями. */
  spawnInterval: number;
  /** Сколько мобов может быть на поле одновременно. */
  maxAlive: number;
  /** Веса типов свиты. */
  weights: Partial<Record<EnemyTypeKey, number>>;
}

export interface WaveConfig {
  name: string;
  /** Сколько обычных врагов появится за волну (включая guaranteed). */
  spawnCount: number;
  /** Пауза между появлениями в секундах. */
  spawnInterval: number;
  /** Сколько врагов может быть на поле одновременно. */
  maxAlive: number;
  /** Эти враги появятся первыми, чтобы новинка не потерялась в толпе. */
  guaranteed?: EnemyTypeKey[];
  /** Веса случайных врагов после guaranteed. */
  weights?: Partial<Record<EnemyTypeKey, number>>;
  /** Если задан — волна боссовая. */
  boss?: BossTypeKey;
  /** Кто появляется вместе с боссом. */
  escorts?: WaveEscort[];
  /** Живая свита босса: источник маны и постоянное давление. */
  adds?: BossAddsConfig;
}

export interface FloorConfig {
  name: string;
  /** Индекс последней волны этажа: после неё игрок выбирает дар. */
  lastWave: number;
}

export interface LevelConfig {
  name: string;
  floors: FloorConfig[];
  waves: WaveConfig[];
}

/** Этаж, к которому относится волна. Для босса — последний этаж. */
export function getFloorIndex(level: LevelConfig, waveIndex: number): number {
  const index = level.floors.findIndex((floor) => waveIndex <= floor.lastWave);
  return index === -1 ? level.floors.length - 1 : index;
}

/** true, если волна закрывает этаж и пора предлагать дар. */
export function isFloorEnd(level: LevelConfig, waveIndex: number): boolean {
  return level.floors.some((floor) => floor.lastWave === waveIndex);
}

// ============================================================================
// ЛОКАЦИИ
// ============================================================================

export const LEVELS: LevelConfig[] = [
  // ---------------------------------------------------------- ЛОКАЦИЯ I
  {
    name: 'Сухие галереи',
    floors: [
      { name: 'Сухие галереи', lastWave: 2 },
      { name: 'Затопленные склепы', lastWave: 5 },
      { name: 'Пепельный трон', lastWave: 8 },
    ],
    waves: [
      // --- Этаж I: разминка на роевиках и сталкерах ---
      {
        name: 'Пробуждение',
        spawnCount: 10,
        spawnInterval: 1.4,
        maxAlive: 6,
        weights: { SWARMER: 100 },
      },
      {
        name: 'Тени сгущаются',
        spawnCount: 12,
        spawnInterval: 1.25,
        maxAlive: 7,
        weights: { SWARMER: 60, STALKER: 40 },
      },
      {
        name: 'Шёпот бездны',
        spawnCount: 14,
        spawnInterval: 1.1,
        maxAlive: 8,
        guaranteed: ['SPITTER'],
        weights: { SWARMER: 45, STALKER: 35, SPITTER: 20 },
      },

      // --- Этаж II: бруты, мученики и плевки ---
      {
        name: 'Ржавые кандалы',
        spawnCount: 12,
        spawnInterval: 1.1,
        maxAlive: 8,
        guaranteed: ['BRUTE'],
        weights: { SWARMER: 30, STALKER: 40, BRUTE: 30 },
      },
      {
        name: 'Пламя угасает',
        spawnCount: 14,
        spawnInterval: 1,
        maxAlive: 9,
        guaranteed: ['BOMBER', 'BOMBER'],
        weights: { SWARMER: 25, STALKER: 25, SPITTER: 25, BOMBER: 25 },
      },
      {
        name: 'Хор плевков',
        spawnCount: 14,
        spawnInterval: 0.95,
        maxAlive: 9,
        guaranteed: ['SPITTER', 'SPITTER'],
        weights: { SWARMER: 30, STALKER: 30, SPITTER: 40 },
      },

      // --- Этаж III: элита и плотное давление ---
      {
        name: 'Костяной марш',
        spawnCount: 14,
        spawnInterval: 0.9,
        maxAlive: 10,
        guaranteed: ['BRUTE', 'BRUTE'],
        weights: { STALKER: 30, BRUTE: 30, BOMBER: 25, SPITTER: 15 },
      },
      {
        name: 'Обвал',
        spawnCount: 16,
        spawnInterval: 0.85,
        maxAlive: 10,
        guaranteed: ['BOMBER', 'BOMBER', 'BOMBER'],
        weights: { SWARMER: 30, STALKER: 20, SPITTER: 15, BOMBER: 35 },
      },
      {
        name: 'Последняя стража',
        spawnCount: 16,
        spawnInterval: 0.8,
        maxAlive: 11,
        guaranteed: ['SPITTER', 'BRUTE', 'STALKER'],
        weights: { SWARMER: 25, STALKER: 25, SPITTER: 20, BRUTE: 15, BOMBER: 15 },
      },

      // --- Финал ---
      {
        name: 'Пожиратель Пламени',
        spawnCount: 0,
        spawnInterval: 1,
        maxAlive: 0,
        boss: 'FLAME_EATER',
        escorts: [{ type: 'STALKER', count: 2 }],
        adds: {
          startDelay: 2,
          spawnInterval: 3.5,
          maxAlive: 4,
          weights: { SWARMER: 55, STALKER: 35, SPITTER: 10 },
        },
      },
    ],
  },

  // --------------------------------------------------------- ЛОКАЦИЯ II
  {
    name: 'Костяные катакомбы',
    floors: [
      { name: 'Костяной лабиринт', lastWave: 2 },
      { name: 'Тихие ниши', lastWave: 5 },
      { name: 'Бледный хор', lastWave: 8 },
    ],
    waves: [
      {
        name: 'Первый скрип',
        spawnCount: 11,
        spawnInterval: 1.3,
        maxAlive: 7,
        guaranteed: ['HOUND'],
        weights: { HOUND: 55, SWARMER: 45 },
      },
      {
        name: 'Кости под ногами',
        spawnCount: 13,
        spawnInterval: 1.15,
        maxAlive: 8,
        guaranteed: ['ELITE_STALKER'],
        weights: { HOUND: 40, STALKER: 35, ELITE_STALKER: 25 },
      },
      {
        name: 'Сторожа во тьме',
        spawnCount: 14,
        spawnInterval: 1.05,
        maxAlive: 8,
        guaranteed: ['WATCHER'],
        weights: { HOUND: 30, WATCHER: 40, STALKER: 30 },
      },
      {
        name: 'Хруст',
        spawnCount: 14,
        spawnInterval: 1,
        maxAlive: 9,
        guaranteed: ['ELITE_BRUTE'],
        weights: { HOUND: 35, BRUTE: 25, WATCHER: 20, ELITE_BRUTE: 20 },
      },
      {
        name: 'Тихие ниши',
        spawnCount: 15,
        spawnInterval: 0.95,
        maxAlive: 9,
        guaranteed: ['WATCHER', 'WATCHER'],
        weights: { HOUND: 30, WATCHER: 35, SPITTER: 20, ELITE_STALKER: 15 },
      },
      {
        name: 'Костяной хор',
        spawnCount: 15,
        spawnInterval: 0.9,
        maxAlive: 10,
        guaranteed: ['ELITE_BOMBER'],
        weights: { HOUND: 30, STALKER: 25, ELITE_BOMBER: 25, WATCHER: 20 },
      },
      {
        name: 'Бледный свет',
        spawnCount: 16,
        spawnInterval: 0.85,
        maxAlive: 10,
        guaranteed: ['ELITE_STALKER', 'ELITE_STALKER'],
        weights: { HOUND: 30, ELITE_STALKER: 25, WATCHER: 25, BRUTE: 20 },
      },
      {
        name: 'Обвал костей',
        spawnCount: 17,
        spawnInterval: 0.8,
        maxAlive: 11,
        guaranteed: ['ELITE_BRUTE'],
        weights: { HOUND: 30, ELITE_BOMBER: 25, ELITE_BRUTE: 20, STALKER: 25 },
      },
      {
        name: 'Последняя стража',
        spawnCount: 17,
        spawnInterval: 0.75,
        maxAlive: 11,
        guaranteed: ['WATCHER', 'ELITE_BRUTE', 'ELITE_BOMBER'],
        weights: {
          HOUND: 25,
          WATCHER: 20,
          ELITE_STALKER: 20,
          ELITE_BRUTE: 20,
          ELITE_BOMBER: 15,
        },
      },
      {
        name: 'Бледный Часовой',
        spawnCount: 0,
        spawnInterval: 1,
        maxAlive: 0,
        boss: 'PALE_WARDEN',
        escorts: [{ type: 'WATCHER', count: 2 }],
        adds: {
          startDelay: 2,
          spawnInterval: 3.2,
          maxAlive: 4,
          weights: { HOUND: 60, WATCHER: 40 },
        },
      },
    ],
  },

  // -------------------------------------------------------- ЛОКАЦИЯ III
  {
    name: 'Мёртвый улей',
    floors: [
      { name: 'Соты гнили', lastWave: 2 },
      { name: 'Гнездо', lastWave: 5 },
      { name: 'Чрево роя', lastWave: 8 },
    ],
    waves: [
      {
        name: 'Соты гнили',
        spawnCount: 13,
        spawnInterval: 1.25,
        maxAlive: 8,
        guaranteed: ['HOUND'],
        weights: { HOUND: 45, WATCHER: 30, SPITTER: 25 },
      },
      {
        name: 'Липкие стены',
        spawnCount: 14,
        spawnInterval: 1.1,
        maxAlive: 9,
        guaranteed: ['ELITE_BOMBER', 'ELITE_BOMBER'],
        weights: { HOUND: 35, ELITE_BOMBER: 25, SPITTER: 25, WATCHER: 15 },
      },
      {
        name: 'Рой просыпается',
        spawnCount: 15,
        spawnInterval: 1.05,
        maxAlive: 9,
        guaranteed: ['ELITE_STALKER'],
        weights: { HOUND: 40, ELITE_STALKER: 25, WATCHER: 20, SWARMER: 15 },
      },
      {
        name: 'Кислотный дождь',
        spawnCount: 16,
        spawnInterval: 1,
        maxAlive: 10,
        guaranteed: ['WATCHER', 'WATCHER'],
        weights: { HOUND: 30, WATCHER: 30, SPITTER: 20, ELITE_BOMBER: 20 },
      },
      {
        name: 'Тяжёлая плоть',
        spawnCount: 16,
        spawnInterval: 0.95,
        maxAlive: 10,
        guaranteed: ['ELITE_BRUTE', 'ELITE_BRUTE'],
        weights: { HOUND: 30, ELITE_BRUTE: 30, WATCHER: 20, ELITE_STALKER: 20 },
      },
      {
        name: 'Хитиновый хор',
        spawnCount: 17,
        spawnInterval: 0.9,
        maxAlive: 10,
        guaranteed: ['ELITE_BOMBER', 'ELITE_STALKER'],
        weights: { HOUND: 35, ELITE_BOMBER: 20, ELITE_STALKER: 20, SPITTER: 25 },
      },
      {
        name: 'Гнездо',
        spawnCount: 18,
        spawnInterval: 0.85,
        maxAlive: 11,
        guaranteed: ['ELITE_BRUTE'],
        weights: { HOUND: 35, WATCHER: 25, ELITE_STALKER: 20, ELITE_BRUTE: 20 },
      },
      {
        name: 'Стены дышат',
        spawnCount: 18,
        spawnInterval: 0.8,
        maxAlive: 11,
        guaranteed: ['ELITE_BOMBER', 'ELITE_BOMBER', 'ELITE_BRUTE'],
        weights: { HOUND: 35, ELITE_BOMBER: 25, ELITE_BRUTE: 20, WATCHER: 20 },
      },
      {
        name: 'Чрево роя',
        spawnCount: 19,
        spawnInterval: 0.75,
        maxAlive: 12,
        guaranteed: ['ELITE_STALKER', 'ELITE_BRUTE', 'WATCHER'],
        weights: {
          HOUND: 30,
          ELITE_STALKER: 20,
          ELITE_BRUTE: 20,
          ELITE_BOMBER: 15,
          WATCHER: 15,
        },
      },
      {
        name: 'Мать Роя',
        spawnCount: 0,
        spawnInterval: 1,
        maxAlive: 0,
        boss: 'ROT_MOTHER',
        escorts: [{ type: 'HOUND', count: 2 }],
        adds: {
          startDelay: 1.5,
          spawnInterval: 2.4,
          maxAlive: 5,
          weights: { HOUND: 55, SWARMER: 25, SPITTER: 20 },
        },
      },
    ],
  },
];

/**
 * Множитель Эха за спуск: поздние локации опаснее и платят больше.
 * Индекс совпадает с LEVELS; для будущих локаций берётся последнее значение.
 */
export const LEVEL_ECHO_MULTIPLIERS = [1, 1.2, 1.45] as const;

export function getLevelEchoMultiplier(levelIndex: number): number {
  const index = Math.min(
    Math.max(0, Math.floor(levelIndex)),
    LEVEL_ECHO_MULTIPLIERS.length - 1
  );
  return LEVEL_ECHO_MULTIPLIERS[index];
}
