// ============================================================================
// ИСПЫТАНИЯ ПЕРЕД СПУСКОМ
// Добровольные модификаторы сложности. Каждое умножает очки и Эхо за спуск,
// множители перемножаются. Выбор хранится в профиле, чтобы не сбрасывался.
// ============================================================================

export type TrialKey = 'GLASS' | 'DIM_TORCH' | 'FAST_DARK' | 'CROWD' | 'SWIFT_SHADOWS';

export interface TrialDefinition {
  key: TrialKey;
  name: string;
  description: string;
  /** Короткая строка «что меняет» для карточки. */
  effect: string;
  /** Множитель очков и Эха за спуск. */
  multiplier: number;
}

export const TRIALS: Record<TrialKey, TrialDefinition> = {
  GLASS: {
    key: 'GLASS',
    name: 'СТЕКЛЯННЫЙ СТРАЖ',
    description: 'Один удар — и стража нет. Зато крипта щедра на славу.',
    effect: 'Максимум здоровья — 1',
    multiplier: 1.35,
  },
  DIM_TORCH: {
    key: 'DIM_TORCH',
    name: 'ТУСКЛЫЙ ФАКЕЛ',
    description: 'Ткань факела отсырела: свет едва разгоняет тьму.',
    effect: 'Радиус света −30%',
    multiplier: 1.2,
  },
  FAST_DARK: {
    key: 'FAST_DARK',
    name: 'БЫСТРАЯ ТЬМА',
    description: 'Тьма наступает раньше и отступает неохотно.',
    effect: 'Фазы наступают на 30% раньше',
    multiplier: 1.2,
  },
  CROWD: {
    key: 'CROWD',
    name: 'ТЕСНОТА',
    description: 'Из трещин лезет больше теней, и они не ждут очереди.',
    effect: '+25% врагов, +1 одновременно',
    multiplier: 1.25,
  },
  SWIFT_SHADOWS: {
    key: 'SWIFT_SHADOWS',
    name: 'БЫСТРЫЕ ТЕНИ',
    description: 'Тьма торопится: каждая тень движется быстрее обычного.',
    effect: 'Скорость врагов +20%',
    multiplier: 1.25,
  },
};

/** Порядок карточек в окне испытаний. */
export const TRIAL_ORDER: TrialKey[] = [
  'GLASS',
  'DIM_TORCH',
  'FAST_DARK',
  'CROWD',
  'SWIFT_SHADOWS',
];

/** Числовые эффекты испытаний: сцена не знает о конкретных ключах. */
export const TRIAL_VALUES = {
  GLASS_MAX_HP: 1,
  DIM_LIGHT_MULTIPLIER: 0.7,
  FAST_PHASE_MULTIPLIER: 0.7,
  CROWD_SPAWN_MULTIPLIER: 1.25,
  CROWD_MAX_ALIVE_BONUS: 1,
  SWIFT_SHADOWS_SPEED_MULTIPLIER: 1.2,
} as const;

/** Во сколько раз испытания увеличивают очки и Эхо за спуск. */
export function getTrialMultiplier(active: Iterable<TrialKey>): number {
  let multiplier = 1;
  for (const key of active) {
    multiplier *= TRIALS[key].multiplier;
  }
  return multiplier;
}

export function isTrialKey(value: unknown): value is TrialKey {
  return typeof value === 'string' && (TRIAL_ORDER as readonly string[]).includes(value);
}

/** Готовые поправки на спуск, чтобы сцена не разбирала ключи по одному. */
export interface TrialEffects {
  /** Если задано — здоровье принудительно равно этому значению. */
  maxHpOverride: number | null;
  lightMultiplier: number;
  /** Множитель порогов фаз: меньше 1 — тьма наступает раньше. */
  phaseThresholdMultiplier: number;
  spawnMultiplier: number;
  maxAliveBonus: number;
  /** Множитель скорости врагов и боссов. */
  enemySpeedMultiplier: number;
  /** Множитель итоговых очков и Эха. */
  scoreMultiplier: number;
}

export function getTrialEffects(active: ReadonlySet<TrialKey>): TrialEffects {
  return {
    maxHpOverride: active.has('GLASS') ? TRIAL_VALUES.GLASS_MAX_HP : null,
    lightMultiplier: active.has('DIM_TORCH') ? TRIAL_VALUES.DIM_LIGHT_MULTIPLIER : 1,
    phaseThresholdMultiplier: active.has('FAST_DARK')
      ? TRIAL_VALUES.FAST_PHASE_MULTIPLIER
      : 1,
    spawnMultiplier: active.has('CROWD') ? TRIAL_VALUES.CROWD_SPAWN_MULTIPLIER : 1,
    maxAliveBonus: active.has('CROWD') ? TRIAL_VALUES.CROWD_MAX_ALIVE_BONUS : 0,
    enemySpeedMultiplier: active.has('SWIFT_SHADOWS')
      ? TRIAL_VALUES.SWIFT_SHADOWS_SPEED_MULTIPLIER
      : 1,
    scoreMultiplier: getTrialMultiplier(active),
  };
}
