// ============================================================================
// ДАРЫ ЭТАЖА
// Разовый выбор после каждого этажа. Дар живёт только до конца спуска и
// не сохраняется в профиль. Здесь только описания, редкость и жеребьёвка.
// ============================================================================

export type BoonRarity = 'COMMON' | 'RARE' | 'LEGENDARY';

export type BoonKey =
  | 'RAPID_FIRE'
  | 'VITALITY'
  | 'LIGHT_STEP'
  | 'CLEAR_SIGHT'
  | 'QUIET_FLAME'
  | 'WIDE_GATHER'
  | 'DOUBLE_SHOT'
  | 'PIERCE'
  | 'HOT_SHOT'
  | 'SECOND_WIND'
  | 'CRYPT_HEART'
  | 'LAST_SPARK'
  | 'ETERNAL_TORCH';

export interface BoonDefinition {
  key: BoonKey;
  name: string;
  description: string;
  /** Короткая строка «что даёт» для карточки. */
  effect: string;
  rarity: BoonRarity;
}

/** Числовые эффекты даров: держим их в одном месте, а не в коде боя. */
export const BOON_EFFECTS = {
  RAPID_FIRE_COOLDOWN_MULTIPLIER: 0.75,
  LIGHT_STEP_SPEED_MULTIPLIER: 1.1,
  CLEAR_SIGHT_LIGHT_MULTIPLIER: 1.12,
  QUIET_FLAME_REGEN_MULTIPLIER: 1.25,
  WIDE_GATHER_MAGNET_MULTIPLIER: 1.4,
  HOT_SHOT_DAMAGE: 1,
  SECOND_WIND_INVULN_BONUS: 0.6,
  CRYPT_HEART_HP: 2,
  LAST_SPARK_HP: 2,
  ETERNAL_TORCH_MIN_LIGHT: 0.75,
} as const;

/** Чем выше вес, тем чаще редкость выпадает. */
export const BOON_RARITY_WEIGHTS: Record<BoonRarity, number> = {
  COMMON: 5,
  RARE: 3,
  LEGENDARY: 2,
};

export const BOONS: Record<BoonKey, BoonDefinition> = {
  RAPID_FIRE: {
    key: 'RAPID_FIRE',
    name: 'СКОРОЕ ПЛАМЯ',
    description: 'Факел разгорается быстрее: выстрелы вылетают чаще.',
    effect: '−25% к перезарядке выстрела',
    rarity: 'COMMON',
  },
  VITALITY: {
    key: 'VITALITY',
    name: 'СТОЙКОСТЬ',
    description: 'Страж стискивает зубы: запас здоровья растёт до конца спуска.',
    effect: '+1 к максимуму здоровья',
    rarity: 'COMMON',
  },
  LIGHT_STEP: {
    key: 'LIGHT_STEP',
    name: 'ЛЁГКИЙ ШАГ',
    description: 'Доспех становится легче, и страж быстрее уходит от тени.',
    effect: '+10% к скорости движения',
    rarity: 'COMMON',
  },
  CLEAR_SIGHT: {
    key: 'CLEAR_SIGHT',
    name: 'ЯСНЫЙ ВЗГЛЯД',
    description: 'Пламя поднимается выше: круг света становится шире.',
    effect: '+12% к радиусу света',
    rarity: 'COMMON',
  },
  QUIET_FLAME: {
    key: 'QUIET_FLAME',
    name: 'ТИХОЕ ПЛАМЯ',
    description: 'Факел бережёт силы: мана возвращается заметно быстрее.',
    effect: '+25% к восстановлению маны',
    rarity: 'COMMON',
  },
  WIDE_GATHER: {
    key: 'WIDE_GATHER',
    name: 'ШИРОКИЙ СБОР',
    description: 'Кристаллы Эха чувствуют факел с большего расстояния.',
    effect: '+40% к радиусу притяжения',
    rarity: 'COMMON',
  },
  DOUBLE_SHOT: {
    key: 'DOUBLE_SHOT',
    name: 'РАЗДВОЕННЫЙ ЛУЧ',
    description: 'Искра расщепляется: рядом с основным снарядом летит второй.',
    effect: '+1 снаряд под углом',
    rarity: 'RARE',
  },
  PIERCE: {
    key: 'PIERCE',
    name: 'ПРОНЗАЮЩАЯ ИСКРА',
    description: 'Снаряд проходит сквозь первую тень и летит дальше.',
    effect: 'Пробивает одного врага',
    rarity: 'RARE',
  },
  HOT_SHOT: {
    key: 'HOT_SHOT',
    name: 'ЖАРКИЙ УДАР',
    description: 'Искра раскаляется: каждое попадание отнимает больше здоровья.',
    effect: '+1 к урону снаряда',
    rarity: 'RARE',
  },
  SECOND_WIND: {
    key: 'SECOND_WIND',
    name: 'ВТОРОЕ ДЫХАНИЕ',
    description: 'После удара страж приходит в себя быстрее и не ловит второй.',
    effect: '+0.6 с неуязвимости',
    rarity: 'RARE',
  },
  CRYPT_HEART: {
    key: 'CRYPT_HEART',
    name: 'СЕРДЦЕ КРИПТЫ',
    description: 'Тёмное сердце бьётся в груди: запас сил растёт и сразу полон.',
    effect: '+2 к максимуму здоровья · полное лечение',
    rarity: 'LEGENDARY',
  },
  LAST_SPARK: {
    key: 'LAST_SPARK',
    name: 'ПОСЛЕДНЯЯ ИСКРА',
    description: 'Один раз за спуск смертельный удар оставляет тлеющую искру.',
    effect: 'Смертельный удар оставляет 2 HP',
    rarity: 'LEGENDARY',
  },
  ETERNAL_TORCH: {
    key: 'ETERNAL_TORCH',
    name: 'ВЕЧНЫЙ ФАКЕЛ',
    description: 'Даже во тьме факел не отдаёт всё пламя: свет держится дольше.',
    effect: 'Во тьме свет не ниже 75%',
    rarity: 'LEGENDARY',
  },
};

export const BOON_ORDER: BoonKey[] = [
  'RAPID_FIRE',
  'VITALITY',
  'LIGHT_STEP',
  'CLEAR_SIGHT',
  'QUIET_FLAME',
  'WIDE_GATHER',
  'DOUBLE_SHOT',
  'PIERCE',
  'HOT_SHOT',
  'SECOND_WIND',
  'CRYPT_HEART',
  'LAST_SPARK',
  'ETERNAL_TORCH',
];

/** Взвешенный выбор одного дара из пула. */
function pickWeighted(pool: BoonDefinition[]): BoonDefinition {
  const total = pool.reduce((sum, boon) => sum + BOON_RARITY_WEIGHTS[boon.rarity], 0);
  let roll = Math.random() * total;

  for (const boon of pool) {
    roll -= BOON_RARITY_WEIGHTS[boon.rarity];
    if (roll < 0) return boon;
  }

  return pool[pool.length - 1];
}

/** Дары, которых ещё нет в этом спуске, — с учётом редкости и без повторов. */
export function pickBoonChoices(
  taken: ReadonlySet<BoonKey>,
  count = 3
): BoonDefinition[] {
  const pool = BOON_ORDER.filter((key) => !taken.has(key)).map((key) => BOONS[key]);
  const result: BoonDefinition[] = [];

  while (result.length < count && pool.length > 0) {
    const picked = pickWeighted(pool);
    result.push(picked);
    pool.splice(pool.indexOf(picked), 1);
  }

  return result;
}
