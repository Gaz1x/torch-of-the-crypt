// ============================================================================
// КОНФИГУРАЦИЯ ИГРЫ (Все константы для легкого масштабирования и баланса)
// ============================================================================

export type EnemyTypeKey = 'SWARMER' | 'STALKER' | 'BRUTE';

export interface EnemyConfig {
  name: string;
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
  spawnWeight: number;
}

export const GAME_CONFIG = {
  WORLD: {
    WIDTH: 960,
    HEIGHT: 640,
    PADDING: 36,
  },
  PLAYER: {
    SPEED: 215,
    MAX_HP: 4,
    RADIUS: 16,
    START_X: 480,
    START_Y: 320,
  },
  LIGHT: {
    DEFAULT_RADIUS: 210, // Статичный радиус света факела
    DARKNESS_ALPHA: 0.95,
    DARKNESS_COLOR: 0x03060c,
    AMBIENT_COLOR: 0xff8800,
    AMBIENT_ALPHA: 0.14,
  },
  COMBAT: {
    FIRE_COOLDOWN: 0.42,
    PROJECTILE_SPEED: 540,
    PROJECTILE_LIFE: 1.4,
    PROJECTILE_RADIUS: 6,
    PROJECTILE_DAMAGE: 1,
    START_MANA: 60,
    MAX_MANA: 100,
    SHOT_MANA_COST: 15,
    PASSIVE_MANA_REGEN: 4,
  },
  MANA_ORB: {
    MAGNET_RADIUS: 130,
    PICKUP_RADIUS: 24,
    MAGNET_SPEED: 340,
    LIFETIME: 12,
  },
  SPAWN: {
    INITIAL_INTERVAL: 1800,
    MIN_INTERVAL: 550,
    INTERVAL_DECREASE_PER_SCORE: 12,
  },
  ENEMIES: {
    SWARMER: {
      name: 'Роевик',
      hp: 1,
      speed: 175,
      lightSlowFactor: 0.48,
      radius: 10,
      bodyColor: 0x1a103c,
      strokeColor: 0x9333ea,
      lightStrokeColor: 0x38bdf8,
      eyeColor: 0xf43f5e,
      scoreValue: 1,
      manaDrop: 15,
      spawnWeight: 45,
    },
    STALKER: {
      name: 'Сталкер',
      hp: 1,
      speed: 125,
      lightSlowFactor: 0.4,
      radius: 15,
      bodyColor: 0x090d16,
      strokeColor: 0x4c1d95,
      lightStrokeColor: 0x60a5fa,
      eyeColor: 0xef4444,
      scoreValue: 2,
      manaDrop: 22,
      spawnWeight: 40,
    },
    BRUTE: {
      name: 'Теневой Брут',
      hp: 3,
      speed: 78,
      lightSlowFactor: 0.55,
      radius: 23,
      bodyColor: 0x0f172a,
      strokeColor: 0xb91c1c,
      lightStrokeColor: 0xfbbf24,
      eyeColor: 0xf97316,
      scoreValue: 5,
      manaDrop: 40,
      spawnWeight: 15,
    },
  } as Record<EnemyTypeKey, EnemyConfig>,
} as const;
