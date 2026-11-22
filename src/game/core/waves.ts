import type { EnemyTypeKey } from './gameConfig';
import type { BossTypeKey } from './bosses';

// ============================================================================
// ВОЛНЫ
// Одна волна = список врагов, которые нужно победить, чтобы пойти дальше.
// Последняя волна — босс: она заканчивается только его смертью.
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

// ============================================================================
// ЭТАЖИ
// Три этажа по три волны. Последняя волна этажа открывает выбор дара,
// а сам спуск закрывает босс (десятая волна).
// ============================================================================
export interface FloorConfig {
  name: string;
  /** Индекс последней волны этажа: после неё игрок выбирает дар. */
  lastWave: number;
}

export const FLOORS: FloorConfig[] = [
  { name: 'Сухие галереи', lastWave: 2 },
  { name: 'Затопленные склепы', lastWave: 5 },
  { name: 'Пепельный трон', lastWave: 8 },
];

/** Этаж, к которому относится волна. Для босса — последний этаж. */
export function getFloorIndex(waveIndex: number): number {
  const index = FLOORS.findIndex((floor) => waveIndex <= floor.lastWave);
  return index === -1 ? FLOORS.length - 1 : index;
}

/** true, если волна закрывает этаж и пора предлагать дар. */
export function isFloorEnd(waveIndex: number): boolean {
  return FLOORS.some((floor) => floor.lastWave === waveIndex);
}

export const WAVES: WaveConfig[] = [
  // --- Этаж I: Сухие галереи (разминка на роевиках и сталкерах) ---
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

  // --- Этаж II: Затопленные склепы (бруты, мученики и плевки) ---
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

  // --- Этаж III: Пепельный трон (элита и плотное давление) ---
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
];
