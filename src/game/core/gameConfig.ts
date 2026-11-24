// ============================================================================
// КОНФИГУРАЦИЯ ИГРЫ (Все константы для легкого масштабирования и баланса)
// ============================================================================

export type EnemyTypeKey = 'SWARMER' | 'STALKER' | 'BRUTE' | 'SPITTER' | 'BOMBER';

/** Как враг ведёт себя в бою. Логика поведения живёт в GameScene. */
export type EnemyBehavior = 'CHASER' | 'RANGED' | 'EXPLODER' | 'BOSS';

export interface EnemyConfig {
  name: string;
  behavior: EnemyBehavior;
  hp: number;
  speed: number;
  lightSlowFactor: number;
  radius: number;
  bodyColor: number;
  strokeColor: number;
  lightStrokeColor: number;
  eyeColor: number;
  scoreValue: number;
  manaDrop: number;
  /** Дальность стрельбы (только для RANGED). */
  attackRange?: number;
  /** Пауза между выстрелами в секундах (только для RANGED). */
  attackCooldown?: number;
  /** Скорость снаряда врага (только для RANGED). */
  projectileSpeed?: number;
  /** Радиус взрыва (только для EXPLODER). */
  explosionRadius?: number;
  /** Длительность фитиля перед взрывом (только для EXPLODER). */
  explosionWindup?: number;
}

export const GAME_CONFIG = {
  WORLD: {
    WIDTH: 1280,
    HEIGHT: 720,
    PADDING: 40,
  },
  PLAYER: {
    SPEED: 230,
    MAX_HP: 4,
    RADIUS: 16,
    START_X: 640,
    START_Y: 360,
    /** Сколько секунд игрок не получает урон после попадания. */
    INVULN_DURATION: 1,
  },
  LIGHT: {
    // Радиус света зависит от фазы — см. core/phases.ts
    DARKNESS_ALPHA: 0.95,
    DARKNESS_COLOR: 0x03060c,
    AMBIENT_COLOR: 0xff8800,
    AMBIENT_ALPHA: 0.14,
  },
  COMBAT: {
    FIRE_COOLDOWN: 0.42,
    PROJECTILE_SPEED: 600,
    PROJECTILE_LIFE: 1.4,
    PROJECTILE_RADIUS: 6,
    PROJECTILE_DAMAGE: 1,
    START_MANA: 60,
    MAX_MANA: 100,
    SHOT_MANA_COST: 15,
    PASSIVE_MANA_REGEN: 4,
    /** Пауза между касаниями одного врага, чтобы он не бил каждый кадр. */
    MELEE_CONTACT_COOLDOWN: 1.2,
    /** Слабый автоприцел на телефоне: конус доводки (радианы). */
    TOUCH_AIM_ASSIST_ANGLE: 0.17,
    /** Доля угла, на которую снаряд дотягивается к врагу внутри конуса. */
    TOUCH_AIM_ASSIST_STRENGTH: 0.6,
  },
  MANA_ORB: {
    MAGNET_RADIUS: 150,
    PICKUP_RADIUS: 26,
    MAGNET_SPEED: 360,
    LIFETIME: 12,
  },
  ENEMIES: {
    SWARMER: {
      name: 'Роевик',
      behavior: 'CHASER',
      hp: 1,
      speed: 190,
      lightSlowFactor: 0.48,
      radius: 10,
      bodyColor: 0x1a103c,
      strokeColor: 0x9333ea,
      lightStrokeColor: 0x38bdf8,
      eyeColor: 0xf43f5e,
      scoreValue: 1,
      manaDrop: 15,
    },
    STALKER: {
      name: 'Сталкер',
      behavior: 'CHASER',
      hp: 1,
      speed: 140,
      lightSlowFactor: 0.4,
      radius: 15,
      bodyColor: 0x090d16,
      strokeColor: 0x4c1d95,
      lightStrokeColor: 0x60a5fa,
      eyeColor: 0xef4444,
      scoreValue: 2,
      manaDrop: 22,
    },
    BRUTE: {
      name: 'Теневой Брут',
      behavior: 'CHASER',
      hp: 3,
      speed: 85,
      lightSlowFactor: 0.55,
      radius: 23,
      bodyColor: 0x0f172a,
      strokeColor: 0xb91c1c,
      lightStrokeColor: 0xfbbf24,
      eyeColor: 0xf97316,
      scoreValue: 5,
      manaDrop: 40,
    },
    SPITTER: {
      name: 'Плевун',
      behavior: 'RANGED',
      hp: 2,
      speed: 100,
      lightSlowFactor: 0.5,
      radius: 14,
      bodyColor: 0x1e1b4b,
      strokeColor: 0x7c3aed,
      lightStrokeColor: 0x60a5fa,
      eyeColor: 0xc084fc,
      scoreValue: 3,
      manaDrop: 18,
      attackRange: 330,
      attackCooldown: 2.2,
      projectileSpeed: 240,
    },
    BOMBER: {
      name: 'Мученик',
      behavior: 'EXPLODER',
      hp: 2,
      speed: 130,
      lightSlowFactor: 0.55,
      radius: 16,
      bodyColor: 0x3f1d1d,
      strokeColor: 0xdc2626,
      lightStrokeColor: 0xfbbf24,
      eyeColor: 0xf97316,
      scoreValue: 2,
      manaDrop: 20,
      explosionRadius: 120,
      explosionWindup: 0.85,
    },
  } as Record<EnemyTypeKey, EnemyConfig>,
} as const;
