// ============================================================================
// ДАРЫ ЭТАЖА
// Разовый выбор после каждого этажа. Дар живёт только до конца спуска и
// не сохраняется в профиль. Здесь только описания и жеребьёвка.
// ============================================================================

export type BoonKey = 'RAPID_FIRE' | 'DOUBLE_SHOT' | 'PIERCE' | 'VITALITY';

export interface BoonDefinition {
  key: BoonKey;
  name: string;
  description: string;
  /** Короткая строка «что даёт» для карточки. */
  effect: string;
}

export const BOONS: Record<BoonKey, BoonDefinition> = {
  RAPID_FIRE: {
    key: 'RAPID_FIRE',
    name: 'СКОРОЕ ПЛАМЯ',
    description: 'Факел разгорается быстрее: выстрелы вылетают чаще.',
    effect: '−25% к перезарядке выстрела',
  },
  DOUBLE_SHOT: {
    key: 'DOUBLE_SHOT',
    name: 'РАЗДВОЕННЫЙ ЛУЧ',
    description: 'Искра расщепляется: рядом с основным снарядом летит второй.',
    effect: '+1 снаряд под углом',
  },
  PIERCE: {
    key: 'PIERCE',
    name: 'ПРОНЗАЮЩАЯ ИСКРА',
    description: 'Снаряд проходит сквозь первую тень и летит дальше.',
    effect: 'Пробивает одного врага',
  },
  VITALITY: {
    key: 'VITALITY',
    name: 'СТОЙКОСТЬ',
    description: 'Страж стискивает зубы: запас здоровья растёт до конца спуска.',
    effect: '+1 к максимуму здоровья',
  },
};

export const BOON_ORDER: BoonKey[] = ['RAPID_FIRE', 'DOUBLE_SHOT', 'PIERCE', 'VITALITY'];

/** Тройка даров, которых ещё нет в этом спуске. */
export function pickBoonChoices(
  taken: ReadonlySet<BoonKey>,
  count = 3
): BoonDefinition[] {
  const pool = BOON_ORDER.filter((key) => !taken.has(key)).map((key) => BOONS[key]);

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = pool[i];
    pool[i] = pool[j];
    pool[j] = swap;
  }

  return pool.slice(0, count);
}
