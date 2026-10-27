import Phaser from 'phaser';

// ============================================================================
// ОТРИСОВКА РЫЦАРЯ
// Локальные оси контейнера: +X — направление взгляда, ±Y — стороны тела.
// Руки стоят симметрично, посох и факел лежат в руках и смотрят вперёд.
// ============================================================================

/** Размеры частей тела (в пикселях, относительно центра шлема). */
const BODY_RADIUS = 10;
const ARM_OFFSET_Y = 11; // насколько руки отстоят от центра
const ARM_WIDTH = 9;
const ARM_HEIGHT = 11;

/** Посох в левой руке. */
const STAFF_LENGTH = 18;
const STAFF_X = 11; // центр древка по X
const STAFF_GEM_X = 22;
const STAFF_GEM_RADIUS = 4;

/** Факел в правой руке (древко того же размера, что и у посоха). */
const TORCH_HANDLE_LENGTH = 18;
const TORCH_HANDLE_X = 11;
const FLAME_X = 22;
const FLAME_OUTER_RADIUS = 8;
const FLAME_CORE_RADIUS = 4;

/** Плащ за спиной. */
const CLOAK_X = -8;
const CLOAK_POINTS: [number, number][] = [[0, -8], [-10, -11], [-10, 11], [0, 8]];

export interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  torchFlameOuter: Phaser.GameObjects.Arc;
  torchFlameCore: Phaser.GameObjects.Arc;
}

export function createPlayer(scene: Phaser.Scene, x: number, y: number): PlayerVisual {
  const container = scene.add.container(x, y).setDepth(12);

  // 1. Плащ строго сзади (близко к центру, чтобы не висел отдельно)
  // setOrigin(0): точки Polygon рисуются минус displayOrigin (origin * размер).
  // Без него фигура со смещёнными точками сдвигается на полразмера влево-вверх.
  const cloak = scene.add.polygon(CLOAK_X, 0, CLOAK_POINTS, 0x991b1b)
    .setOrigin(0)
    .setStrokeStyle(1, 0x450a0a);

  // 2. Руки — зеркальные копии друг друга
  const leftArm = scene.add.ellipse(0, -ARM_OFFSET_Y, ARM_WIDTH, ARM_HEIGHT, 0x64748b)
    .setStrokeStyle(1.5, 0x0f172a);
  const rightArm = scene.add.ellipse(0, ARM_OFFSET_Y, ARM_WIDTH, ARM_HEIGHT, 0x64748b)
    .setStrokeStyle(1.5, 0x0f172a);

  // 3. Оружие лежит в руках: древко начинается у края руки, дальше от корпуса
  const staffShaft = scene.add.rectangle(STAFF_X, -ARM_OFFSET_Y, STAFF_LENGTH, 3, 0x475569);
  const staffGem = scene.add.circle(STAFF_GEM_X, -ARM_OFFSET_Y, STAFF_GEM_RADIUS, 0x38bdf8)
    .setStrokeStyle(1, 0xe0f2fe);

  const torchHandle = scene.add.rectangle(TORCH_HANDLE_X, ARM_OFFSET_Y, TORCH_HANDLE_LENGTH, 4, 0x78350f)
    .setStrokeStyle(1, 0x451a03);
  const torchFlameOuter = scene.add.circle(FLAME_X, ARM_OFFSET_Y, FLAME_OUTER_RADIUS, 0xf97316, 0.85);
  const torchFlameCore = scene.add.circle(FLAME_X, ARM_OFFSET_Y, FLAME_CORE_RADIUS, 0xfef08a, 1);

  // 4. Центральный шлем и забрало
  const helmet = scene.add.circle(0, 0, BODY_RADIUS, 0x94a3b8).setStrokeStyle(2, 0x0f172a);
  const visorH = scene.add.rectangle(5, 0, 3, 8, 0x0f172a);
  const visorCyanGlow = scene.add.rectangle(6, 0, 1.5, 5, 0x38bdf8);

  container.add([
    cloak,
    leftArm,
    rightArm,
    staffShaft,
    staffGem,
    torchHandle,
    helmet,
    visorH,
    visorCyanGlow,
    torchFlameOuter,
    torchFlameCore,
  ]);

  return { container, torchFlameOuter, torchFlameCore };
}
