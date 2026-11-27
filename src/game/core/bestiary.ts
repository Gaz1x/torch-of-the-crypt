import { GAME_CONFIG, type EnemyTypeKey } from './gameConfig';
import { BOSS_CONFIG, type BossTypeKey } from './bosses';

// ============================================================================
// БЕСТИАРИЙ
// Список всех врагов и боссов для «Книги стража». Счётчики убийств лежат
// в профиле, а подписи и роли — здесь, чтобы UI не знал деталей конфигов.
// ============================================================================

export type BestiaryKey = EnemyTypeKey | BossTypeKey;

export type BestiaryKind = 'enemy' | 'elite' | 'boss';

export interface BestiaryEntry {
  key: BestiaryKey;
  name: string;
  role: string;
  kind: BestiaryKind;
}

const ENEMY_ROLES: Record<EnemyTypeKey, string> = {
  SWARMER: 'Рвётся вперёд роем',
  STALKER: 'Крадётся и ждёт',
  BRUTE: 'Медленный, но живучий',
  SPITTER: 'Плюётся издалека',
  BOMBER: 'Подходит и взрывается',
  HOUND: 'Быстрая и злая',
  WATCHER: 'Стреляет из темноты',
  ELITE_STALKER: 'Быстрый и упрямый',
  ELITE_BRUTE: 'Костяная гора',
  ELITE_BOMBER: 'Взрыв по площади',
};

const BOSS_ROLES: Record<BossTypeKey, string> = {
  FLAME_EATER: 'Гасит факел и бьёт рывком',
  PALE_WARDEN: 'Держит дистанцию, бьёт веером',
  ROT_MOTHER: 'Зовёт свиту из трещин',
};

export const BESTIARY_ENTRIES: BestiaryEntry[] = [
  ...(Object.keys(GAME_CONFIG.ENEMIES) as EnemyTypeKey[]).map((key) => {
    const config = GAME_CONFIG.ENEMIES[key];
    return {
      key,
      name: config.name,
      role: ENEMY_ROLES[key],
      kind: config.elite ? 'elite' : 'enemy',
    } as BestiaryEntry;
  }),
  ...(Object.keys(BOSS_CONFIG) as BossTypeKey[]).map((key) => ({
    key,
    name: BOSS_CONFIG[key].name,
    role: BOSS_ROLES[key],
    kind: 'boss' as const,
  })),
];

export const BESTIARY_KEYS = BESTIARY_ENTRIES.map((entry) => entry.key);

export function getBestiaryEntry(key: BestiaryKey): BestiaryEntry | undefined {
  return BESTIARY_ENTRIES.find((entry) => entry.key === key);
}

/** Сколько записей открыто: враг считается открытым после первого убийства. */
export function countDiscovered(bestiary: Record<string, number>): number {
  return BESTIARY_ENTRIES.filter((entry) => (bestiary[entry.key] ?? 0) > 0).length;
}
