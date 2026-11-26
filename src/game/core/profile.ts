// ============================================================================
// ПРОФИЛЬ СТРАЖА
// Постоянный прогресс между спусками: Эхо, статистика и купленные улучшения.
// Хранится в localStorage отдельно от настроек. При повреждённых данных
// профиль безопасно сбрасывается к значениям по умолчанию.
// ============================================================================

import {
  DEFAULT_UPGRADES,
  getUpgradeBonuses,
  getUpgradeCost,
  getUpgradeMaxLevel,
  UPGRADES,
  type UpgradeKey,
  type UpgradeLevels,
} from './upgrades';
import { getMastery } from './mastery';
import { isTrialKey, TRIAL_ORDER, type TrialKey } from './trials';
import { getLevelEchoMultiplier, LEVELS } from './waves';

export type RankLetter = 'B' | 'A' | 'S' | 'SS' | 'SS+' | 'SSS' | 'SSS+';

export interface RankResult {
  letter: RankLetter;
  title: string;
}

/** Минимум данных о забеге, нужный для расчёта ранга. */
export interface RankStats {
  victory: boolean;
  /** Сколько испытаний было включено на старте спуска. */
  trialsCount: number;
}

/** Ранги за победу по числу включённых испытаний. */
export const VICTORY_RANKS = ['S', 'SS', 'SS+', 'SSS', 'SSS+'] as const;

export const RANK_TITLES: Record<RankLetter, string> = {
  B: 'ВЫЖИВШИЙ',
  // A остался только в старых сохранениях: новые забеги его не выдают.
  A: 'СТРАЖ КРИПТЫ',
  S: 'ЛЕГЕНДА ПЛАМЕНИ',
  SS: 'ХРАНИТЕЛЬ ОГНЯ',
  'SS+': 'НЕСУЩИЙ СВЕТ',
  SSS: 'ВЛАДЫКА ГЛУБИН',
  'SSS+': 'ПОСЛЕДНИЙ ФАКЕЛ',
};

export const PROFILE_STORAGE_KEY = 'torch-of-the-crypt:profile:v1';
export const PROFILE_VERSION = 1;

/** Рекорды одной локации: считаются отдельно от общих итогов. */
export interface LevelStats {
  runs: number;
  victories: number;
  bestScore: number;
  bestTime: number;
  bestRank: RankLetter | null;
}

export interface Profile {
  version: number;
  /** Текущее Эхо — валюта улучшений. */
  echo: number;
  /** Сколько Эха набрано за всё время. */
  totalEcho: number;
  /** Сколько спусков завершено. */
  runs: number;
  victories: number;
  bestScore: number;
  bestTime: number;
  bestRank: RankLetter | null;
  upgrades: UpgradeLevels;
  /** Включённые испытания: действуют на следующий спуск и хранятся в профиле. */
  activeTrials: TrialKey[];
  /** Сколько локаций открыто: 1 — только первая. */
  unlockedLevels: number;
  /** Рекорды по каждой локации, индекс совпадает с LEVELS. */
  levelStats: LevelStats[];
}

export const DEFAULT_LEVEL_STATS: LevelStats = {
  runs: 0,
  victories: 0,
  bestScore: 0,
  bestTime: 0,
  bestRank: null,
};

export const DEFAULT_PROFILE: Profile = {
  version: PROFILE_VERSION,
  echo: 0,
  totalEcho: 0,
  runs: 0,
  victories: 0,
  bestScore: 0,
  bestTime: 0,
  bestRank: null,
  upgrades: { ...DEFAULT_UPGRADES },
  activeTrials: [],
  unlockedLevels: 1,
  levelStats: LEVELS.map(() => ({ ...DEFAULT_LEVEL_STATS })),
};

/**
 * Смерть всегда даёт B. Победа поднимает ранг на ступень за каждое
 * включённое испытание: S → SS → SS+ → SSS → SSS+.
 */
export function calculateRank(stats: RankStats): RankResult {
  if (!stats.victory) {
    return { letter: 'B', title: RANK_TITLES.B };
  }

  const index = Math.min(
    VICTORY_RANKS.length - 1,
    Math.max(0, Math.floor(stats.trialsCount))
  );
  const letter = VICTORY_RANKS[index];
  return { letter, title: RANK_TITLES[letter] };
}

