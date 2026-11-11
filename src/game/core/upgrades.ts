// ============================================================================
// УЛУЧШЕНИЯ ЛАГЕРЯ
// Постоянные бонусы покупаются за Эхо между спусками. Здесь только описания,
// цены и расчёт бонусов — покупку и сохранение делает core/profile.ts.
// ============================================================================

export type UpgradeKey = 'VITALITY' | 'MANA_RESERVE' | 'BRIGHT_TORCH';

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
} as const;

export const UPGRADES: Record<UpgradeKey, UpgradeDefinition> = {
  VITALITY: {
    key: 'VITALITY',
    name: 'КРЕПКАЯ СТРАЖА',
    description: 'Закалка тела стража: следующий спуск начнётся с большим запасом здоровья.',
    effect: `+${UPGRADE_VALUES.HP_PER_LEVEL} к максимуму здоровья`,
    maxLevel: 2,
    prices: [40, 90],
  },
  MANA_RESERVE: {
    key: 'MANA_RESERVE',
    name: 'РЕЗЕРВ ЭФИРА',
    description: 'Запас эфира в дороге: больше маны уже на старте спуска.',
    effect: `+${UPGRADE_VALUES.MANA_PER_LEVEL} к стартовой мане`,
    maxLevel: 2,
    prices: [40, 90],
  },
  BRIGHT_TORCH: {
    key: 'BRIGHT_TORCH',
    name: 'ЯРКИЙ ФАКЕЛ',
    description: 'Плотнее промасленная ткань факела расширяет круг света в крипте.',
    effect: `+${Math.round(UPGRADE_VALUES.LIGHT_PER_LEVEL * 100)}% к радиусу света`,
    maxLevel: 2,
    prices: [50, 100],
  },
};

/** Порядок карточек в окне улучшений. */
export const UPGRADE_ORDER: UpgradeKey[] = ['VITALITY', 'MANA_RESERVE', 'BRIGHT_TORCH'];

export type UpgradeLevels = Record<UpgradeKey, number>;

export const DEFAULT_UPGRADES: UpgradeLevels = {
  VITALITY: 0,
  MANA_RESERVE: 0,
  BRIGHT_TORCH: 0,
};

export interface UpgradeBonuses {
  maxHpBonus: number;
  startManaBonus: number;
  /** Множитель радиуса света: 1 — без улучшений. */
  lightMultiplier: number;
}

export function getUpgradeBonuses(levels: UpgradeLevels): UpgradeBonuses {
  return {
    maxHpBonus: levels.VITALITY * UPGRADE_VALUES.HP_PER_LEVEL,
    startManaBonus: levels.MANA_RESERVE * UPGRADE_VALUES.MANA_PER_LEVEL,
    lightMultiplier: 1 + levels.BRIGHT_TORCH * UPGRADE_VALUES.LIGHT_PER_LEVEL,
  };
}

/** Цена следующего уровня или null, если улучшение уже максимальное. */
export function getUpgradeCost(key: UpgradeKey, level: number): number | null {
  const definition = UPGRADES[key];
  if (level >= definition.maxLevel) return null;
  return definition.prices[level] ?? null;
}
