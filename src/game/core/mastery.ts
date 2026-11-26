// ============================================================================
// МАСТЕРСТВО ЛОКАЦИИ
// Победы в конкретной локации открывают местные перки. Эхо и улучшения
// остаются общими, а мастерство добавляет бонусы за верность одной локации:
// прогресс не отбирают, но у каждого спуска появляется своя лестница.
// ============================================================================

/** Сколько побед нужно для каждой ступени мастерства. */
export const MASTERY_THRESHOLDS = {
  /** +1 к максимуму здоровья в этой локации. */
  HP: 3,
  /** +10% Эха за спуски здесь. */
  ECHO: 6,
  /** Случайный дар на старте спуска. */
  BOON: 10,
} as const;

export const MASTERY_VALUES = {
  HP_BONUS: 1,
  ECHO_BONUS: 0.1,
} as const;

export interface MasteryPerks {
  victories: number;
  /** Сколько ступеней открыто: 0 — ни одной, 3 — все. */
  tier: number;
  hpBonus: number;
  echoMultiplier: number;
  startingBoon: boolean;
  /** Сколько побед осталось до следующей ступени; null — всё открыто. */
  victoriesToNext: number | null;
}

/** Читает мастерство из числа побед в локации. */
export function getMastery(victories: number): MasteryPerks {
  const safe = Math.max(0, Math.floor(victories));

  const tier =
    safe >= MASTERY_THRESHOLDS.BOON
      ? 3
      : safe >= MASTERY_THRESHOLDS.ECHO
        ? 2
        : safe >= MASTERY_THRESHOLDS.HP
          ? 1
          : 0;

  const nextThreshold =
    tier === 0
      ? MASTERY_THRESHOLDS.HP
      : tier === 1
        ? MASTERY_THRESHOLDS.ECHO
        : tier === 2
          ? MASTERY_THRESHOLDS.BOON
          : null;

  return {
    victories: safe,
    tier,
    hpBonus: tier >= 1 ? MASTERY_VALUES.HP_BONUS : 0,
    echoMultiplier: tier >= 2 ? 1 + MASTERY_VALUES.ECHO_BONUS : 1,
    startingBoon: tier >= 3,
    victoriesToNext: nextThreshold === null ? null : nextThreshold - safe,
  };
}

/** Ступени для «Книги стража»: подписи и условия. */
export const MASTERY_STEPS = [
  {
    threshold: MASTERY_THRESHOLDS.HP,
    title: 'ЗНАКОМЫЙ СВЕТ',
    effect: `+${MASTERY_VALUES.HP_BONUS} к максимуму здоровья здесь`,
  },
  {
    threshold: MASTERY_THRESHOLDS.ECHO,
    title: 'ХОЗЯИН ГЛУБИН',
    effect: `+${Math.round(MASTERY_VALUES.ECHO_BONUS * 100)}% Эха за спуски здесь`,
  },
  {
    threshold: MASTERY_THRESHOLDS.BOON,
    title: 'СВОЙ В КРИПТЕ',
    effect: 'Случайный дар на старте спуска',
  },
] as const;