const RANK_WEIGHTS: Record<RankLetter, number> = {
  B: 1,
  A: 2,
  S: 3,
  SS: 4,
  'SS+': 5,
  SSS: 6,
  'SSS+': 7,
};

export function rankWeight(letter: RankLetter | null): number {
  return letter === null ? 0 : RANK_WEIGHTS[letter];
}

/**
 * Эхо за спуск: очки / 2 + 20 за каждого убитого босса.
 * Победа приносит полную награду, смерть — половину (с округлением вниз).
 * Множитель складывается из улучшения «Щедрая тьма» и мастерства локации.
 */
export function calculateEcho(
  score: number,
  bossesKilled: number,
  victory: boolean,
  multiplier = 1
): number {
  const base = Math.max(0, score) / 2 + Math.max(0, bossesKilled) * 20;
  const reward = victory ? base : base * 0.5;
  return Math.floor(reward * Math.max(1, multiplier));
}

export interface RunSummary {
  score: number;
  survivalTime: number;
  wave: number;
  victory: boolean;
  bossesKilled: number;
  rank: RankLetter;
  /** Индекс локации, в которой прошёл спуск. */
  levelIndex: number;
}

export interface RunReward {
  profile: Profile;
  echoGained: number;
  /** Общий множитель Эха: «Щедрая тьма» × мастерство × локация. */
  echoMultiplier: number;
  newBestScore: boolean;
  newBestTime: boolean;
  newBestRank: boolean;
}

/** Записывает результат забега в профиль и начисляет Эхо. */
export function applyRun(profile: Profile, run: RunSummary): RunReward {
  // «Щедрая тьма», мастерство и сама локация умножают добычу.
  const bonuses = getUpgradeBonuses(profile.upgrades);
  const levelVictories = profile.levelStats[run.levelIndex]?.victories ?? 0;
  const echoMultiplier =
    bonuses.echoMultiplier *
    getMastery(levelVictories).echoMultiplier *
    getLevelEchoMultiplier(run.levelIndex);
  const echoGained = calculateEcho(run.score, run.bossesKilled, run.victory, echoMultiplier);
  const newBestScore = run.score > profile.bestScore;
  const newBestTime = run.survivalTime > profile.bestTime;
  const newBestRank = rankWeight(run.rank) > rankWeight(profile.bestRank);

  const nextLevelStats = profile.levelStats.map((stats, index) => {
    if (index !== run.levelIndex) return stats;
    return {
      runs: stats.runs + 1,
      victories: stats.victories + (run.victory ? 1 : 0),
      bestScore: Math.max(stats.bestScore, run.score),
      bestTime: Math.max(stats.bestTime, run.survivalTime),
      bestRank: rankWeight(run.rank) > rankWeight(stats.bestRank) ? run.rank : stats.bestRank,
    };
  });

  const next: Profile = {
    ...profile,
    echo: profile.echo + echoGained,
    totalEcho: profile.totalEcho + echoGained,
    runs: profile.runs + 1,
    victories: profile.victories + (run.victory ? 1 : 0),
    bestScore: Math.max(profile.bestScore, run.score),
    bestTime: Math.max(profile.bestTime, run.survivalTime),
    bestRank: newBestRank ? run.rank : profile.bestRank,
    // Победа открывает следующую локацию (не больше, чем их всего).
    unlockedLevels: Math.min(
      LEVELS.length,
      run.victory
        ? Math.max(profile.unlockedLevels, run.levelIndex + 2)
        : profile.unlockedLevels
    ),
    levelStats: nextLevelStats,
  };

  return { profile: next, echoGained, echoMultiplier, newBestScore, newBestTime, newBestRank };
}

export interface UpgradePurchase {
  ok: boolean;
  profile: Profile;
  message: string;
}

