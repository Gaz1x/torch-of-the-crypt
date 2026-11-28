// ============================================================================
// КОНФИГУРАЦИЯ ИГРЫ (Все константы для легкого масштабирования и баланса)
// ============================================================================

export type EnemyTypeKey =
  | 'SWARMER'
  | 'STALKER'
  | 'BRUTE'
  | 'SPITTER'
  | 'BOMBER'
  | 'HOUND'
  | 'WATCHER'
  | 'DROWNED'
  | 'ASH_PRIEST'
  | 'ELITE_STALKER'
  | 'ELITE_BRUTE'
  | 'ELITE_BOMBER';

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
  /** Усиленная версия обычного врага: яркая обводка и ореол. */
  elite?: boolean;
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
    TOUCH_AIM_ASSIST_ANGLE: 0.1,
    /** Доля угла, на которую снаряд дотягивается к врагу внутри конуса. */
    TOUCH_AIM_ASSIST_STRENGTH: 0.3,
    /** Дальше этого расстояния автоприцел не ищет цели (пиксели). */
    TOUCH_AIM_ASSIST_RANGE: 420,
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

    // --- Новые типы второй и третьей локаций ---
    HOUND: {
      name: 'Пепельная гончая',
      behavior: 'CHASER',
      hp: 1,
      speed: 235,
      lightSlowFactor: 0.5,
      radius: 11,
      bodyColor: 0x1f0a12,
      strokeColor: 0xf43f5e,
      lightStrokeColor: 0xfda4af,
      eyeColor: 0xfde68a,
      scoreValue: 2,
      manaDrop: 16,
    },
    WATCHER: {
      name: 'Молчаливый страж',
      behavior: 'RANGED',
      hp: 2,
      speed: 95,
      lightSlowFactor: 0.5,
      radius: 15,
      bodyColor: 0x0b1a1a,
      strokeColor: 0x0d9488,
      lightStrokeColor: 0x5eead4,
      eyeColor: 0x99f6e4,
      scoreValue: 4,
      manaDrop: 24,
      attackRange: 380,
      attackCooldown: 2.6,
      projectileSpeed: 280,
    },

    // --- Новые типы четвёртой и пятой локаций ---
    DROWNED: {
      name: 'Утопленник',
      behavior: 'CHASER',
      hp: 4,
      speed: 105,
      lightSlowFactor: 0.45,
      radius: 19,
      bodyColor: 0x08202a,
      strokeColor: 0x0e7490,
      lightStrokeColor: 0x67e8f9,
      eyeColor: 0xa5f3fc,
      scoreValue: 7,
      manaDrop: 32,
    },
    ASH_PRIEST: {
      name: 'Пепельный жрец',
      behavior: 'RANGED',
      hp: 3,
      speed: 105,
      lightSlowFactor: 0.5,
      radius: 16,
      bodyColor: 0x1c1008,
      strokeColor: 0xb45309,
      lightStrokeColor: 0xfcd34d,
      eyeColor: 0xfde68a,
      scoreValue: 7,
      manaDrop: 30,
      attackRange: 360,
      attackCooldown: 2,
      projectileSpeed: 300,
    },

    // --- Элитные версии: тот же силуэт, другие статы и палитра ---
    ELITE_STALKER: {
      name: 'Элитный сталкер',
      behavior: 'CHASER',
      hp: 3,
      speed: 170,
      lightSlowFactor: 0.42,
      radius: 17,
      bodyColor: 0x1a103c,
      strokeColor: 0xf59e0b,
      lightStrokeColor: 0xfbbf24,
      eyeColor: 0xfef08a,
      scoreValue: 5,
      manaDrop: 30,
      elite: true,
    },
    ELITE_BRUTE: {
      name: 'Костяной брут',
      behavior: 'CHASER',
      hp: 6,
      speed: 95,
      lightSlowFactor: 0.55,
      radius: 26,
      bodyColor: 0x1c0f0f,
      strokeColor: 0xf97316,
      lightStrokeColor: 0xfbbf24,
      eyeColor: 0xfde68a,
      scoreValue: 10,
      manaDrop: 60,
      elite: true,
    },
    ELITE_BOMBER: {
      name: 'Гнилой мученик',
      behavior: 'EXPLODER',
      hp: 4,
      speed: 150,
      lightSlowFactor: 0.55,
      radius: 18,
      bodyColor: 0x33130a,
      strokeColor: 0xfb923c,
      lightStrokeColor: 0xfde68a,
      eyeColor: 0xfef3c7,
      scoreValue: 6,
      manaDrop: 35,
      explosionRadius: 150,
      explosionWindup: 0.7,
      elite: true,
    },
  } as Record<EnemyTypeKey, EnemyConfig>,
} as const;
