import { TRIAL_ORDER, type TrialKey } from './trials';
import { LEVELS } from './waves';

// ============================================================================
// СПУСК ДНЯ
// Одна попытка в день: локация и набор испытаний выбираются из даты, поэтому
// у всех игроков в один день одинаковый спуск. Награда — повышенное Эхо.
// ============================================================================

/** Сколько Эха сверх обычного приносит ежедневный спуск. */
export const DAILY_ECHO_BONUS = 1.5;

/** Сколько испытаний включает ежедневный набор. */
const DAILY_TRIAL_COUNT = 2;

export interface DailyRun {
  /** Локальная дата YYYY-MM-DD: попытка обновляется в полночь. */
  key: string;
  levelIndex: number;
  trials: TrialKey[];
  echoBonus: number;
}

/** Локальная дата, а не UTC: игроку важен его собственный день. */
export function getDailyKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Короткий хеш строки: дата превращается в стабильное число. */
function hashKey(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Детерминированный генератор (mulberry32): одинаковый день — одинаковый спуск. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ежедневный спуск: локация из уже открытых и два разных испытания.
 * Пока открыта только первая локация, спуск всё равно доступен.
 */
export function getDailyRun(key: string, unlockedLevels: number): DailyRun {
  const random = createRandom(hashKey(key));

  const levelCount = Math.max(1, Math.min(unlockedLevels, LEVELS.length));
  const levelIndex = Math.floor(random() * levelCount);

  const pool = [...TRIAL_ORDER];
  const picked: TrialKey[] = [];
  for (let i = 0; i < Math.min(DAILY_TRIAL_COUNT, pool.length); i++) {
    const index = Math.floor(random() * pool.length);
    picked.push(pool[index]);
    pool.splice(index, 1);
  }

  return {
    key,
    levelIndex,
    // Порядок фиксирован, чтобы профиль и интерфейс не зависели от случайности.
    trials: TRIAL_ORDER.filter((trial) => picked.includes(trial)),
    echoBonus: DAILY_ECHO_BONUS,
  };
}

/** «2026-11-27» → «27.11.2026» для интерфейса. */
export function formatDailyKey(key: string): string {
  const [year, month, day] = key.split('-');
  if (!year || !month || !day) return key;
  return `${day}.${month}.${year}`;
}
