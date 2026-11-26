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
  MANA_PER_LEVEL: 15,
  LIGHT_PER_LEVEL: 0.08,
  /** Доля, на которую сокращается перезарядка выстрела. */
  COOLDOWN_PER_LEVEL: 0.08,
  /** Доля, на которую растёт Эхо за спуск. */
  ECHO_PER_LEVEL: 0.1,
} as const;

export const UPGRADES: Record<UpgradeKey, UpgradeDefinition> = {
  VITALITY: {
    key: 'VITALITY',
    name: 'КРЕПКАЯ СТРАЖА',
    description: 'Закалка тела стража: следующий спуск начнётся с большим запасом здоровья.',
    effect: `+${UPGRADE_VALUES.HP_PER_LEVEL} к максимуму здоровья`,
    maxLevel: 4,
    prices: [40, 90, 160, 260],
  },
  MANA_RESERVE: {
    key: 'MANA_RESERVE',
    name: 'РЕЗЕРВ ЭФИРА',
    description: 'Запас эфира в дороге: больше маны уже на старте спуска.',
    effect: `+${UPGRADE_VALUES.MANA_PER_LEVEL} к стартовой мане`,
    maxLevel: 4,
    prices: [40, 90, 160, 260],
  },
  BRIGHT_TORCH: {
    key: 'BRIGHT_TORCH',
    name: 'ЯРКИЙ ФАКЕЛ',
    description: 'Плотнее промасленная ткань факела расширяет круг света в крипте.',
    effect: `+${Math.round(UPGRADE_VALUES.LIGHT_PER_LEVEL * 100)}% к радиусу света`,
    maxLevel: 4,
    prices: [50, 110, 190, 300],
  },
  SWIFT_HAND: {
    key: 'SWIFT_HAND',
    name: 'БЫСТРАЯ РУКА',
    description: 'Страж перехватывает факел увереннее: искры срываются с посоха чаще.',
    effect: `−${Math.round(UPGRADE_VALUES.COOLDOWN_PER_LEVEL * 100)}% к перезарядке`,
    maxLevel: 3,
    prices: [60, 140, 240],
  },
  FORTUNE: {
    key: 'FORTUNE',
    name: 'ЩЕДРАЯ ТЬМА',
    description: 'Крипта отдаёт щедрее: каждый спуск приносит больше Эха.',
    effect: `+${Math.round(UPGRADE_VALUES.ECHO_PER_LEVEL * 100)}% к Эху за спуск`,
    maxLevel: 3,
    prices: [80, 180, 320],
  },
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

/** Цена следующего уровня или null, если улучшение уже максимальное. */
export function getUpgradeCost(key: UpgradeKey, level: number): number | null {
  const definition = UPGRADES[key];
  if (level >= definition.maxLevel) return null;
  return definition.prices[level] ?? null;
}
