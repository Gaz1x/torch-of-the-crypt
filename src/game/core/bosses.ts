import type { EnemyConfig } from './gameConfig';

// ============================================================================
// БОССЫ
// Конфиг финального босса. Поведение (рывок, гашение факела, ярость) живёт
// в GameScene, здесь только числа и внешний вид.
// ============================================================================

export type BossTypeKey = 'FLAME_EATER';

export interface BossConfig extends EnemyConfig {
  /** Урон при обычном касании. */
  contactDamage: number;
  /** Скорость рывка. */
  chargeSpeed: number;
  /** Урон во время рывка. */
  chargeDamage: number;
  /** Радиус света, до которого босс гасит факел. */
  drainRadius: number;
  /** Сколько секунд держится гашение. */
  drainDuration: number;
  /** Пауза между гашениями. */
  drainCooldown: number;
  /** Пауза между рывками. */
  chargeCooldown: number;
  /** Доля HP, после которой босс звереет. */
  enrageThreshold: number;
}

export const BOSS_CONFIG: Record<BossTypeKey, BossConfig> = {
  FLAME_EATER: {
    name: 'Пожиратель Пламени',
    behavior: 'BOSS',
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
    xp: 40,
    contactDamage: 1,
    chargeSpeed: 520,
    chargeDamage: 2,
    drainRadius: 60,
    drainDuration: 3,
    drainCooldown: 9,
    chargeCooldown: 6,
    enrageThreshold: 0.5,
  },
};
