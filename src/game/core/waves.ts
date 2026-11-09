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

export const WAVES: WaveConfig[] = [
  {
    name: 'Пробуждение',
    spawnCount: 10,
    spawnInterval: 1.4,
    maxAlive: 6,
    weights: { SWARMER: 100 },
  },
  {
    name: 'Тени сгущаются',
    spawnCount: 14,
    spawnInterval: 1.15,
    maxAlive: 8,
    weights: { SWARMER: 60, STALKER: 40 },
  },
  {
    name: 'Шёпот бездны',
    spawnCount: 14,
    spawnInterval: 1,
    maxAlive: 9,
    guaranteed: ['SPITTER', 'BRUTE'],
    weights: { SWARMER: 40, STALKER: 30, SPITTER: 30 },
  },
  {
    name: 'Пламя угасает',
    spawnCount: 18,
    spawnInterval: 0.9,
    maxAlive: 11,
    guaranteed: ['BOMBER', 'BOMBER', 'BRUTE'],
    weights: { SWARMER: 25, STALKER: 30, SPITTER: 20, BOMBER: 25 },
  },
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