/** Покупка одного уровня улучшения. При нехватке Эха профиль не меняется. */
export function purchaseUpgrade(profile: Profile, key: UpgradeKey): UpgradePurchase {
  const definition = UPGRADES[key];
  const level = profile.upgrades[key];
  const cost = getUpgradeCost(key, level, profile.unlockedLevels);

  if (cost === null) {
    return { ok: false, profile, message: 'Улучшение уже максимальное' };
  }

  if (profile.echo < cost) {
    return {
      ok: false,
      profile,
      message: `Не хватает ${cost - profile.echo} Эха`,
    };
  }

  const next: Profile = {
    ...profile,
    echo: profile.echo - cost,
    upgrades: { ...profile.upgrades, [key]: level + 1 },
  };

  return {
    ok: true,
    profile: next,
    message: `${definition.name} · уровень ${level + 1}`,
  };
}

function toSafeInt(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

const RANK_LETTERS: RankLetter[] = ['B', 'A', 'S', 'SS', 'SS+', 'SSS', 'SSS+'];

function sanitizeRank(value: unknown): RankLetter | null {
  return typeof value === 'string' && (RANK_LETTERS as string[]).includes(value)
    ? (value as RankLetter)
    : null;
}

function sanitizeUpgrades(raw: unknown, unlockedLevels: number): UpgradeLevels {
  const data = typeof raw === 'object' && raw !== null
    ? (raw as Partial<Record<UpgradeKey, unknown>>)
    : {};

  const result: UpgradeLevels = { ...DEFAULT_UPGRADES };
  for (const key of Object.keys(DEFAULT_UPGRADES) as UpgradeKey[]) {
    const level = toSafeInt(data[key]);
    result[key] = Math.min(getUpgradeMaxLevel(key, unlockedLevels), level);
  }
  return result;
}

function sanitizeTrials(raw: unknown): TrialKey[] {
  if (!Array.isArray(raw)) return [];

  const enabled = new Set<TrialKey>();
  for (const value of raw) {
    if (isTrialKey(value)) enabled.add(value);
  }

  // Порядок карточек не зависит от порядка в сохранении.
  return TRIAL_ORDER.filter((key) => enabled.has(key));
}

function sanitizeLevelStats(raw: unknown): LevelStats[] {
  const data = Array.isArray(raw) ? raw : [];
  return LEVELS.map((_, index) => {
    const entry = data[index];
    const stats = typeof entry === 'object' && entry !== null
      ? (entry as Partial<Record<keyof LevelStats, unknown>>)
      : {};
    return {
      runs: toSafeInt(stats.runs),
      victories: toSafeInt(stats.victories),
      bestScore: toSafeInt(stats.bestScore),
      bestTime: typeof stats.bestTime === 'number' && Number.isFinite(stats.bestTime)
        ? Math.max(0, stats.bestTime)
        : 0,
      bestRank: sanitizeRank(stats.bestRank),
    };
  });
}

function emptyProfile(): Profile {
  return {
    ...DEFAULT_PROFILE,
    upgrades: { ...DEFAULT_UPGRADES },
    activeTrials: [],
    levelStats: DEFAULT_PROFILE.levelStats.map((stats) => ({ ...stats })),
  };
}

function sanitizeProfile(raw: unknown): Profile {
  if (typeof raw !== 'object' || raw === null) return emptyProfile();

  const data = raw as Partial<Record<keyof Profile, unknown>>;
  const unlockedLevels = Math.min(
    LEVELS.length,
    Math.max(1, toSafeInt(data.unlockedLevels, 1))
  );
  return {
    version: PROFILE_VERSION,
    echo: toSafeInt(data.echo),
    totalEcho: toSafeInt(data.totalEcho),
    runs: toSafeInt(data.runs),
    victories: toSafeInt(data.victories),
    bestScore: toSafeInt(data.bestScore),
    bestTime: typeof data.bestTime === 'number' && Number.isFinite(data.bestTime)
      ? Math.max(0, data.bestTime)
      : 0,
    bestRank: sanitizeRank(data.bestRank),
    upgrades: sanitizeUpgrades(data.upgrades, unlockedLevels),
    activeTrials: sanitizeTrials(data.activeTrials),
    unlockedLevels,
    levelStats: sanitizeLevelStats(data.levelStats),
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return emptyProfile();
    return sanitizeProfile(JSON.parse(raw));
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Приватный режим или переполнение хранилища — прогресс просто не сохранится.
  }
}
