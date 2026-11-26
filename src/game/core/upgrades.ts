// ============================================================================
// УЛУЧШЕНИЯ ЛАГЕРЯ
// Постоянные бонусы покупаются за Эхо между спусками. Здесь только описания,
// цены и расчёт бонусов — покупку и сохранение делает core/profile.ts.
// ============================================================================

export type UpgradeKey =
  | 'VITALITY'
  | 'MANA_RESERVE'
  | 'BRIGHT_TORCH'
  | 'SWIFT_HAND'
  | 'FORTUNE';

export interface UpgradeDefinition {
  key: UpgradeKey;
  name: string;
  description: string;
  /** Короткая строка «что даёт уровень» для карточки. */
  effect: string;
  maxLevel: number;
  /** Цена покупки очередного уровня: prices[0] — с 0 на 1 и т.д. */
  prices: number[];
}

/** Сколько даёт один уровень каждого улучшения. */
export const UPGRADE_VALUES = {
  HP_PER_LEVEL: 1,
  MANA_PER_LEVEL: 5,
  LIGHT_PER_LEVEL: 0.03,
  /** Доля, на которую сокращается перезарядка выстрела. */
  COOLDOWN_PER_LEVEL: 0.05,
  /** Доля, на которую растёт Эхо за спуск. */
  ECHO_PER_LEVEL: 0.05,
} as const;

export const UPGRADES: Record<UpgradeKey, UpgradeDefinition> = {
  VITALITY: {
    key: 'VITALITY',
    name: 'КРЕПКАЯ СТРАЖА',
    description: 'Закалка тела стража: следующий спуск начнётся с большим запасом здоровья.',
    effect: `+${UPGRADE_VALUES.HP_PER_LEVEL} к максимуму здоровья`,
    maxLevel: 4,
    // Здоровье не растёт с числом локаций: иначе челлендж исчезает.
    prices: [70, 160, 320, 560],
  },
  MANA_RESERVE: {
    key: 'MANA_RESERVE',
    name: 'РЕЗЕРВ ЭФИРА',
    description: 'Запас эфира в дороге: больше маны уже на старте спуска.',
    effect: `+${UPGRADE_VALUES.MANA_PER_LEVEL} к стартовой мане`,
    maxLevel: 6,
    // 8 уровней × 5 = +40: старт упирается ровно в MAX_MANA.
    prices: [40, 80, 140, 220, 340, 500, 700, 900],
  },
  BRIGHT_TORCH: {
    key: 'BRIGHT_TORCH',
    name: 'ЯРКИЙ ФАКЕЛ',
    description: 'Плотнее промасленная ткань факела расширяет круг света в крипте.',
    effect: `+${Math.round(UPGRADE_VALUES.LIGHT_PER_LEVEL * 100)}% к радиусу света`,
    maxLevel: 6,
    prices: [50, 100, 170, 270, 390, 550, 750, 950],
  },
  SWIFT_HAND: {
    key: 'SWIFT_HAND',
    name: 'БЫСТРАЯ РУКА',
    description: 'Страж перехватывает факел увереннее: искры срываются с посоха чаще.',
    effect: `−${Math.round(UPGRADE_VALUES.COOLDOWN_PER_LEVEL * 100)}% к перезарядке`,
    maxLevel: 4,
    prices: [70, 160, 290, 470, 650, 900],
  },
  FORTUNE: {
    key: 'FORTUNE',
    name: 'ЩЕДРАЯ ТЬМА',
    description: 'Крипта отдаёт щедрее: каждый спуск приносит больше Эха.',
    effect: `+${Math.round(UPGRADE_VALUES.ECHO_PER_LEVEL * 100)}% к Эху за спуск`,
    maxLevel: 4,
    prices: [60, 140, 260, 430, 600, 850],
  },
};

/**
 * Сколько дополнительных уровней открывает каждая новая локация.
 * Здоровье и мана не растут: у них есть жёсткий потолок.
 */
export const UPGRADE_LOCATION_GROWTH: Record<UpgradeKey, number> = {
  VITALITY: 0,
  MANA_RESERVE: 1,
  BRIGHT_TORCH: 1,
  SWIFT_HAND: 1,
  FORTUNE: 1,
};

/** Порядок карточек в окне улучшений. */
export const UPGRADE_ORDER: UpgradeKey[] = [
  'VITALITY',
  'MANA_RESERVE',
  'BRIGHT_TORCH',
  'SWIFT_HAND',
  'FORTUNE',
];

export type UpgradeLevels = Record<UpgradeKey, number>;

export const DEFAULT_UPGRADES: UpgradeLevels = {
  VITALITY: 0,
  MANA_RESERVE: 0,
  BRIGHT_TORCH: 0,
  SWIFT_HAND: 0,
  FORTUNE: 0,
};

export interface UpgradeBonuses {
  maxHpBonus: number;
  startManaBonus: number;
  /** Множитель радиуса света: 1 — без улучшений. */
  lightMultiplier: number;
  /** Множитель перезарядки: меньше 1 — стреляем чаще. */
  cooldownMultiplier: number;
  /** Множитель Эха за спуск. */
  echoMultiplier: number;
}

export function getUpgradeBonuses(levels: UpgradeLevels): UpgradeBonuses {
  return {
    maxHpBonus: levels.VITALITY * UPGRADE_VALUES.HP_PER_LEVEL,
    startManaBonus: levels.MANA_RESERVE * UPGRADE_VALUES.MANA_PER_LEVEL,
    lightMultiplier: 1 + levels.BRIGHT_TORCH * UPGRADE_VALUES.LIGHT_PER_LEVEL,
    // Нижняя граница — страховка от слишком большого числа уровней.
    cooldownMultiplier: Math.max(
      0.5,
      1 - levels.SWIFT_HAND * UPGRADE_VALUES.COOLDOWN_PER_LEVEL
    ),
    echoMultiplier: 1 + levels.FORTUNE * UPGRADE_VALUES.ECHO_PER_LEVEL,
  };
}

/**
 * Максимум уровня с учётом открытых локаций.
 * Цены задают абсолютный потолок: «мёртвых» уровней без эффекта не будет.
 */
export function getUpgradeMaxLevel(key: UpgradeKey, unlockedLevels: number): number {
  const definition = UPGRADES[key];
  const growth = UPGRADE_LOCATION_GROWTH[key] * Math.max(0, unlockedLevels - 1);
  return Math.min(definition.maxLevel + growth, definition.prices.length);
}

/** Цена следующего уровня или null, если улучшение уже максимальное. */
export function getUpgradeCost(
  key: UpgradeKey,
  level: number,
  unlockedLevels: number
): number | null {
  if (level >= getUpgradeMaxLevel(key, unlockedLevels)) return null;
  return UPGRADES[key].prices[level] ?? null;
}
