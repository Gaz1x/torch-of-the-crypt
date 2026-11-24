import type { EnemyConfig, EnemyTypeKey } from './gameConfig';

// ============================================================================
// БОССЫ
// Конфиг боссов: числа и внешний вид. Поведение (рывок, залпы, призыв,
// ярость) живёт в GameScene и выбирается по полю mechanic.
// ============================================================================

export type BossTypeKey = 'FLAME_EATER' | 'PALE_WARDEN' | 'ROT_MOTHER';

/** Какой набор атак использует босс. */
export type BossMechanic = 'CHARGER' | 'SHOOTER' | 'SUMMONER';

export interface BossConfig extends EnemyConfig {
  mechanic: BossMechanic;
  /** Урон при обычном касании. */
  contactDamage: number;
  /** Доля HP, после которой босс звереет. */
  enrageThreshold: number;

  // --- CHARGER: рывок и гашение факела ---
  /** Скорость рывка. */
  chargeSpeed?: number;
  /** Урон во время рывка. */
  chargeDamage?: number;
  /** Радиус света, до которого босс гасит факел. */
  drainRadius?: number;
  /** Сколько секунд держится гашение. */
  drainDuration?: number;
  /** Пауза между гашениями. */
  drainCooldown?: number;
  /** Пауза между рывками. */
  chargeCooldown?: number;

  // --- SHOOTER: залпы веером ---
  /** Пауза между залпами. */
  shotCooldown?: number;
  /** Сколько снарядов в залпе. */
  shotCount?: number;
  /** Полный угол веера в радианах. */
  shotSpread?: number;
  /** Скорость снарядов босса. */
  shotSpeed?: number;

  // --- SUMMONER: призыв свиты ---
  /** Пауза между призывами. */
  summonInterval?: number;
  /** Сколько мобов появляется за один призыв. */
  summonCount?: number;
  /** Кого именно призывает босс. */
  summonType?: EnemyTypeKey;
}

export const BOSS_CONFIG: Record<BossTypeKey, BossConfig> = {
  FLAME_EATER: {
    name: 'Пожиратель Пламени',
    behavior: 'BOSS',
    mechanic: 'CHARGER',
    hp: 48,
    speed: 58,
    lightSlowFactor: 0.7,
    radius: 42,
    bodyColor: 0x1c0a0a,
    strokeColor: 0xb91c1c,
    lightStrokeColor: 0xfbbf24,
    eyeColor: 0xf97316,
    scoreValue: 60,
    manaDrop: 70,
    contactDamage: 1,
    chargeSpeed: 520,
    chargeDamage: 2,
    drainRadius: 60,
    drainDuration: 3,
    drainCooldown: 9,
    chargeCooldown: 6,
    enrageThreshold: 0.5,
  },
  PALE_WARDEN: {
    name: 'Бледный Часовой',
    behavior: 'BOSS',
    mechanic: 'SHOOTER',
    hp: 42,
    speed: 52,
    lightSlowFactor: 0.7,
    radius: 38,
    bodyColor: 0x0b1420,
    strokeColor: 0x64748b,
    lightStrokeColor: 0xbfdbfe,
    eyeColor: 0x7dd3fc,
    scoreValue: 80,
    manaDrop: 90,
    contactDamage: 1,
    shotCooldown: 2.6,
    shotCount: 5,
    shotSpread: 0.6,
    shotSpeed: 250,
    enrageThreshold: 0.5,
  },
  ROT_MOTHER: {
    name: 'Мать Роя',
    behavior: 'BOSS',
    mechanic: 'SUMMONER',
    hp: 60,
    speed: 46,
    lightSlowFactor: 0.7,
    radius: 44,
    bodyColor: 0x0a1a0f,
    strokeColor: 0x4d7c0f,
    lightStrokeColor: 0xa3e635,
    eyeColor: 0xd9f99d,
    scoreValue: 100,
    manaDrop: 110,
    contactDamage: 1,
    summonInterval: 6,
    summonCount: 2,
    summonType: 'HOUND',
    enrageThreshold: 0.55,
  },
};
