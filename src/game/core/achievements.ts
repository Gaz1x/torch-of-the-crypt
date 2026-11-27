import type { Profile, RankLetter } from './profile';
import { getMastery } from './mastery';
import { getUpgradeMaxLevel, UPGRADE_ORDER } from './upgrades';
import { BESTIARY_ENTRIES, countDiscovered } from './bestiary';

// ============================================================================
// ДОСТИЖЕНИЯ
// Пятнадцать постоянных целей. Проверка идёт по профилю целиком, поэтому
// достижения можно досчитать и для старых сохранений. Награда — только
// косметика: облики открываются по числу достижений (см. cosmetics.ts).
// ============================================================================

export type AchievementId =
  | 'FIRST_RUN'
  | 'FIRST_WIN'
  | 'RUNS_10'
  | 'RUNS_25'
  | 'WINS_5'
  | 'WINS_15'
  | 'CLEAR_II'
  | 'CLEAR_III'
  | 'MASTERY_1'
  | 'MASTERY_2'
  | 'MASTERY_3'
  | 'RANK_SS'
  | 'RANK_SSS_PLUS'
  | 'BESTIARY_ALL'
  | 'ALL_UPGRADES';

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
  check: (profile: Profile) => boolean;
}

/** Порядок рангов для сравнения: A остался только в старых сохранениях. */
const RANK_ORDER: RankLetter[] = ['B', 'A', 'S', 'SS', 'SS+', 'SSS', 'SSS+'];

function rankAtLeast(letter: RankLetter | null, target: RankLetter): boolean {
  if (letter === null) return false;
  return RANK_ORDER.indexOf(letter) >= RANK_ORDER.indexOf(target);
}

function anyMasteryTier(profile: Profile, tier: number): boolean {
  return profile.levelStats.some((stats) => getMastery(stats.victories).tier >= tier);
}

function allUpgradesMaxed(profile: Profile): boolean {
  return UPGRADE_ORDER.every(
    (key) =>
      profile.upgrades[key] >= getUpgradeMaxLevel(key, profile.unlockedLevels)
  );
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'FIRST_RUN',
    name: 'ПЕРВЫЙ ШАГ',
    description: 'Завершить первый спуск.',
    check: (profile) => profile.runs >= 1,
  },
  {
    id: 'FIRST_WIN',
    name: 'ОГОНЬ НЕ ПОГАС',
    description: 'Вернуться из крипты с победой.',
    check: (profile) => profile.victories >= 1,
  },
  {
    id: 'RUNS_10',
    name: 'ПРИВЫЧКА К ТЬМЕ',
    description: 'Завершить 10 спусков.',
    check: (profile) => profile.runs >= 10,
  },
  {
    id: 'RUNS_25',
    name: 'ДОРОГА ВНИЗ',
    description: 'Завершить 25 спусков.',
    check: (profile) => profile.runs >= 25,
  },
  {
    id: 'WINS_5',
    name: 'ПЯТЬ РАССВЕТОВ',
    description: 'Победить 5 раз.',
    check: (profile) => profile.victories >= 5,
  },
  {
    id: 'WINS_15',
    name: 'ХОЗЯИН КРИПТЫ',
    description: 'Победить 15 раз.',
    check: (profile) => profile.victories >= 15,
  },
  {
    id: 'CLEAR_II',
    name: 'КОСТИ И ПЫЛЬ',
    description: 'Очистить «Костяные катакомбы».',
    check: (profile) => (profile.levelStats[1]?.victories ?? 0) >= 1,
  },
  {
    id: 'CLEAR_III',
    name: 'МЁРТВЫЙ УЛЕЙ',
    description: 'Очистить «Мёртвый улей».',
    check: (profile) => (profile.levelStats[2]?.victories ?? 0) >= 1,
  },
  {
    id: 'MASTERY_1',
    name: 'ЗНАКОМЫЙ СВЕТ',
    description: 'Победить 3 раза в одной локации.',
    check: (profile) => anyMasteryTier(profile, 1),
  },
  {
    id: 'MASTERY_2',
    name: 'ХОЗЯИН ГЛУБИН',
    description: 'Победить 6 раз в одной локации.',
    check: (profile) => anyMasteryTier(profile, 2),
  },
  {
    id: 'MASTERY_3',
    name: 'СВОЙ В КРИПТЕ',
    description: 'Победить 10 раз в одной локации.',
    check: (profile) => anyMasteryTier(profile, 3),
  },
  {
    id: 'RANK_SS',
    name: 'НЕСУЩИЙ СВЕТ',
    description: 'Получить ранг SS или выше.',
    check: (profile) => rankAtLeast(profile.bestRank, 'SS'),
  },
  {
    id: 'RANK_SSS_PLUS',
    name: 'ПОСЛЕДНИЙ ФАКЕЛ',
    description: 'Получить ранг SSS+.',
    check: (profile) => rankAtLeast(profile.bestRank, 'SSS+'),
  },
  {
    id: 'BESTIARY_ALL',
    name: 'ВСЕ ТЕНИ В ЛИЦО',
    description: 'Открыть всех врагов и боссов.',
    check: (profile) => countDiscovered(profile.bestiary) >= BESTIARY_ENTRIES.length,
  },
  {
    id: 'ALL_UPGRADES',
    name: 'ПОЛНАЯ ЗАКАЛКА',
    description: 'Прокачать все улучшения до максимума.',
    check: allUpgradesMaxed,
  },
];

export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((achievement) => achievement.id);

const ACHIEVEMENT_ID_SET = new Set<string>(ACHIEVEMENT_IDS);

export function isAchievementId(value: unknown): value is AchievementId {
  return typeof value === 'string' && ACHIEVEMENT_ID_SET.has(value);
}

export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}

/** Возвращает достижения, которые выполнены, но ещё не записаны в профиль. */
export function evaluateAchievements(profile: Profile): AchievementId[] {
  const unlocked = new Set(profile.achievements);
  return ACHIEVEMENTS.filter(
    (achievement) => !unlocked.has(achievement.id) && achievement.check(profile)
  ).map((achievement) => achievement.id);
}

export function countUnlocked(profile: Profile): number {
  return ACHIEVEMENTS.filter((achievement) =>
    profile.achievements.includes(achievement.id)
  ).length;
}
